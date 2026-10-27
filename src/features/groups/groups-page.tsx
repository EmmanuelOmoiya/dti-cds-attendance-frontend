"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Plus, UsersRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageHeader, Panel } from "@/components/common/page-header";
import { ActiveBadge } from "@/components/common/status-badge";
import { EmptyState } from "@/components/common/states";
import { DataTable, Pagination, type Column } from "@/components/data-table/data-table";
import { FilterBar, SearchFilter, SelectFilter } from "@/components/data-table/filters";
import { groupsApi } from "@/lib/api/endpoints";
import type { Group } from "@/lib/api/types";
import { useCan } from "@/lib/auth/auth-context";
import { formatDateTime } from "@/lib/datetime";
import { Permission } from "@/lib/permissions";
import { toInt, useUrlState } from "@/lib/use-url-state";
import { GroupFormDialog } from "./group-form-dialog";

export function GroupsPage() {
  const router = useRouter();
  const canCreate = useCan(Permission.GROUPS_CREATE);
  const [f, setF] = useUrlState({ q: "", status: "", page: "1", pageSize: "20", sort: "name:asc" });
  const [creating, setCreating] = useState(false);
  const params = { q: f.q || undefined, status: f.status || undefined, page: toInt(f.page, 1), pageSize: toInt(f.pageSize, 20), sort: f.sort };

  const query = useQuery({
    queryKey: ["groups", "list", params],
    queryFn: ({ signal }) => groupsApi.list(params, signal),
    placeholderData: keepPreviousData,
  });

  const columns: Column<Group>[] = [
    {
      id: "name",
      header: "Name",
      sortKey: "name",
      cell: (g) => (
        <Link href={`/groups/${g.id}`} className="font-medium hover:underline">
          {g.name}
        </Link>
      ),
    },
    { id: "description", header: "Description", hideBelow: "md", cell: (g) => <span className="line-clamp-1 text-muted-foreground">{g.description || "—"}</span> },
    { id: "status", header: "Status", sortKey: "status", cell: (g) => <ActiveBadge active={g.status === "ACTIVE"} /> },
    { id: "createdAt", header: "Created", sortKey: "createdAt", hideBelow: "sm", cell: (g) => <span className="text-muted-foreground">{formatDateTime(g.createdAt)}</span> },
  ];

  const filtered = !!(f.q || f.status);

  return (
    <>
      <PageHeader
        title="CDS groups"
        description="Community Development Service groups and their status. Open a group for members, schedules, devices and attendance."
        actions={
          canCreate && (
            <Button onClick={() => setCreating(true)}>
              <Plus /> New group
            </Button>
          )
        }
      />
      <Panel>
        <FilterBar onReset={() => setF({ q: "", status: "" })} canReset={filtered}>
          <SearchFilter value={f.q} onChange={(q) => setF({ q })} placeholder="Group name" />
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
          rowKey={(g) => g.id}
          isLoading={query.isFetching}
          error={query.error}
          onRetry={() => query.refetch()}
          sort={f.sort}
          onSortChange={(sort) => setF({ sort })}
          onRowClick={(g) => router.push(`/groups/${g.id}`)}
          caption="CDS groups"
          empty={
            <EmptyState
              icon={UsersRound}
              title={filtered ? "No groups match these filters" : "No CDS groups yet"}
              description={filtered ? "Try a different name or status." : canCreate ? "Create the first group to start adding members and schedules." : "No groups have been assigned to you."}
              action={!filtered && canCreate ? <Button onClick={() => setCreating(true)}><Plus /> New group</Button> : undefined}
            />
          }
        />
        <Pagination meta={query.data?.meta} onPageChange={(page) => setF({ page }, { resetPage: false })} onPageSizeChange={(pageSize) => setF({ pageSize })} />
      </Panel>
      <GroupFormDialog open={creating} onOpenChange={setCreating} onSaved={(g) => router.push(`/groups/${g.id}`)} />
    </>
  );
}
