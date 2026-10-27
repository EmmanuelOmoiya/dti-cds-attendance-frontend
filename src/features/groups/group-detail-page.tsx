"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useState } from "react";
import { CalendarClock, Pencil, Power, PowerOff, Smartphone, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ActionDialog, Consequence } from "@/components/common/action-dialog";
import { DefinitionList, PageHeader, Panel, StatTile } from "@/components/common/page-header";
import { ActiveBadge, Pill } from "@/components/common/status-badge";
import { BlockSkeleton, EmptyState, ErrorState } from "@/components/common/states";
import { DevicesTable } from "@/features/devices/devices-table";
import { SchedulesTable } from "@/features/schedules/schedules-table";
import { SessionsTable } from "@/features/sessions/sessions-table";
import { devicesApi, groupsApi, reportsApi, schedulesApi, sessionsApi } from "@/lib/api/endpoints";
import { apiListAll } from "@/lib/api/client";
import type { User } from "@/lib/api/types";
import { useCan } from "@/lib/auth/auth-context";
import { addDays, formatDate, formatDateTime, formatPercent, todayInZone } from "@/lib/datetime";
import { Permission, ROLE_LABELS } from "@/lib/permissions";
import { useApiMutation } from "@/lib/use-api-mutation";
import { GroupFormDialog } from "./group-form-dialog";

export function GroupDetailPage({ id }: { id: string }) {
  const canUpdate = useCan(Permission.GROUPS_UPDATE);
  const canToggle = useCan(Permission.GROUPS_CREATE);
  const canDevices = useCan(Permission.DEVICES_READ);
  const canUsers = useCan(Permission.USERS_MANAGE);
  const canReports = useCan(Permission.REPORTS_READ);
  const [editing, setEditing] = useState(false);
  const [toggling, setToggling] = useState(false);

  const group = useQuery({ queryKey: ["groups", "detail", id], queryFn: ({ signal }) => groupsApi.get(id, signal) });
  const today = todayInZone();
  const reportRange = { from: addDays(today, -90), to: today };

  const report = useQuery({
    queryKey: ["reports", "group", id, reportRange],
    queryFn: ({ signal }) => reportsApi.group(id, reportRange, signal),
    enabled: canReports && group.isSuccess,
  });
  const schedules = useQuery({
    queryKey: ["schedules", "list", { groupId: id, pageSize: 20 }],
    queryFn: ({ signal }) => schedulesApi.list({ groupId: id, pageSize: 20 }, signal),
    enabled: group.isSuccess,
  });
  const upcoming = useQuery({
    queryKey: ["sessions", "list", { groupId: id, from: today, sort: "plannedStart:asc", pageSize: 5 }],
    queryFn: ({ signal }) => sessionsApi.list({ groupId: id, from: today, sort: "plannedStart:asc", pageSize: 5 }, signal),
    enabled: group.isSuccess,
  });
  const devices = useQuery({
    queryKey: ["devices", "list", { groupId: id, pageSize: 20 }],
    queryFn: ({ signal }) => devicesApi.list({ groupId: id, pageSize: 20 }, signal),
    enabled: canDevices && group.isSuccess,
  });
  const admins = useQuery({
    queryKey: ["users", "all"],
    queryFn: ({ signal }) => apiListAll<User>("/users", {}, signal),
    enabled: canUsers && group.isSuccess,
    select: (r) => r.data.filter((u) => u.groups.some((g) => g.id === id)),
  });

  const g = group.data;
  const toggle = useApiMutation({
    mutationFn: () => (g!.status === "ACTIVE" ? groupsApi.deactivate(id) : groupsApi.activate(id)),
    invalidate: [["groups"]],
    success: (r) => (r.status === "ACTIVE" ? "Group activated" : "Group deactivated"),
    onSuccess: () => setToggling(false),
  });

  if (group.error) return <ErrorState error={group.error} onRetry={() => group.refetch()} />;
  if (!g) return <BlockSkeleton className="h-64" />;

  const t = report.data?.totals;

  return (
    <>
      <PageHeader
        breadcrumbs={[{ label: "CDS groups", href: "/groups" }, { label: g.name }]}
        title={g.name}
        description={g.description || undefined}
        meta={<ActiveBadge active={g.status === "ACTIVE"} />}
        actions={
          <>
            {canUpdate && (
              <Button variant="outline" onClick={() => setEditing(true)}>
                <Pencil /> Edit
              </Button>
            )}
            {canToggle && (
              <Button variant="outline" onClick={() => setToggling(true)}>
                {g.status === "ACTIVE" ? <PowerOff /> : <Power />}
                {g.status === "ACTIVE" ? "Deactivate" : "Activate"}
              </Button>
            )}
          </>
        }
      />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile label="Current members" value={g.stats.activeMembers} icon={Users} href={`/members?groupId=${id}`} hint="Membership covering today" />
        <StatTile label="Active schedules" value={g.stats.activeSchedules} icon={CalendarClock} href={`/schedules?groupId=${id}`} />
        <StatTile label="Devices" value={g.stats.devices} icon={Smartphone} href={canDevices ? `/devices?groupId=${id}` : undefined} hint="All statuses" />
        <StatTile
          label="Attendance rate (90 days)"
          value={canReports ? (report.isPending ? "…" : formatPercent(t?.attendanceRate)) : "—"}
          hint={t ? `${t.totalPresent} of ${t.totalEligible} eligible attendances over ${t.heldSessions} held sessions` : canReports ? undefined : "Requires report access"}
        />
      </div>

      {report.data && report.data.warnings.length > 0 && (
        <div className="mt-4 space-y-2">
          {report.data.warnings.map((w) => (
            <Consequence key={w}>{w}</Consequence>
          ))}
        </div>
      )}

      <div className="mt-6 grid gap-6 xl:grid-cols-2">
        <Panel
          title="Upcoming sessions"
          description="Expected from schedules or added ad hoc. Expected sessions are not confirmed meetings."
          actions={<Button variant="ghost" size="sm" asChild><Link href={`/sessions?groupId=${id}`}>All sessions</Link></Button>}
        >
          <SessionsTable
            rows={upcoming.data?.data}
            isLoading={upcoming.isFetching}
            error={upcoming.error}
            onRetry={() => upcoming.refetch()}
            showGroup={false}
            empty={<EmptyState title="No upcoming sessions" description="Create a recurring schedule or an ad-hoc session." />}
          />
        </Panel>
        <Panel title="Recurring schedules" actions={<Button variant="ghost" size="sm" asChild><Link href={`/schedules?groupId=${id}`}>Manage</Link></Button>}>
          <SchedulesTable rows={schedules.data?.data} isLoading={schedules.isFetching} error={schedules.error} onRetry={() => schedules.refetch()} showGroup={false} empty={<EmptyState title="No schedules for this group" />} />
        </Panel>
        {canDevices && (
          <Panel title="Devices" actions={<Button variant="ghost" size="sm" asChild><Link href={`/devices?groupId=${id}`}>All devices</Link></Button>}>
            <DevicesTable rows={devices.data?.data} isLoading={devices.isFetching} error={devices.error} onRetry={() => devices.refetch()} showGroup={false} empty={<EmptyState title="No devices assigned to this group" />} />
          </Panel>
        )}
        {canReports && (
          <Panel
            title="Recent attendance"
            description={`Held sessions from ${formatDate(reportRange.from, { weekday: false })} to ${formatDate(reportRange.to, { weekday: false })}`}
            actions={<Button variant="ghost" size="sm" asChild><Link href={`/reports?type=group&groupId=${id}`}>Full report</Link></Button>}
          >
            {report.error ? (
              <ErrorState error={report.error} onRetry={() => report.refetch()} />
            ) : !report.data ? (
              <BlockSkeleton className="m-4 h-24 w-auto" />
            ) : (
              <DefinitionList
                columns={3}
                items={[
                  { label: "Held sessions", value: t!.heldSessions },
                  { label: "Pooled attendance rate", value: formatPercent(t!.attendanceRate), hint: "Total present ÷ total eligible" },
                  { label: "Mean per-session rate", value: formatPercent(t!.meanSessionAttendanceRate) },
                  { label: "Cancelled", value: report.data.excluded.cancelled },
                  { label: "Unresolved", value: report.data.excluded.unresolved },
                  { label: "Still scheduled", value: report.data.excluded.scheduled },
                ]}
              />
            )}
          </Panel>
        )}
        {canUsers && (
          <Panel title="Assigned administrators & viewers" description="Users whose access is scoped to this group." actions={<Button variant="ghost" size="sm" asChild><Link href="/users">Manage users</Link></Button>}>
            {admins.error ? (
              <ErrorState error={admins.error} onRetry={() => admins.refetch()} />
            ) : !admins.data ? (
              <BlockSkeleton className="m-4 h-16 w-auto" />
            ) : admins.data.length === 0 ? (
              <EmptyState title="No users are scoped to this group" description="Super admins can access every group." />
            ) : (
              <ul className="divide-y">
                {admins.data.map((u) => (
                  <li key={u.id} className="flex items-center justify-between gap-3 px-4 py-2.5">
                    <div className="min-w-0">
                      <Link href={`/users/${u.id}`} className="text-sm font-medium hover:underline">
                        {u.fullName}
                      </Link>
                      <p className="truncate text-xs text-muted-foreground">{u.email}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Pill tone="neutral">{ROLE_LABELS[u.role]}</Pill>
                      {u.status === "DISABLED" && <Pill tone="muted">Disabled</Pill>}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        )}
      </div>

      <p className="mt-6 text-xs text-muted-foreground">Created {formatDateTime(g.createdAt)} · Updated {formatDateTime(g.updatedAt)}</p>

      <GroupFormDialog open={editing} onOpenChange={setEditing} group={g} />
      <ActionDialog
        open={toggling}
        onOpenChange={(o) => {
          setToggling(o);
          if (!o) toggle.reset();
        }}
        title={g.status === "ACTIVE" ? `Deactivate ${g.name}?` : `Activate ${g.name}?`}
        confirmLabel={g.status === "ACTIVE" ? "Deactivate group" : "Activate group"}
        destructive={g.status === "ACTIVE"}
        pending={toggle.isPending}
        error={toggle.error}
        onSubmit={() => toggle.mutate()}
      >
        {g.status === "ACTIVE" ? (
          <Consequence tone="danger">
            Members, sessions and devices cannot be added to an inactive group, and its devices will be refused when they try to synchronize. Existing history is kept. Open sessions must be closed first.
          </Consequence>
        ) : (
          <Consequence tone="info">The group will accept new members, schedules and sessions again, and its active devices can synchronize.</Consequence>
        )}
      </ActionDialog>
    </>
  );
}
