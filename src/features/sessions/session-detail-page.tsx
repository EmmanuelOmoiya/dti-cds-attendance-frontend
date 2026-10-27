"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useState } from "react";
import { Ban, CheckCircle2, Download, Lock, MoreHorizontal, Pencil, PlayCircle, RotateCcw, Undo2, UserPlus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Consequence } from "@/components/common/action-dialog";
import { DefinitionList, PageHeader, Panel, StatTile } from "@/components/common/page-header";
import { ParticipationBadge, Pill, SessionStatusBadge } from "@/components/common/status-badge";
import { BlockSkeleton, EmptyState, ErrorState } from "@/components/common/states";
import { DataTable, type Column } from "@/components/data-table/data-table";
import { SelectFilter } from "@/components/data-table/filters";
import { CorrectionDialog, type CorrectionTarget } from "@/features/attendance/correction-dialogs";
import { EventsTable, ReprocessSummary } from "@/features/attendance/events-table";
import { attendanceApi, reportsApi, sessionsApi } from "@/lib/api/endpoints";
import { errorMessage } from "@/lib/api/errors";
import type { ReprocessResult, SessionDetail, SessionReportMember } from "@/lib/api/types";
import { useCan } from "@/lib/auth/auth-context";
import { formatDateTime, formatPercent, formatSessionWindow, formatTime } from "@/lib/datetime";
import { useGroups } from "@/lib/group-context";
import { CANCELLATION_REASON_LABELS, SESSION_STATUS_HELP, SOURCE_LABELS, label } from "@/lib/labels";
import { Permission } from "@/lib/permissions";
import { useApiMutation } from "@/lib/use-api-mutation";
import { useNow } from "@/lib/use-stored";
import { SessionActionDialog, type SessionAction } from "./session-action-dialogs";
import { SessionFormDialog } from "./session-form-dialog";

function availableActions(s: SessionDetail, now: number): SessionAction[] {
  const ended = now >= new Date(s.plannedEnd).getTime();
  const inOpenWindow = now >= new Date(s.admissionWindow.start).getTime() && now <= new Date(s.admissionWindow.end).getTime();
  switch (s.status) {
    case "SCHEDULED":
      return [...(inOpenWindow ? (["open"] as const) : []), ...(ended ? (["confirm"] as const) : []), "cancel"];
    case "OPEN":
      return ["close", "cancel"];
    case "UNRESOLVED":
      return ["confirm", "cancel"];
    case "CLOSED":
      return ["cancel"];
    case "CANCELLED":
      return ["reinstate"];
  }
}

const ACTION_META: Record<SessionAction, { label: string; icon: React.ComponentType; variant?: "default" | "outline" | "destructive" }> = {
  open: { label: "Open now", icon: PlayCircle, variant: "default" },
  close: { label: "Close attendance", icon: Lock, variant: "default" },
  confirm: { label: "Confirm held", icon: CheckCircle2, variant: "default" },
  cancel: { label: "Cancel session", icon: Ban, variant: "destructive" },
  reinstate: { label: "Reinstate", icon: Undo2, variant: "outline" },
};

export function SessionDetailPage({ id }: { id: string }) {
  const canWrite = useCan(Permission.SESSIONS_WRITE);
  const canCorrect = useCan(Permission.ATTENDANCE_CORRECT);
  const canExport = useCan(Permission.REPORTS_EXPORT);
  const { groupName } = useGroups();
  const [action, setAction] = useState<SessionAction | null>(null);
  const [editing, setEditing] = useState(false);
  const [correction, setCorrection] = useState<CorrectionTarget | null>(null);
  const [participation, setParticipation] = useState<"" | "PRESENT" | "ABSENT" | "NOT_RECORDED">("");
  const [reprocessResult, setReprocessResult] = useState<ReprocessResult | null>(null);
  const [exporting, setExporting] = useState(false);
  const now = useNow(30_000);

  const session = useQuery({ queryKey: ["sessions", "detail", id], queryFn: ({ signal }) => sessionsApi.get(id, signal), refetchInterval: (q) => (q.state.data?.status === "OPEN" ? 30_000 : false) });
  const attendance = useQuery({
    queryKey: ["sessions", "attendance", id],
    queryFn: ({ signal }) => sessionsApi.attendance(id, "all", signal),
    enabled: session.isSuccess,
    refetchInterval: session.data?.status === "OPEN" ? 30_000 : false,
  });
  const rejected = useQuery({
    queryKey: ["attendance-events", "list", { sessionId: id, ackStatus: "REJECTED" }],
    queryFn: ({ signal }) => attendanceApi.events({ sessionId: id, ackStatus: "REJECTED", pageSize: 100 }, signal),
    enabled: session.isSuccess,
  });

  const reprocessAll = useApiMutation({
    mutationFn: () => attendanceApi.reprocess({ sessionId: id }),
    invalidate: [["attendance"], ["sessions"], ["reports"], ["attendance-events"]],
    onSuccess: (r) => {
      setReprocessResult(r);
      toast.success(`${r.recordsCreated} tap(s) recovered`);
    },
    errorToast: true,
  });

  const s = session.data;
  if (session.error) return <ErrorState error={session.error} onRetry={() => session.refetch()} />;
  if (!s) return <BlockSkeleton className="h-64" />;

  const tz = s.timezone;
  const actions = canWrite ? availableActions(s, now) : [];
  const summary = attendance.data?.summary;
  const members = attendance.data?.members ?? [];
  const shown = participation ? members.filter((m) => m.participation === participation) : members;
  const events = s.attendanceSummary.deviceEvents;
  const unresolvedRejected = rejected.data?.data.filter((e) => e.resolution === "NONE").length ?? 0;

  const toTarget = (m: SessionReportMember, kind: CorrectionTarget["kind"]): CorrectionTarget => ({
    kind,
    recordId: m.recordId ?? undefined,
    sessionId: s.id,
    memberId: m.memberId,
    memberName: m.fullName,
    stateCode: m.stateCode,
    sessionTitle: s.title,
    occurrenceDate: s.occurrenceDate,
    capturedAt: m.capturedAt,
    timezone: tz,
  });

  const columns: Column<SessionReportMember>[] = [
    {
      id: "member",
      header: "Member",
      cell: (m) => (
        <div>
          <Link href={`/members/${m.memberId}`} className="font-medium hover:underline">
            {m.fullName}
          </Link>
          <div className="font-mono text-xs text-muted-foreground">{m.stateCode}</div>
        </div>
      ),
    },
    {
      id: "participation",
      header: "Attendance",
      cell: (m) => (
        <div className="flex flex-wrap items-center gap-1">
          <ParticipationBadge value={m.participation} />
          {m.recordStatus === "VOIDED" && <Pill tone="muted">Record voided</Pill>}
        </div>
      ),
    },
    {
      id: "recorded",
      header: "Recorded at",
      hideBelow: "sm",
      cell: (m) =>
        m.capturedAt && m.recordStatus ? (
          <div className="whitespace-nowrap tabular-nums">
            {formatTime(m.capturedAt, tz)}
            {m.lateSync && (
              <span className="block text-xs text-muted-foreground" title="Captured during the session, uploaded after attendance closed. Still valid.">
                Synced after close
              </span>
            )}
          </div>
        ) : (
          <span className="text-muted-foreground">—</span>
        ),
    },
    { id: "source", header: "Source", hideBelow: "md", cell: (m) => <span className="text-muted-foreground">{label(SOURCE_LABELS, m.source)}</span> },
    {
      id: "actions",
      header: <span className="sr-only">Actions</span>,
      className: "w-10 text-right",
      cell: (m) => {
        if (!canCorrect || s.status === "CANCELLED") return null;
        const kind: CorrectionTarget["kind"] | null = m.recordStatus === "PRESENT" ? "void" : m.recordStatus === "VOIDED" ? "restore" : "add";
        return (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon-sm" aria-label={`Correct attendance for ${m.fullName}`}>
                <MoreHorizontal />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {m.recordId && (
                <DropdownMenuItem asChild>
                  <Link href={`/attendance/${m.recordId}`}>View record</Link>
                </DropdownMenuItem>
              )}
              <DropdownMenuItem onSelect={() => setCorrection(toTarget(m, kind))}>
                {kind === "add" ? <><UserPlus /> Record attendance manually</> : kind === "void" ? <><Ban /> Void record</> : <><RotateCcw /> Restore record</>}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        );
      },
    },
  ];

  return (
    <>
      <PageHeader
        breadcrumbs={[{ label: "Sessions", href: "/sessions" }, { label: s.title }]}
        title={s.title}
        description={formatSessionWindow(s)}
        meta={
          <>
            <SessionStatusBadge status={s.status} />
            <Link href={`/groups/${s.groupId}`} className="text-xs text-muted-foreground hover:underline">
              {groupName(s.groupId)}
            </Link>
            {s.origin === "AD_HOC" ? <Pill>Ad-hoc</Pill> : s.scheduleId && <Link href={`/schedules/${s.scheduleId}`} className="text-xs text-muted-foreground hover:underline">From schedule</Link>}
            {s.rescheduled && <Pill tone="info">Rescheduled</Pill>}
          </>
        }
        actions={
          <>
            {canExport && (
              <Button
                variant="outline"
                disabled={exporting}
                onClick={async () => {
                  setExporting(true);
                  try {
                    await reportsApi.download("session", s.id);
                  } catch (e) {
                    toast.error(errorMessage(e));
                  } finally {
                    setExporting(false);
                  }
                }}
              >
                <Download /> {exporting ? "Exporting…" : "Export CSV"}
              </Button>
            )}
            {canWrite && s.status === "SCHEDULED" && (
              <Button variant="outline" onClick={() => setEditing(true)}>
                <Pencil /> Edit
              </Button>
            )}
            {actions.map((a) => {
              const meta = ACTION_META[a];
              const Icon = meta.icon;
              return (
                <Button key={a} variant={meta.variant} onClick={() => setAction(a)}>
                  <Icon /> {meta.label}
                </Button>
              );
            })}
          </>
        }
      />

      <div className="mb-4">
        <Consequence tone={s.status === "UNRESOLVED" ? "warning" : s.status === "CANCELLED" ? "danger" : "info"}>
          <strong>{SESSION_STATUS_HELP[s.status]}</strong>
          {s.status === "CANCELLED" && (
            <span className="block">
              Reason: {label(CANCELLATION_REASON_LABELS, s.cancellationReason)}
              {s.cancellationNote ? ` · “${s.cancellationNote}”` : ""} · {formatDateTime(s.cancelledAt, tz)}
            </span>
          )}
          {s.status === "SCHEDULED" && new Date(s.plannedEnd).getTime() < now && (
            <span className="block">The meeting time has passed. Confirm it was held or cancel it; otherwise it becomes Unresolved 24 hours after the planned end.</span>
          )}
        </Consequence>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile label="Eligible members" value={summary ? summary.eligible : "…"} hint="Members of the group at the planned start" />
        <StatTile label="Present" value={summary ? summary.present : "…"} tone="success" />
        <StatTile label="Absent" value={summary ? (summary.absent ?? "—") : "…"} hint={summary && summary.absent === null ? "Only counted once the meeting is confirmed held" : undefined} />
        <StatTile
          label="Attendance rate"
          value={summary ? formatPercent(summary.attendanceRate) : "…"}
          hint={summary ? (summary.countsTowardStatistics ? "Counts toward statistics" : s.status === "OPEN" ? "Live: not final until closed" : "Not counted in statistics") : undefined}
        />
      </div>

      <Tabs defaultValue="attendance" className="mt-6">
        <TabsList>
          <TabsTrigger value="attendance">Attendance</TabsTrigger>
          <TabsTrigger value="taps">
            Rejected taps {rejected.data && rejected.data.meta.total > 0 && <span className="ml-1 rounded bg-danger-soft px-1 text-xs text-destructive">{rejected.data.meta.total}</span>}
          </TabsTrigger>
          <TabsTrigger value="details">Details</TabsTrigger>
        </TabsList>
        <TabsContent value="attendance">
          <Panel
            title="Eligible members"
            description="Only members whose membership covered the planned start are listed. Members who joined later or had left are not expected."
            actions={
              <SelectFilter
                label="Show"
                value={participation}
                onChange={setParticipation}
                allLabel="Everyone"
                options={[
                  { value: "PRESENT", label: "Present" },
                  { value: "ABSENT", label: "Absent" },
                  { value: "NOT_RECORDED", label: "Not confirmed held" },
                ]}
              />
            }
          >
            <DataTable
              columns={columns}
              rows={attendance.data ? shown : undefined}
              rowKey={(m) => m.memberId}
              isLoading={attendance.isFetching}
              error={attendance.error}
              onRetry={() => attendance.refetch()}
              caption="Session attendance"
              empty={<EmptyState title={participation ? "No members in this state" : "No eligible members"} description={participation ? undefined : "Nobody was a member of this group at the planned start."} />}
            />
          </Panel>
        </TabsContent>
        <TabsContent value="taps">
          <Panel
            title="Rejected device taps"
            description="Taps the backend did not accept for this session. They are stored, never discarded, and can be re-evaluated after data is corrected."
            actions={
              canCorrect &&
              unresolvedRejected > 0 && (
                <Button variant="outline" size="sm" disabled={reprocessAll.isPending} onClick={() => reprocessAll.mutate()}>
                  <RotateCcw /> {reprocessAll.isPending ? "Re-evaluating…" : "Re-evaluate all"}
                </Button>
              )
            }
          >
            {reprocessResult && (
              <div className="border-b px-4 py-2 text-sm">
                <ReprocessSummary result={reprocessResult} />
              </div>
            )}
            <EventsTable
              rows={rejected.data?.data}
              isLoading={rejected.isFetching}
              error={rejected.error}
              onRetry={() => rejected.refetch()}
              onReprocessed={setReprocessResult}
              empty={<EmptyState title="No rejected taps for this session" />}
            />
          </Panel>
        </TabsContent>
        <TabsContent value="details">
          <Panel title="Session details">
            <DefinitionList
              columns={3}
              items={[
                { label: "Planned", value: formatSessionWindow(s) },
                { label: "Timezone", value: tz },
                { label: "Admission window", value: `${formatDateTime(s.admissionWindow.start, tz)} → ${formatDateTime(s.admissionWindow.end, tz)}`, hint: "Taps are judged by capture time against this window." },
                { label: "Opened at", value: formatDateTime(s.openedAt, tz) },
                { label: "Attendance closed at", value: formatDateTime(s.closedAt, tz) },
                { label: "Held confirmation", value: s.heldConfirmation === "OPENED_LIVE" ? "Opened live" : s.heldConfirmation === "CONFIRMED_RETROSPECTIVELY" ? `Confirmed afterwards (${formatDateTime(s.heldConfirmedAt, tz)})` : "Not confirmed" },
                { label: "Device taps accepted", value: events.ACCEPTED ?? 0 },
                { label: "Duplicate taps (already recorded)", value: events.ALREADY_RECORDED ?? 0 },
                { label: "Device taps rejected", value: events.REJECTED ?? 0 },
                { label: "Voided records", value: s.attendanceSummary.voided },
                { label: "Marked unresolved", value: formatDateTime(s.unresolvedAt, tz) },
                { label: "Created", value: formatDateTime(s.createdAt, tz) },
              ]}
            />
          </Panel>
        </TabsContent>
      </Tabs>

      <SessionActionDialog session={s} action={action} onClose={() => setAction(null)} />
      <SessionFormDialog open={editing} onOpenChange={setEditing} session={s} />
      <CorrectionDialog target={correction} onClose={() => setCorrection(null)} />
    </>
  );
}
