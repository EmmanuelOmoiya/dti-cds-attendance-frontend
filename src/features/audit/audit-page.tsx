"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { ScrollText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DefinitionList, PageHeader, Panel } from "@/components/common/page-header";
import { Pill, type Tone } from "@/components/common/status-badge";
import { EmptyState } from "@/components/common/states";
import { DataTable, Pagination, type Column } from "@/components/data-table/data-table";
import { DateRangeFilter, FilterBar, GroupFilter, SelectFilter } from "@/components/data-table/filters";
import { apiListAll } from "@/lib/api/client";
import { auditApi } from "@/lib/api/endpoints";
import type { AuditLog, User } from "@/lib/api/types";
import { useCan } from "@/lib/auth/auth-context";
import { dayRangeToInstants, formatDateTime } from "@/lib/datetime";
import { useGroups } from "@/lib/group-context";
import { Permission } from "@/lib/permissions";
import { toInt, useUrlState } from "@/lib/use-url-state";

const ENTITY_TYPES = ["AttendanceSession", "AttendanceRecord", "AttendanceEvent", "Member", "GroupMembership", "Card", "CardAssignment", "Device", "CdsGroup", "CdsSchedule", "User"];
const ACTION_PREFIXES = [
  { value: "session.", label: "Sessions" },
  { value: "attendance.", label: "Attendance corrections" },
  { value: "member.", label: "Members" },
  { value: "membership.", label: "Memberships" },
  { value: "card", label: "Cards" },
  { value: "device.", label: "Devices" },
  { value: "sync.", label: "Synchronization" },
  { value: "schedule.", label: "Schedules" },
  { value: "group.", label: "Groups" },
  { value: "user.", label: "Users" },
  { value: "auth.", label: "Sign-in & security" },
];

/** Outcome is inferred only from the action name the backend recorded (e.g. auth.login.failed). */
function outcome(action: string): { tone: Tone; text: string } {
  if (/failed|reuse_detected|auth_failed/.test(action)) return { tone: "danger", text: "Failure" };
  if (/revoked|decommissioned|voided|cancelled|disabled|deactivated/.test(action)) return { tone: "warning", text: "Change" };
  return { tone: "neutral", text: "Success" };
}

const SECRET_KEY = /pass(word)?|secret|token|hash|authorization|cookie/i;
/** Defence in depth: the backend already redacts credentials; never render such keys anyway. */
export function redactForDisplay(value: unknown, depth = 0): unknown {
  if (depth > 8 || value === null || typeof value !== "object") return value;
  if (Array.isArray(value)) return value.map((v) => redactForDisplay(v, depth + 1));
  return Object.fromEntries(Object.entries(value as Record<string, unknown>).map(([k, v]) => [k, SECRET_KEY.test(k) ? "[REDACTED]" : redactForDisplay(v, depth + 1)]));
}

export function AuditPage() {
  const canUsers = useCan(Permission.USERS_MANAGE);
  const { activeGroupId, groupName } = useGroups();
  const [f, setF] = useUrlState({ from: "", to: "", action: "", entityType: "", entityId: "", actorId: "", groupId: "", page: "1", pageSize: "50" });
  const [selected, setSelected] = useState<AuditLog | null>(null);
  const [entityDraft, setEntityDraft] = useState(f.entityId);

  const users = useQuery({
    queryKey: ["users", "all"],
    queryFn: ({ signal }) => apiListAll<User>("/users", {}, signal),
    enabled: canUsers,
    staleTime: 5 * 60_000,
    select: (r) => new Map(r.data.map((u) => [u.id, u])),
  });

  const instants = dayRangeToInstants(f.from || undefined, f.to || undefined);
  const params = {
    ...instants,
    action: f.action || undefined,
    entityType: f.entityType || undefined,
    entityId: f.entityId || undefined,
    actorId: f.actorId || undefined,
    groupId: f.groupId || activeGroupId || undefined,
    page: toInt(f.page, 1),
    pageSize: toInt(f.pageSize, 50),
  };
  const query = useQuery({ queryKey: ["audit", "list", params], queryFn: ({ signal }) => auditApi.list(params, signal), placeholderData: keepPreviousData });

  const actorName = (log: AuditLog) => {
    if (log.actorType === "SYSTEM") return "System";
    if (log.actorType === "ANONYMOUS") return "Anonymous";
    if (log.actorType === "DEVICE") return `Device …${log.actorId?.slice(-6) ?? ""}`;
    const u = log.actorId ? users.data?.get(log.actorId) : undefined;
    return u ? u.fullName : `User …${log.actorId?.slice(-6) ?? ""}`;
  };

  const columns: Column<AuditLog>[] = [
    { id: "time", header: "Time", cell: (l) => <span className="whitespace-nowrap tabular-nums">{formatDateTime(l.createdAt)}</span> },
    {
      id: "actor",
      header: "Actor",
      cell: (l) => (
        <button type="button" className="text-left hover:underline" onClick={() => l.actorId && setF({ actorId: l.actorId })} title="Filter by this actor">
          {actorName(l)}
        </button>
      ),
    },
    { id: "action", header: "Action", cell: (l) => <span className="font-mono text-xs">{l.action}</span> },
    { id: "resource", header: "Resource", hideBelow: "md", cell: (l) => <span className="text-xs">{l.entityType}{l.entityId ? <span className="text-muted-foreground"> …{l.entityId.slice(-8)}</span> : null}</span> },
    { id: "group", header: "Group", hideBelow: "lg", cell: (l) => <span className="text-muted-foreground">{l.groupId ? groupName(l.groupId) : "—"}</span> },
    { id: "outcome", header: "Outcome", hideBelow: "sm", cell: (l) => <Pill tone={outcome(l.action).tone}>{outcome(l.action).text}</Pill> },
    { id: "view", header: <span className="sr-only">Details</span>, className: "text-right", cell: (l) => <Button variant="ghost" size="xs" onClick={() => setSelected(l)}>Details</Button> },
  ];

  const filtered = !!(f.from || f.to || f.action || f.entityType || f.entityId || f.actorId || f.groupId);

  return (
    <>
      <PageHeader title="Audit logs" description="Append-only record of every change, sign-in and device authentication. Read-only. CDS admins see entries tied to their groups." />
      <Panel>
        <FilterBar onReset={() => { setEntityDraft(""); setF({ from: "", to: "", action: "", entityType: "", entityId: "", actorId: "", groupId: "" }); }} canReset={filtered}>
          <DateRangeFilter from={f.from} to={f.to} onChange={(r) => setF(r)} />
          <SelectFilter label="Action" value={f.action} onChange={(action) => setF({ action })} options={ACTION_PREFIXES} />
          <SelectFilter label="Resource type" value={f.entityType} onChange={(entityType) => setF({ entityType })} options={ENTITY_TYPES.map((t) => ({ value: t, label: t }))} />
          <label className="grid gap-1 text-xs font-medium text-muted-foreground sm:w-56">
            Resource ID
            <Input value={entityDraft} onChange={(e) => setEntityDraft(e.target.value)} onBlur={() => setF({ entityId: entityDraft.trim() })} onKeyDown={(e) => e.key === "Enter" && setF({ entityId: entityDraft.trim() })} placeholder="Full ID" className="font-mono text-xs" />
          </label>
          {canUsers && users.data && (
            <SelectFilter
              label="Actor"
              value={f.actorId}
              onChange={(actorId) => setF({ actorId })}
              options={[...users.data.values()].map((u) => ({ value: u.id, label: u.fullName }))}
              allLabel="Anyone"
            />
          )}
          {!canUsers && f.actorId && <Pill tone="info">Actor …{f.actorId.slice(-6)}</Pill>}
          <GroupFilter value={f.groupId || activeGroupId || ""} onChange={(groupId) => setF({ groupId })} />
        </FilterBar>
        <DataTable
          columns={columns}
          rows={query.data?.data}
          rowKey={(l) => l.id}
          isLoading={query.isFetching}
          error={query.error}
          onRetry={() => query.refetch()}
          caption="Audit log"
          empty={<EmptyState icon={ScrollText} title="No audit entries match" />}
        />
        <Pagination meta={query.data?.meta} onPageChange={(page) => setF({ page }, { resetPage: false })} onPageSizeChange={(pageSize) => setF({ pageSize })} pageSizes={[20, 50, 100]} />
      </Panel>
      <Dialog open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle className="font-mono text-sm">{selected?.action}</DialogTitle>
          </DialogHeader>
          {selected && (
            <>
              <DefinitionList
                items={[
                  { label: "Time", value: formatDateTime(selected.createdAt) },
                  { label: "Actor", value: `${actorName(selected)} (${selected.actorType})` },
                  { label: "Resource", value: `${selected.entityType}${selected.entityId ? ` ${selected.entityId}` : ""}` },
                  { label: "Group", value: selected.groupId ? groupName(selected.groupId) : "—" },
                  { label: "Request ID", value: <span className="font-mono text-xs">{selected.requestId ?? "—"}</span> },
                  { label: "IP address", value: selected.ip ?? "—" },
                ]}
              />
              <div className="px-4 pb-2">
                <p className="mb-1 text-xs font-medium text-muted-foreground">Details</p>
                <pre className="max-h-80 overflow-auto rounded-md bg-muted p-3 text-xs leading-relaxed">{selected.metadata ? JSON.stringify(redactForDisplay(selected.metadata), null, 2) : "No additional details"}</pre>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
