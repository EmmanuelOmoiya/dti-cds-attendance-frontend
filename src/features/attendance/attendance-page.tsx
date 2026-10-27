"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useState } from "react";
import { Ban, ClipboardCheck, Download, MoreHorizontal, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PageHeader, Panel } from "@/components/common/page-header";
import { Pill } from "@/components/common/status-badge";
import { EmptyState } from "@/components/common/states";
import { DataTable, Pagination, type Column } from "@/components/data-table/data-table";
import { DateRangeFilter, FilterBar, GroupFilter, SelectFilter } from "@/components/data-table/filters";
import { MemberPicker } from "@/features/members/member-picker";
import { apiListAll } from "@/lib/api/client";
import { attendanceApi, devicesApi, membersApi } from "@/lib/api/endpoints";
import { errorMessage } from "@/lib/api/errors";
import type { AttendanceRecord, EventAckStatus, EventResolution, Member, RejectReason, ReprocessResult } from "@/lib/api/types";
import { useCan } from "@/lib/auth/auth-context";
import { toCsv, downloadText } from "@/lib/csv";
import { formatDate, formatDateTime, todayInZone } from "@/lib/datetime";
import { useGroups } from "@/lib/group-context";
import { ACK_STATUS_LABELS, REJECT_REASON_LABELS, RESOLUTION_LABELS, SOURCE_LABELS } from "@/lib/labels";
import { Permission } from "@/lib/permissions";
import { useApiMutation } from "@/lib/use-api-mutation";
import { toInt, useUrlState } from "@/lib/use-url-state";
import { ATTENDANCE_INVALIDATE, CorrectionDialog, type CorrectionTarget } from "./correction-dialogs";
import { EventsTable, ReprocessSummary } from "./events-table";

const EXPORT_LIMIT = 5000;

function useDeviceNames(enabled: boolean) {
  return useQuery({
    queryKey: ["devices", "all"],
    queryFn: ({ signal }) => devicesApi.all(signal),
    enabled,
    staleTime: 5 * 60_000,
    select: (r) => new Map(r.data.map((d) => [d.id, d])),
  });
}

function MemberFilter({ memberId, onChange }: { memberId: string; onChange: (id: string) => void }) {
  const selected = useQuery({
    queryKey: ["members", "detail", memberId],
    queryFn: ({ signal }) => membersApi.get(memberId, signal),
    enabled: !!memberId,
  });
  const [picking, setPicking] = useState<Member | null>(null);
  return (
    <div className="grid gap-1 text-xs font-medium text-muted-foreground sm:w-72">
      <span>Member</span>
      <MemberPicker
        value={memberId ? (selected.data ?? picking) : null}
        activeOnly={false}
        onChange={(m) => {
          setPicking(m);
          onChange(m?.id ?? "");
        }}
      />
    </div>
  );
}

export function AttendancePage() {
  const canCorrect = useCan(Permission.ATTENDANCE_CORRECT);
  const canDevices = useCan(Permission.DEVICES_READ);
  const { activeGroupId, groupName } = useGroups();
  const [f, setF] = useUrlState({
    tab: "records",
    groupId: "",
    memberId: "",
    sessionId: "",
    deviceId: "",
    from: "",
    to: "",
    source: "",
    status: "PRESENT",
    ackStatus: "",
    reason: "",
    resolution: "",
    page: "1",
    pageSize: "20",
    sort: "",
  });
  const [correction, setCorrection] = useState<CorrectionTarget | null>(null);
  const [exporting, setExporting] = useState(false);
  const [reprocessResult, setReprocessResult] = useState<ReprocessResult | null>(null);
  const devices = useDeviceNames(canDevices);

  const groupId = f.groupId || activeGroupId || undefined;
  const recordParams = {
    groupId,
    memberId: f.memberId || undefined,
    sessionId: f.sessionId || undefined,
    deviceId: f.deviceId || undefined,
    from: f.from || undefined,
    to: f.to || undefined,
    source: f.source || undefined,
    status: f.status || undefined,
    sort: f.sort || "capturedAt:desc",
    page: toInt(f.page, 1),
    pageSize: toInt(f.pageSize, 20),
  };
  const eventParams = {
    groupId,
    memberId: f.memberId || undefined,
    sessionId: f.sessionId || undefined,
    deviceId: f.deviceId || undefined,
    ackStatus: f.ackStatus || undefined,
    reason: f.reason || undefined,
    resolution: f.resolution || undefined,
    sort: f.sort || "receivedAt:desc",
    page: toInt(f.page, 1),
    pageSize: toInt(f.pageSize, 20),
  };

  const records = useQuery({
    queryKey: ["attendance", "list", recordParams],
    queryFn: ({ signal }) => attendanceApi.list(recordParams, signal),
    enabled: f.tab === "records",
    placeholderData: keepPreviousData,
  });
  const events = useQuery({
    queryKey: ["attendance-events", "list", eventParams],
    queryFn: ({ signal }) => attendanceApi.events(eventParams, signal),
    enabled: f.tab === "events",
    placeholderData: keepPreviousData,
  });

  const bulkReprocess = useApiMutation({
    mutationFn: () =>
      attendanceApi.reprocess({
        sessionId: f.sessionId || undefined,
        memberId: f.memberId || undefined,
        deviceId: f.deviceId || undefined,
        reason: f.reason || undefined,
      }),
    invalidate: ATTENDANCE_INVALIDATE,
    onSuccess: (r) => {
      setReprocessResult(r);
      toast.success(`${r.recordsCreated} tap(s) recovered`);
    },
    errorToast: true,
  });

  const deviceLabel = (id: string | null) => {
    if (!id) return "—";
    const d = devices.data?.get(id);
    return d ? d.deviceIdentifier : `…${id.slice(-6)}`;
  };

  const exportCsv = async () => {
    setExporting(true);
    try {
      const filters = { ...recordParams, page: undefined, pageSize: undefined };
      const all = await apiListAll<AttendanceRecord>("/attendance", filters, undefined, EXPORT_LIMIT / 100);
      const csv = toCsv(all.data, [
        { header: "State code", value: (r) => r.member.stateCode },
        { header: "Full name", value: (r) => r.member.fullName },
        { header: "CDS group", value: (r) => groupName(r.session.groupId) },
        { header: "Session date", value: (r) => r.session.occurrenceDate },
        { header: "Session", value: (r) => r.session.title },
        { header: "Captured at (UTC)", value: (r) => r.capturedAt },
        { header: "Received at (UTC)", value: (r) => r.receivedAt },
        { header: "Synced after close", value: (r) => (r.lateSync ? "yes" : "no") },
        { header: "Source", value: (r) => SOURCE_LABELS[r.source] },
        { header: "Device", value: (r) => (r.deviceId ? deviceLabel(r.deviceId) : "") },
        { header: "Record status", value: (r) => r.status },
        { header: "Note", value: (r) => r.note ?? r.voidNote ?? "" },
      ]);
      downloadText(csv, `attendance-records-${todayInZone()}.csv`);
      toast.success(all.truncated ? `Exported the first ${all.data.length.toLocaleString()} of ${all.total.toLocaleString()} records. Narrow the filters for the rest.` : `Exported ${all.data.length.toLocaleString()} records`);
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setExporting(false);
    }
  };

  const columns: Column<AttendanceRecord>[] = [
    {
      id: "member",
      header: "Member",
      cell: (r) => (
        <div>
          <Link href={`/members/${r.member.id}`} className="font-medium hover:underline">
            {r.member.fullName}
          </Link>
          <div className="font-mono text-xs text-muted-foreground">{r.member.stateCode}</div>
        </div>
      ),
    },
    {
      id: "session",
      header: "Session",
      cell: (r) => (
        <div className="min-w-0">
          <Link href={`/sessions/${r.session.id}`} className="whitespace-nowrap hover:underline">
            {formatDate(r.session.occurrenceDate)}
          </Link>
          <div className="line-clamp-1 text-xs text-muted-foreground">{r.session.title}</div>
        </div>
      ),
    },
    { id: "group", header: "Group", hideBelow: "lg", cell: (r) => <span className="text-muted-foreground">{groupName(r.session.groupId)}</span> },
    {
      id: "captured",
      header: "Tap time",
      sortKey: "capturedAt",
      cell: (r) => (
        <div className="whitespace-nowrap tabular-nums">
          {formatDateTime(r.capturedAt)}
          {r.lateSync && (
            <span className="block text-xs text-muted-foreground" title="Captured during the session and uploaded after attendance closed. Still valid.">
              Synced after close
            </span>
          )}
        </div>
      ),
    },
    {
      id: "source",
      header: "Source",
      hideBelow: "md",
      cell: (r) => (
        <div>
          <span>{SOURCE_LABELS[r.source]}</span>
          {r.deviceId && <span className="block font-mono text-xs text-muted-foreground">{deviceLabel(r.deviceId)}</span>}
        </div>
      ),
    },
    {
      id: "status",
      header: "Status",
      cell: (r) => (r.status === "PRESENT" ? <Pill tone="success">Present</Pill> : <Pill tone="muted" title={r.voidNote ?? undefined}>Voided</Pill>),
    },
    {
      id: "actions",
      header: <span className="sr-only">Actions</span>,
      className: "w-10 text-right",
      cell: (r) => (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon-sm" aria-label="Record actions">
              <MoreHorizontal />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem asChild>
              <Link href={`/attendance/${r.id}`}>View details</Link>
            </DropdownMenuItem>
            {canCorrect && r.session.status !== "CANCELLED" && (
              <DropdownMenuItem
                onSelect={() =>
                  setCorrection({
                    kind: r.status === "PRESENT" ? "void" : "restore",
                    recordId: r.id,
                    sessionId: r.sessionId,
                    memberId: r.memberId,
                    memberName: r.member.fullName,
                    stateCode: r.member.stateCode,
                    sessionTitle: r.session.title,
                    occurrenceDate: r.session.occurrenceDate,
                    capturedAt: r.capturedAt,
                  })
                }
              >
                {r.status === "PRESENT" ? <><Ban /> Void record</> : <><RotateCcw /> Restore record</>}
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      ),
    },
  ];

  const deviceOptions = [...(devices.data?.values() ?? [])].map((d) => ({ value: d.id, label: d.deviceIdentifier }));
  const commonFilters = (
    <>
      <GroupFilter value={f.groupId || activeGroupId || ""} onChange={(groupId) => setF({ groupId })} />
      <MemberFilter memberId={f.memberId} onChange={(memberId) => setF({ memberId })} />
      {canDevices && deviceOptions.length > 0 && <SelectFilter label="Device" value={f.deviceId} onChange={(deviceId) => setF({ deviceId })} options={deviceOptions} />}
    </>
  );

  return (
    <>
      <PageHeader
        title="Attendance"
        description="Official attendance records, and the raw device taps they come from. A rejected tap is never official attendance; it is kept for review."
        actions={
          f.tab === "records" && (
            <Button variant="outline" onClick={exportCsv} disabled={exporting || !records.data?.meta.total}>
              <Download /> {exporting ? "Exporting…" : "Export CSV"}
            </Button>
          )
        }
      />
      <Tabs value={f.tab} onValueChange={(tab) => setF({ tab, sort: "" })} className="mb-3">
        <TabsList>
          <TabsTrigger value="records">Official records</TabsTrigger>
          <TabsTrigger value="events">Device taps</TabsTrigger>
        </TabsList>
      </Tabs>

      {f.sessionId && (
        <div className="mb-3 flex items-center gap-2 text-sm">
          <Pill tone="info">Filtered to one session</Pill>
          <Link href={`/sessions/${f.sessionId}`} className="text-xs hover:underline">
            Open session
          </Link>
          <Button variant="ghost" size="xs" onClick={() => setF({ sessionId: "" })}>
            Clear
          </Button>
        </div>
      )}

      {f.tab === "records" ? (
        <Panel>
          <FilterBar
            onReset={() => setF({ groupId: "", memberId: "", deviceId: "", from: "", to: "", source: "", status: "PRESENT", sessionId: "" })}
            canReset={!!(f.groupId || f.memberId || f.deviceId || f.from || f.to || f.source || f.status !== "PRESENT" || f.sessionId)}
          >
            {commonFilters}
            <DateRangeFilter from={f.from} to={f.to} onChange={(r) => setF(r)} label="Session date" />
            <SelectFilter
              label="Source"
              value={f.source as "" | "DEVICE" | "MANUAL" | "REPROCESSED"}
              onChange={(source) => setF({ source })}
              options={(Object.keys(SOURCE_LABELS) as (keyof typeof SOURCE_LABELS)[]).map((s) => ({ value: s, label: SOURCE_LABELS[s] }))}
            />
            <SelectFilter
              label="Record status"
              value={f.status as "" | "PRESENT" | "VOIDED"}
              onChange={(status) => setF({ status })}
              allLabel="Present and voided"
              options={[
                { value: "PRESENT", label: "Present" },
                { value: "VOIDED", label: "Voided" },
              ]}
            />
          </FilterBar>
          <DataTable
            columns={columns}
            rows={records.data?.data}
            rowKey={(r) => r.id}
            isLoading={records.isFetching}
            error={records.error}
            onRetry={() => records.refetch()}
            sort={recordParams.sort}
            onSortChange={(sort) => setF({ sort })}
            caption="Attendance records"
            empty={<EmptyState icon={ClipboardCheck} title="No attendance records match" description="Records appear once members tap their cards and devices synchronize, or after manual entries." />}
          />
          <Pagination meta={records.data?.meta} onPageChange={(page) => setF({ page }, { resetPage: false })} onPageSizeChange={(pageSize) => setF({ pageSize })} />
        </Panel>
      ) : (
        <Panel>
          <FilterBar
            onReset={() => setF({ groupId: "", memberId: "", deviceId: "", ackStatus: "", reason: "", resolution: "", sessionId: "" })}
            canReset={!!(f.groupId || f.memberId || f.deviceId || f.ackStatus || f.reason || f.resolution || f.sessionId)}
          >
            {commonFilters}
            <SelectFilter
              label="Outcome"
              value={f.ackStatus as EventAckStatus | ""}
              onChange={(ackStatus) => setF({ ackStatus })}
              options={(Object.keys(ACK_STATUS_LABELS) as EventAckStatus[]).map((s) => ({ value: s, label: ACK_STATUS_LABELS[s] }))}
            />
            <SelectFilter
              label="Rejection reason"
              className="sm:w-56"
              value={f.reason as RejectReason | ""}
              onChange={(reason) => setF({ reason })}
              options={(Object.keys(REJECT_REASON_LABELS) as RejectReason[]).map((s) => ({ value: s, label: REJECT_REASON_LABELS[s] }))}
            />
            <SelectFilter
              label="Review"
              value={f.resolution as EventResolution | ""}
              onChange={(resolution) => setF({ resolution })}
              options={(Object.keys(RESOLUTION_LABELS) as EventResolution[]).map((s) => ({ value: s, label: RESOLUTION_LABELS[s] }))}
            />
            {canCorrect && f.ackStatus === "REJECTED" && (
              <Button variant="outline" size="sm" disabled={bulkReprocess.isPending} onClick={() => bulkReprocess.mutate()} title="Re-evaluates up to 500 unreviewed rejected taps matching the member, device, session and reason filters, within your groups.">
                <RotateCcw /> {bulkReprocess.isPending ? "Re-evaluating…" : "Re-evaluate matching"}
              </Button>
            )}
          </FilterBar>
          {reprocessResult && (
            <div className="border-b px-4 py-2 text-sm">
              <ReprocessSummary result={reprocessResult} />
            </div>
          )}
          <EventsTable
            rows={events.data?.data}
            isLoading={events.isFetching}
            error={events.error}
            onRetry={() => events.refetch()}
            sort={eventParams.sort}
            onSortChange={(sort) => setF({ sort })}
            onReprocessed={setReprocessResult}
            empty={<EmptyState title="No device taps match" description="Taps appear here after devices synchronize." />}
          />
          <Pagination meta={events.data?.meta} onPageChange={(page) => setF({ page }, { resetPage: false })} onPageSizeChange={(pageSize) => setF({ pageSize })} />
        </Panel>
      )}
      <CorrectionDialog target={correction} onClose={() => setCorrection(null)} />
    </>
  );
}
