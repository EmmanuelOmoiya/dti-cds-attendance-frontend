"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Plus, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageHeader, Panel } from "@/components/common/page-header";
import { ActiveBadge, Pill } from "@/components/common/status-badge";
import { EmptyState } from "@/components/common/states";
import { DataTable, Pagination, type Column } from "@/components/data-table/data-table";
import { FilterBar, GroupFilter, SearchFilter, SelectFilter } from "@/components/data-table/filters";
import { membersApi } from "@/lib/api/endpoints";
import type { Member } from "@/lib/api/types";
import { useCan } from "@/lib/auth/auth-context";
import { formatInstantDate } from "@/lib/datetime";
import { useGroups } from "@/lib/group-context";
import { Permission } from "@/lib/permissions";
import { toInt, useUrlState } from "@/lib/use-url-state";
import { MemberFormDialog } from "./member-dialogs";

export function MembersPage() {
  const router = useRouter();
  const canWrite = useCan(Permission.MEMBERS_WRITE);
  const { activeGroupId } = useGroups();
  const [f, setF] = useUrlState({ q: "", groupId: "", membership: "current", status: "", page: "1", pageSize: "20", sort: "fullName:asc" });
  const [creating, setCreating] = useState(false);
  const groupId = f.groupId || activeGroupId || undefined;
  const params = {
    q: f.q || undefined,
    groupId,
    membership: groupId ? (f.membership as "current" | "any") : undefined,
    status: f.status || undefined,
    page: toInt(f.page, 1),
    pageSize: toInt(f.pageSize, 20),
    sort: f.sort,
  };
  const query = useQuery({ queryKey: ["members", "list", params], queryFn: ({ signal }) => membersApi.list(params, signal), placeholderData: keepPreviousData });

  const columns: Column<Member>[] = [
    {
      id: "name",
      header: "Member",
      sortKey: "fullName",
      cell: (m) => (
        <Link href={`/members/${m.id}`} className="font-medium hover:underline">
          {m.fullName}
        </Link>
      ),
    },
    { id: "stateCode", header: "State code", sortKey: "stateCode", cell: (m) => <span className="font-mono text-xs">{m.stateCode}</span> },
    {
      id: "group",
      header: "Current group",
      hideBelow: "md",
      cell: (m) =>
        m.currentGroup ? (
          <div>
            <span>{m.currentGroup.name}</span>
            {m.currentMembership && <span className="block text-xs text-muted-foreground">since {formatInstantDate(m.currentMembership.joinedAt)}</span>}
          </div>
        ) : (
          <span className="text-muted-foreground">No current group</span>
        ),
    },
    {
      id: "card",
      header: "Card",
      hideBelow: "lg",
      cell: (m) => (m.activeCard ? <span className="font-mono text-xs">{m.activeCard.label ?? m.activeCard.cardUid}</span> : <Pill tone="warning">No card</Pill>),
    },
    { id: "status", header: "Status", sortKey: "status", cell: (m) => <ActiveBadge active={m.status === "ACTIVE"} /> },
  ];

  const filtered = !!(f.q || f.groupId || f.status || f.membership !== "current");
  return (
    <>
      <PageHeader
        title="Members"
        description="Corps members and their group memberships. A person's membership history is kept separately from their identity, so transfers and re-joins never rewrite the past."
        actions={
          canWrite && (
            <Button onClick={() => setCreating(true)}>
              <Plus /> Register member
            </Button>
          )
        }
      />
      <Panel>
        <FilterBar onReset={() => setF({ q: "", groupId: "", status: "", membership: "current" })} canReset={filtered}>
          <SearchFilter value={f.q} onChange={(q) => setF({ q })} placeholder="Name or state code" />
          <GroupFilter value={f.groupId || activeGroupId || ""} onChange={(groupId) => setF({ groupId })} />
          {groupId && (
            <SelectFilter
              label="Membership"
              value={f.membership as "current" | "any"}
              onChange={(membership) => setF({ membership: membership || "current" })}
              allLabel="Current members"
              options={[{ value: "any", label: "Anyone who was ever a member" }]}
            />
          )}
          <SelectFilter
            label="Status"
            value={f.status as "" | "ACTIVE" | "INACTIVE"}
            onChange={(status) => setF({ status })}
            options={[
              { value: "ACTIVE", label: "Active" },
              { value: "INACTIVE", label: "Inactive" },
            ]}
          />
        </FilterBar>
        <DataTable
          columns={columns}
          rows={query.data?.data}
          rowKey={(m) => m.id}
          isLoading={query.isFetching}
          error={query.error}
          onRetry={() => query.refetch()}
          sort={f.sort}
          onSortChange={(sort) => setF({ sort })}
          onRowClick={(m) => router.push(`/members/${m.id}`)}
          caption="Members"
          empty={
            <EmptyState
              icon={Users}
              title={filtered ? "No members match" : "No members yet"}
              description={filtered ? "Check the spelling, or widen the membership filter." : "Register corps members to start taking attendance."}
              action={!filtered && canWrite ? <Button onClick={() => setCreating(true)}><Plus /> Register member</Button> : undefined}
            />
          }
        />
        <Pagination meta={query.data?.meta} onPageChange={(page) => setF({ page }, { resetPage: false })} onPageSizeChange={(pageSize) => setF({ pageSize })} />
      </Panel>
      <MemberFormDialog open={creating} onOpenChange={setCreating} onSaved={(m) => router.push(`/members/${m.id}`)} />
    </>
  );
}
