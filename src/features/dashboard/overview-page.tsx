"use client";

import { useQueries, useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useState } from "react";
import { AlertTriangle, CalendarCheck, CalendarClock, ClipboardX, Smartphone, Users, UsersRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { NativeSelect } from "@/components/common/form";
import { PageHeader, Panel, StatTile } from "@/components/common/page-header";
import { BlockSkeleton, EmptyState, ErrorState } from "@/components/common/states";
import { AttendanceTrendChart, GroupComparisonChart } from "@/features/reports/charts";
import { SessionsTable } from "@/features/sessions/sessions-table";
import { syncHealth } from "@/features/devices/devices-table";
import { devicesApi, groupsApi, reportsApi, sessionsApi } from "@/lib/api/endpoints";
import { useAuth } from "@/lib/auth/auth-context";
import { addDays, formatDate, formatPercent, todayInZone } from "@/lib/datetime";
import { useGroups } from "@/lib/group-context";
import { Permission } from "@/lib/permissions";
import { useAttention } from "./use-attention";

/** Per-group detail/report calls are fanned out only up to this many groups. */
const FANOUT_LIMIT = 20;

export function OverviewPage() {
  const { can, user } = useAuth();
  const { groups, activeGroupId, activeGroup, groupsLoading } = useGroups();
  const [days, setDays] = useState(30);
  const today = todayInZone();
  const range = { from: addDays(today, -days), to: today };
  const canReports = can(Permission.REPORTS_READ);
  const canDevices = can(Permission.DEVICES_READ);

  const scopeGroups = activeGroupId ? groups.filter((g) => g.id === activeGroupId) : groups.filter((g) => g.status === "ACTIVE");
  const fanout = scopeGroups.slice(0, FANOUT_LIMIT);
  const complete = scopeGroups.length <= FANOUT_LIMIT;

  const details = useQueries({
    queries: fanout.map((g) => ({ queryKey: ["groups", "detail", g.id], queryFn: ({ signal }: { signal: AbortSignal }) => groupsApi.get(g.id, signal) })),
  });
  const reports = useQueries({
    queries: canReports
      ? fanout.map((g) => ({ queryKey: ["reports", "group", g.id, range], queryFn: ({ signal }: { signal: AbortSignal }) => reportsApi.group(g.id, range, signal) }))
      : [],
  });
  const held = useQuery({
    queryKey: ["sessions", "count", { status: "CLOSED", groupId: activeGroupId, ...range }],
    queryFn: ({ signal }) => sessionsApi.list({ status: "CLOSED", groupId: activeGroupId ?? undefined, ...range, pageSize: 1 }, signal),
    select: (r) => r.meta.total,
  });
  const recent = useQuery({
    queryKey: ["sessions", "list", { groupId: activeGroupId, to: today, sort: "plannedStart:desc", pageSize: 6 }],
    queryFn: ({ signal }) => sessionsApi.list({ groupId: activeGroupId ?? undefined, to: today, sort: "plannedStart:desc", pageSize: 6 }, signal),
  });
  const upcoming = useQuery({
    queryKey: ["sessions", "list", { groupId: activeGroupId, from: today, sort: "plannedStart:asc", pageSize: 5 }],
    queryFn: ({ signal }) => sessionsApi.list({ groupId: activeGroupId ?? undefined, from: today, sort: "plannedStart:asc", pageSize: 5 }, signal),
  });
  const devices = useQuery({
    queryKey: ["devices", "list", { groupId: activeGroupId, status: "ACTIVE", pageSize: 100 }],
    queryFn: ({ signal }) => devicesApi.list({ groupId: activeGroupId ?? undefined, status: "ACTIVE", pageSize: 100 }, signal),
    enabled: canDevices,
  });
  const attention = useAttention(activeGroupId);

  const detailsReady = details.length > 0 && details.every((d) => d.data);
  const currentMembers = detailsReady ? details.reduce((s, d) => s + d.data!.stats.activeMembers, 0) : null;
  const reportsReady = reports.length > 0 && reports.every((r) => r.data);
  const pooled = reportsReady
    ? reports.reduce((acc, r) => ({ present: acc.present + r.data!.totals.totalPresent, eligible: acc.eligible + r.data!.totals.totalEligible }), { present: 0, eligible: 0 })
    : null;
  const pooledRate = pooled && pooled.eligible > 0 ? Math.round((pooled.present / pooled.eligible) * 10000) / 100 : null;
  const staleDevices = devices.data?.data.filter((d) => syncHealth(d).tone === "warning").length;
  const count = (key: string) => attention.items.find((i) => i.key === key)?.count;

  const singleReport = activeGroupId && reports[0]?.data;
  const trend = singleReport ? singleReport.sessions.filter((s) => s.countsTowardStatistics && s.attendanceRate !== null).map((s) => ({ date: s.occurrenceDate, title: s.title, rate: s.attendanceRate!, present: s.present, eligible: s.eligible })) : [];
  const comparison = !activeGroupId && reportsReady
    ? reports.map((r) => r.data!).filter((r) => r.totals.attendanceRate !== null).map((r) => ({ name: r.group.name, rate: r.totals.attendanceRate!, held: r.totals.heldSessions })).sort((a, b) => b.rate - a.rate)
    : [];
  const warnings = reports.flatMap((r) => (r.data ? r.data.warnings.map((w) => `${r.data!.group.name}: ${w}`) : []));
  const reportError = reports.find((r) => r.error)?.error;

  if (!groupsLoading && groups.length === 0) {
    return (
      <>
        <PageHeader title={`Welcome, ${user?.fullName.split(" ")[0] ?? ""}`} />
        <Panel>
          <EmptyState
            icon={UsersRound}
            title={user?.role === "SUPER_ADMIN" ? "No CDS groups yet" : "You have not been assigned to a CDS group"}
            description={user?.role === "SUPER_ADMIN" ? "Create the first group, then add a schedule, members, cards and devices." : "Ask a super administrator to give you access to your group."}
            action={user?.role === "SUPER_ADMIN" ? <Button asChild><Link href="/groups">Go to CDS groups</Link></Button> : undefined}
          />
        </Panel>
      </>
    );
  }

  const periodLabel = `${formatDate(range.from, { weekday: false })} – ${formatDate(range.to, { weekday: false })}`;

  return (
    <>
      <PageHeader
        title="Overview"
        description={activeGroup ? `Working in ${activeGroup.name}` : user?.role === "SUPER_ADMIN" ? "All CDS groups" : "All groups you can access"}
        actions={
          <label className="flex items-center gap-2 text-xs text-muted-foreground">
            Period
            <NativeSelect value={days} onChange={(e) => setDays(Number(e.target.value))} className="w-36">
              <option value={30}>Last 30 days</option>
              <option value={90}>Last 90 days</option>
              <option value={180}>Last 180 days</option>
            </NativeSelect>
          </label>
        }
      />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile label={activeGroupId ? "CDS group" : "Active CDS groups"} value={activeGroupId ? 1 : groups.filter((g) => g.status === "ACTIVE").length} icon={UsersRound} href="/groups" />
        <StatTile label="Current members" value={currentMembers ?? "…"} icon={Users} href="/members" hint={complete ? "Membership covering today" : `First ${FANOUT_LIMIT} groups only`} />
        <StatTile label="Sessions held" value={held.data ?? "…"} icon={CalendarCheck} href="/sessions?view=past&status=CLOSED" hint={periodLabel} />
        <StatTile
          label="Attendance rate"
          value={canReports ? (pooled ? formatPercent(pooledRate) : reportError ? "—" : "…") : "—"}
          hint={canReports ? (pooled ? `${pooled.present.toLocaleString()} of ${pooled.eligible.toLocaleString()} eligible attendances${complete ? "" : ` · first ${FANOUT_LIMIT} groups`}` : periodLabel) : "Requires report access"}
        />
      </div>

      <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile label="Awaiting resolution" value={count("unresolved") ?? "…"} icon={AlertTriangle} tone={count("unresolved") ? "warning" : "default"} href="/sessions?view=resolution" hint="Not confirmed held or cancelled" />
        <StatTile label="Rejected taps to review" value={count("rejected") ?? "…"} icon={ClipboardX} tone={count("rejected") ? "danger" : "default"} href="/attendance?tab=events&ackStatus=REJECTED&resolution=NONE" />
        {canDevices && (
          <>
            <StatTile label="Devices needing attention" value={count("pending") === undefined || count("suspended") === undefined ? "…" : (count("pending") ?? 0) + (count("suspended") ?? 0)} icon={Smartphone} href="/devices" hint={`${count("pending") ?? 0} pending · ${count("suspended") ?? 0} suspended`} />
            <StatTile
              label="Active devices not synced in 24 h"
              value={staleDevices ?? "…"}
              icon={CalendarClock}
              tone={staleDevices ? "warning" : "default"}
              href="/devices?tab=sync"
              hint={devices.data && devices.data.meta.total > 100 ? "Of the first 100 active devices" : "Readers may simply be offline; taps upload later"}
            />
          </>
        )}
      </div>

      {warnings.length > 0 && (
        <div className="mt-4 rounded-md border border-warning/30 bg-warning-soft px-3 py-2 text-sm text-[oklch(0.4_0.09_60)]">
          <p className="font-medium">Data-quality notes</p>
          <ul className="mt-1 list-disc space-y-0.5 pl-5 text-xs">
            {warnings.slice(0, 5).map((w) => (
              <li key={w}>{w}</li>
            ))}
          </ul>
        </div>
      )}

      <div className="mt-6 grid gap-6 xl:grid-cols-5">
        {canReports && (
          <Panel
            className="xl:col-span-3"
            title={activeGroupId ? "Attendance rate per held session" : "Attendance rate by group"}
            description={`${periodLabel}. Held sessions and eligible members only.`}
            actions={<Button variant="ghost" size="sm" asChild><Link href={activeGroupId ? `/reports?type=group&groupId=${activeGroupId}` : "/reports?type=compare"}>Open report</Link></Button>}
          >
            {reportError ? (
              <ErrorState error={reportError} />
            ) : !reportsReady ? (
              <BlockSkeleton className="m-4 h-56 w-auto" />
            ) : activeGroupId ? (
              trend.length >= 2 ? (
                <AttendanceTrendChart data={trend} summary={`${trend.length} held sessions. Latest ${formatPercent(trend[trend.length - 1].rate)} on ${formatDate(trend[trend.length - 1].date, { weekday: false })}.`} />
              ) : (
                <EmptyState title="Not enough held sessions yet" description="The trend appears once two or more sessions in this period are confirmed held." />
              )
            ) : comparison.length ? (
              <GroupComparisonChart data={comparison} summary={`${comparison.length} groups with held sessions in this period.`} />
            ) : (
              <EmptyState title="No held sessions in this period" />
            )}
          </Panel>
        )}
        <Panel className={canReports ? "xl:col-span-2" : "xl:col-span-5"} title="Upcoming sessions" actions={<Button variant="ghost" size="sm" asChild><Link href="/sessions">All sessions</Link></Button>}>
          <SessionsTable rows={upcoming.data?.data} isLoading={upcoming.isFetching} error={upcoming.error} onRetry={() => upcoming.refetch()} showGroup={!activeGroupId} empty={<EmptyState title="No upcoming sessions" description="Add a recurring schedule to generate expected sessions." />} />
        </Panel>
        <Panel className="xl:col-span-5" title="Most recent sessions" description="Expected sessions only count once confirmed held." actions={<Button variant="ghost" size="sm" asChild><Link href="/sessions?view=past">History</Link></Button>}>
          <SessionsTable rows={recent.data?.data} isLoading={recent.isFetching} error={recent.error} onRetry={() => recent.refetch()} showGroup={!activeGroupId} empty={<EmptyState title="No past sessions yet" />} />
        </Panel>
      </div>
    </>
  );
}
