"use client";

import { useQueries, useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useState } from "react";
import { Download, FileBarChart, Info } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Consequence } from "@/components/common/action-dialog";
import { NativeSelect } from "@/components/common/form";
import { PageHeader, Panel, StatTile } from "@/components/common/page-header";
import { ParticipationBadge, SessionStatusBadge } from "@/components/common/status-badge";
import { BlockSkeleton, EmptyState, ErrorState } from "@/components/common/states";
import { DataTable, type Column } from "@/components/data-table/data-table";
import { DateRangeFilter, FilterBar } from "@/components/data-table/filters";
import { MemberPicker } from "@/features/members/member-picker";
import { membersApi, reportsApi, sessionsApi } from "@/lib/api/endpoints";
import { errorMessage } from "@/lib/api/errors";
import type { GroupMembersReport, GroupReportSession, Member, MemberReportSession, SessionReportMember } from "@/lib/api/types";
import { useCan } from "@/lib/auth/auth-context";
import { addDays, formatDate, formatDateTime, formatPercent, todayInZone } from "@/lib/datetime";
import { useGroups } from "@/lib/group-context";
import { CANCELLATION_REASON_LABELS, label } from "@/lib/labels";
import { Permission } from "@/lib/permissions";
import { useUrlState } from "@/lib/use-url-state";
import { AttendanceTrendChart, GroupComparisonChart } from "./charts";

type ReportType = "group" | "members" | "session" | "member" | "compare";
const COMPARE_LIMIT = 15;

function Definitions() {
  return (
    <div className="flex gap-2 rounded-md border bg-card px-3 py-2 text-xs text-muted-foreground">
      <Info className="mt-0.5 size-3.5 shrink-0" />
      <p>
        Statistics count only <strong className="text-foreground">held</strong> (closed) sessions and only members who were <strong className="text-foreground">eligible</strong> at each session start
        (joined at or before it, not yet left). Cancelled sessions never count. Unresolved sessions are excluded and listed as a warning, so an unconfirmed meeting never makes anyone look absent.
        Date ranges are inclusive local session dates. Figures are computed by the attendance service.
      </p>
    </div>
  );
}

function useDownload() {
  const [busy, setBusy] = useState(false);
  const run = async (fn: () => Promise<string>) => {
    setBusy(true);
    try {
      const name = await fn();
      toast.success(`Downloaded ${name}`);
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };
  return { busy, run };
}

function GroupReportView({ groupId, range, canExport }: { groupId: string; range: { from?: string; to?: string }; canExport: boolean }) {
  const report = useQuery({ queryKey: ["reports", "group", groupId, range], queryFn: ({ signal }) => reportsApi.group(groupId, range, signal) });
  const dl = useDownload();
  if (report.error) return <ErrorState error={report.error} onRetry={() => report.refetch()} />;
  if (!report.data) return <BlockSkeleton className="h-64" />;
  const r = report.data;
  const held = r.sessions.filter((s) => s.countsTowardStatistics && s.attendanceRate !== null);
  const trend = held.map((s) => ({ date: s.occurrenceDate, title: s.title, rate: s.attendanceRate!, present: s.present, eligible: s.eligible }));
  const columns: Column<GroupReportSession>[] = [
    { id: "date", header: "Date", cell: (s) => <Link className="font-medium whitespace-nowrap hover:underline" href={`/sessions/${s.sessionId}`}>{formatDate(s.occurrenceDate)}</Link> },
    { id: "title", header: "Session", hideBelow: "md", cell: (s) => <span className="line-clamp-1">{s.title}</span> },
    {
      id: "status",
      header: "Status",
      cell: (s) => (
        <div className="flex flex-col items-start gap-0.5">
          <SessionStatusBadge status={s.status} />
          {s.cancellationReason && <span className="text-xs text-muted-foreground">{label(CANCELLATION_REASON_LABELS, s.cancellationReason as never)}</span>}
        </div>
      ),
    },
    { id: "counts", header: "Counts", hideBelow: "sm", cell: (s) => (s.countsTowardStatistics ? "Yes" : <span className="text-muted-foreground">No</span>) },
    { id: "eligible", header: "Eligible", className: "tabular-nums", cell: (s) => s.eligible },
    { id: "present", header: "Present", className: "tabular-nums", cell: (s) => s.present },
    { id: "absent", header: "Absent", className: "tabular-nums", cell: (s) => s.absent ?? "—" },
    { id: "rate", header: "Rate", className: "tabular-nums", cell: (s) => formatPercent(s.attendanceRate) },
  ];
  return (
    <div className="grid gap-4">
      {r.warnings.map((w) => (
        <Consequence key={w}>{w}</Consequence>
      ))}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile label="Pooled attendance rate" value={formatPercent(r.totals.attendanceRate)} hint={`${r.totals.totalPresent} present of ${r.totals.totalEligible} eligible attendances`} />
        <StatTile label="Mean per-session rate" value={formatPercent(r.totals.meanSessionAttendanceRate)} hint="Average of each held session's rate" />
        <StatTile label="Held sessions" value={r.totals.heldSessions} hint={`${r.totals.activeMembersNow} current members today`} />
        <StatTile
          label="Excluded"
          value={r.excluded.cancelled + r.excluded.unresolved + r.excluded.open + r.excluded.scheduled}
          hint={`${r.excluded.cancelled} cancelled · ${r.excluded.unresolved} unresolved · ${r.excluded.open} open · ${r.excluded.scheduled} scheduled`}
          tone={r.excluded.unresolved ? "warning" : "default"}
        />
      </div>
      {Object.keys(r.excluded.cancelledByReason).length > 0 && (
        <p className="text-xs text-muted-foreground">
          Cancelled by reason: {Object.entries(r.excluded.cancelledByReason).map(([k, v]) => `${label(CANCELLATION_REASON_LABELS, k as never)} ${v}`).join(" · ")}
        </p>
      )}
      <Panel title="Attendance rate per held session">
        {trend.length < 2 ? (
          <EmptyState title="Not enough held sessions to chart" description="The trend appears once at least two sessions in this period are confirmed held." />
        ) : (
          <AttendanceTrendChart
            data={trend}
            summary={`${trend.length} held sessions in ${r.group.name}${r.range.from ? ` from ${formatDate(r.range.from, { weekday: false })}` : ""}${r.range.to ? ` to ${formatDate(r.range.to, { weekday: false })}` : ""}. Range ${formatPercent(Math.min(...trend.map((t) => t.rate)))}–${formatPercent(Math.max(...trend.map((t) => t.rate)))}.`}
          />
        )}
      </Panel>
      <Panel
        title="Sessions in this period"
        actions={
          canExport && (
            <Button variant="outline" size="sm" disabled={dl.busy} onClick={() => dl.run(() => reportsApi.download("group", groupId, range))}>
              <Download /> CSV
            </Button>
          )
        }
      >
        <DataTable columns={columns} rows={r.sessions} rowKey={(s) => s.sessionId} caption="Group report sessions" empty={<EmptyState title="No sessions in this period" />} />
      </Panel>
    </div>
  );
}

function GroupMembersView({ groupId, range, canExport }: { groupId: string; range: { from?: string; to?: string }; canExport: boolean }) {
  const report = useQuery({ queryKey: ["reports", "group-members", groupId, range], queryFn: ({ signal }) => reportsApi.groupMembers(groupId, range, signal) });
  const [sort, setSort] = useState<"name" | "rate">("name");
  const dl = useDownload();
  if (report.error) return <ErrorState error={report.error} onRetry={() => report.refetch()} />;
  if (!report.data) return <BlockSkeleton className="h-64" />;
  type Row = GroupMembersReport["members"][number];
  const rows = [...report.data.members].sort((a, b) => (sort === "rate" ? (a.attendanceRate ?? -1) - (b.attendanceRate ?? -1) : a.fullName.localeCompare(b.fullName)));
  const columns: Column<Row>[] = [
    { id: "member", header: "Member", cell: (m) => <Link className="font-medium hover:underline" href={`/members/${m.memberId}`}>{m.fullName}</Link> },
    { id: "stateCode", header: "State code", cell: (m) => <span className="font-mono text-xs">{m.stateCode}</span> },
    { id: "eligible", header: "Eligible held sessions", className: "tabular-nums", cell: (m) => m.eligibleSessions },
    { id: "present", header: "Present", className: "tabular-nums", cell: (m) => m.present },
    { id: "absent", header: "Absent", className: "tabular-nums", cell: (m) => m.absent },
    { id: "rate", header: "Attendance %", className: "tabular-nums", cell: (m) => formatPercent(m.attendanceRate) },
  ];
  return (
    <Panel
      title={`Members of ${report.data.group.name}`}
      description="Only members eligible for at least one held session in the period are listed. Each rate uses that member's own eligible sessions."
      actions={
        <>
          <NativeSelect value={sort} onChange={(e) => setSort(e.target.value as "name" | "rate")} className="w-40" aria-label="Sort members">
            <option value="name">Sort by name</option>
            <option value="rate">Lowest rate first</option>
          </NativeSelect>
          {canExport && (
            <Button variant="outline" size="sm" disabled={dl.busy} onClick={() => dl.run(() => reportsApi.download("groupMembers", groupId, range))}>
              <Download /> CSV
            </Button>
          )}
        </>
      }
    >
      <DataTable columns={columns} rows={rows} rowKey={(m) => m.memberId} caption="Member attendance" empty={<EmptyState title="No held sessions in this period" />} />
    </Panel>
  );
}

function SessionReportView({ groupId, sessionId, onSession, canExport }: { groupId: string; sessionId: string; onSession: (id: string) => void; canExport: boolean }) {
  const sessions = useQuery({
    queryKey: ["sessions", "list", { groupId, to: todayInZone(), pageSize: 100, sort: "plannedStart:desc" }],
    queryFn: ({ signal }) => sessionsApi.list({ groupId, to: todayInZone(), pageSize: 100, sort: "plannedStart:desc" }, signal),
  });
  const report = useQuery({ queryKey: ["reports", "session", sessionId], queryFn: ({ signal }) => reportsApi.session(sessionId, signal), enabled: !!sessionId });
  const dl = useDownload();
  const columns: Column<SessionReportMember>[] = [
    { id: "member", header: "Member", cell: (m) => <Link className="font-medium hover:underline" href={`/members/${m.memberId}`}>{m.fullName}</Link> },
    { id: "stateCode", header: "State code", cell: (m) => <span className="font-mono text-xs">{m.stateCode}</span> },
    { id: "participation", header: "Attendance", cell: (m) => <ParticipationBadge value={m.participation} /> },
    { id: "at", header: "Recorded at", hideBelow: "sm", cell: (m) => (m.recordStatus === "PRESENT" ? formatDateTime(m.capturedAt) : "—") },
  ];
  return (
    <div className="grid gap-4">
      <label className="grid max-w-md gap-1 text-xs font-medium text-muted-foreground">
        Session
        <NativeSelect value={sessionId} onChange={(e) => onSession(e.target.value)}>
          <option value="">{sessions.isPending ? "Loading…" : "Choose a session…"}</option>
          {sessions.data?.data.map((s) => (
            <option key={s.id} value={s.id}>
              {formatDate(s.occurrenceDate)} · {s.title} ({s.status.toLowerCase()})
            </option>
          ))}
        </NativeSelect>
      </label>
      {!sessionId ? (
        <EmptyState icon={FileBarChart} title="Choose a session" />
      ) : report.error ? (
        <ErrorState error={report.error} onRetry={() => report.refetch()} />
      ) : !report.data ? (
        <BlockSkeleton className="h-48" />
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-4">
            <StatTile label="Eligible" value={report.data.summary.eligible} />
            <StatTile label="Present" value={report.data.summary.present} />
            <StatTile label="Absent" value={report.data.summary.absent ?? "—"} />
            <StatTile label="Rate" value={formatPercent(report.data.summary.attendanceRate)} hint={report.data.summary.countsTowardStatistics ? "Counts toward statistics" : "Not counted in statistics"} />
          </div>
          <Panel
            title={`${report.data.session.title} · ${formatDate(report.data.session.occurrenceDate)}`}
            description={report.data.session.groupName}
            actions={
              canExport && (
                <Button variant="outline" size="sm" disabled={dl.busy} onClick={() => dl.run(() => reportsApi.download("session", sessionId))}>
                  <Download /> CSV
                </Button>
              )
            }
          >
            <DataTable columns={columns} rows={report.data.members} rowKey={(m) => m.memberId} caption="Session attendance" empty={<EmptyState title="No eligible members" />} />
          </Panel>
        </>
      )}
    </div>
  );
}

function MemberReportView({ memberId, onMember, range, canExport }: { memberId: string; onMember: (id: string) => void; range: { from?: string; to?: string }; canExport: boolean }) {
  const selected = useQuery({ queryKey: ["members", "detail", memberId], queryFn: ({ signal }) => membersApi.get(memberId, signal), enabled: !!memberId });
  const [picked, setPicked] = useState<Member | null>(null);
  const report = useQuery({ queryKey: ["reports", "member", memberId, range], queryFn: ({ signal }) => reportsApi.member(memberId, range, signal), enabled: !!memberId });
  const dl = useDownload();
  const columns: Column<MemberReportSession>[] = [
    { id: "date", header: "Date", cell: (s) => <Link className="whitespace-nowrap hover:underline" href={`/sessions/${s.sessionId}`}>{formatDate(s.occurrenceDate)}</Link> },
    { id: "group", header: "Group", hideBelow: "md", cell: (s) => s.groupName },
    { id: "title", header: "Session", hideBelow: "sm", cell: (s) => <span className="line-clamp-1">{s.title}</span> },
    { id: "participation", header: "Attendance", cell: (s) => <ParticipationBadge value={s.participation} /> },
  ];
  return (
    <div className="grid gap-4">
      <div className="max-w-md">
        <MemberPicker
          activeOnly={false}
          value={memberId ? (selected.data ?? picked) : null}
          onChange={(m) => {
            setPicked(m);
            onMember(m?.id ?? "");
          }}
        />
      </div>
      {!memberId ? (
        <EmptyState icon={FileBarChart} title="Choose a member" />
      ) : report.error ? (
        <ErrorState error={report.error} onRetry={() => report.refetch()} />
      ) : !report.data ? (
        <BlockSkeleton className="h-48" />
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-4">
            <StatTile label="Attendance rate" value={formatPercent(report.data.summary.attendanceRate)} hint={`${report.data.summary.present} of ${report.data.summary.eligibleSessions} eligible held sessions`} />
            <StatTile label="Absent" value={report.data.summary.absent} />
            <StatTile label="Pending resolution" value={report.data.summary.pendingResolution} />
            <StatTile label="Cancelled" value={report.data.summary.cancelledSessions} />
          </div>
          <Panel
            title={`${report.data.member.fullName} (${report.data.member.stateCode})`}
            actions={
              canExport && (
                <Button variant="outline" size="sm" disabled={dl.busy} onClick={() => dl.run(() => reportsApi.download("member", memberId, range))}>
                  <Download /> CSV
                </Button>
              )
            }
          >
            <DataTable columns={columns} rows={[...report.data.sessions].reverse()} rowKey={(s) => s.sessionId} caption="Member attendance history" empty={<EmptyState title="No sessions in this period" />} />
          </Panel>
        </>
      )}
    </div>
  );
}

function CompareView({ range }: { range: { from?: string; to?: string } }) {
  const { groups } = useGroups();
  const target = groups.filter((g) => g.status === "ACTIVE").slice(0, COMPARE_LIMIT);
  const reports = useQueries({
    queries: target.map((g) => ({
      queryKey: ["reports", "group", g.id, range],
      queryFn: ({ signal }: { signal: AbortSignal }) => reportsApi.group(g.id, range, signal),
    })),
  });
  if (reports.some((q) => q.isPending)) return <BlockSkeleton className="h-64" />;
  const failed = reports.find((q) => q.error);
  if (failed) return <ErrorState error={failed.error} />;
  const rows = reports
    .map((q) => q.data!)
    .map((r) => ({ id: r.group.id, name: r.group.name, rate: r.totals.attendanceRate, held: r.totals.heldSessions, unresolved: r.excluded.unresolved, present: r.totals.totalPresent, eligible: r.totals.totalEligible }));
  const charted = rows.filter((r) => r.rate !== null).map((r) => ({ name: r.name, rate: r.rate!, held: r.held })).sort((a, b) => b.rate - a.rate);
  type Row = (typeof rows)[number];
  const columns: Column<Row>[] = [
    { id: "name", header: "Group", cell: (r) => <Link className="font-medium hover:underline" href={`/reports?type=group&groupId=${r.id}`}>{r.name}</Link> },
    { id: "held", header: "Held sessions", className: "tabular-nums", cell: (r) => r.held },
    { id: "attendances", header: "Present / eligible", className: "tabular-nums", cell: (r) => `${r.present} / ${r.eligible}` },
    { id: "rate", header: "Pooled rate", className: "tabular-nums", cell: (r) => formatPercent(r.rate) },
    { id: "unresolved", header: "Unresolved (excluded)", className: "tabular-nums", cell: (r) => r.unresolved },
  ];
  return (
    <div className="grid gap-4">
      {groups.filter((g) => g.status === "ACTIVE").length > COMPARE_LIMIT && <Consequence tone="info">Showing the first {COMPARE_LIMIT} active groups. Open a group report for the others.</Consequence>}
      <Panel title="Pooled attendance rate by group">
        {charted.length === 0 ? (
          <EmptyState title="No held sessions in this period" />
        ) : (
          <GroupComparisonChart data={charted} summary={`${charted.length} groups with held sessions. Highest ${charted[0].name} at ${formatPercent(charted[0].rate)}; lowest ${charted[charted.length - 1].name} at ${formatPercent(charted[charted.length - 1].rate)}.`} />
        )}
      </Panel>
      <Panel title="Comparison table">
        <DataTable columns={columns} rows={rows} rowKey={(r) => r.id} caption="Group comparison" />
      </Panel>
    </div>
  );
}

export function ReportsPage() {
  const canExport = useCan(Permission.REPORTS_EXPORT);
  const { groups, activeGroupId } = useGroups();
  const today = todayInZone();
  const [f, setF] = useUrlState({ type: "group", groupId: "", from: addDays(today, -90), to: today, sessionId: "", memberId: "" });
  const type = f.type as ReportType;
  const groupId = f.groupId || activeGroupId || (groups.length === 1 ? groups[0].id : "");
  const range = { from: f.from || undefined, to: f.to || undefined };
  const needsGroup = type === "group" || type === "members" || type === "session";
  const needsRange = type !== "session";
  const invalidRange = !!f.from && !!f.to && f.to < f.from;

  return (
    <>
      <PageHeader title="Reports" description="Eligibility-based attendance statistics and CSV exports generated by the attendance service." />
      <Tabs value={type} onValueChange={(v) => setF({ type: v })} className="mb-3">
        <TabsList className="flex-wrap">
          <TabsTrigger value="group">Group sessions</TabsTrigger>
          <TabsTrigger value="members">Group members</TabsTrigger>
          <TabsTrigger value="session">Single session</TabsTrigger>
          <TabsTrigger value="member">Member history</TabsTrigger>
          {groups.length > 1 && <TabsTrigger value="compare">Compare groups</TabsTrigger>}
        </TabsList>
      </Tabs>
      <div className="mb-4 grid gap-3">
        <Definitions />
        <Panel>
          <FilterBar>
            {needsGroup && (
              <label className="grid gap-1 text-xs font-medium text-muted-foreground sm:w-64">
                CDS group
                <NativeSelect value={groupId} onChange={(e) => setF({ groupId: e.target.value, sessionId: "" })}>
                  <option value="">Choose a group…</option>
                  {groups.map((g) => (
                    <option key={g.id} value={g.id}>
                      {g.name}
                    </option>
                  ))}
                </NativeSelect>
              </label>
            )}
            {needsRange && <DateRangeFilter from={f.from} to={f.to} onChange={(r) => setF(r)} label="Reporting period (session dates)" />}
            {needsRange && (
              <div className="flex gap-1">
                {[30, 90, 180].map((d) => (
                  <Button key={d} variant="ghost" size="sm" onClick={() => setF({ from: addDays(today, -d), to: today })}>
                    {d} days
                  </Button>
                ))}
                <Button variant="ghost" size="sm" onClick={() => setF({ from: "", to: "" })}>
                  All time
                </Button>
              </div>
            )}
          </FilterBar>
        </Panel>
      </div>
      {invalidRange ? (
        <EmptyState title="The end date is before the start date" />
      ) : needsGroup && !groupId ? (
        <EmptyState icon={FileBarChart} title="Choose a CDS group" />
      ) : type === "group" ? (
        <GroupReportView groupId={groupId} range={range} canExport={canExport} />
      ) : type === "members" ? (
        <GroupMembersView groupId={groupId} range={range} canExport={canExport} />
      ) : type === "session" ? (
        <SessionReportView groupId={groupId} sessionId={f.sessionId} onSession={(sessionId) => setF({ sessionId })} canExport={canExport} />
      ) : type === "member" ? (
        <MemberReportView memberId={f.memberId} onMember={(memberId) => setF({ memberId })} range={range} canExport={canExport} />
      ) : (
        <CompareView range={range} />
      )}
    </>
  );
}
