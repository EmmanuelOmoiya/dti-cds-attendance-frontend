"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Plus, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageHeader, Panel } from "@/components/common/page-header";
import { ActiveBadge, Pill } from "@/components/common/status-badge";
import { EmptyState, NoAccess } from "@/components/common/states";
import { DataTable, Pagination, type Column } from "@/components/data-table/data-table";
import { FilterBar, SearchFilter, SelectFilter } from "@/components/data-table/filters";
import { usersApi } from "@/lib/api/endpoints";
import type { Role, User } from "@/lib/api/types";
import { useCan } from "@/lib/auth/auth-context";
import { formatDateTime, formatRelative } from "@/lib/datetime";
import { Permission, ROLE_LABELS } from "@/lib/permissions";
import { toInt, useUrlState } from "@/lib/use-url-state";
import { CreateUserDialog } from "./user-dialogs";

export function UsersPage() {
  const router = useRouter();
  const allowed = useCan(Permission.USERS_MANAGE);
  const [f, setF] = useUrlState({ q: "", role: "", status: "", page: "1", pageSize: "20", sort: "" });
  const [creating, setCreating] = useState(false);
  const params = { q: f.q || undefined, role: f.role || undefined, status: f.status || undefined, page: toInt(f.page, 1), pageSize: toInt(f.pageSize, 20), sort: f.sort || undefined };
  const query = useQuery({ queryKey: ["users", "list", params], queryFn: ({ signal }) => usersApi.list(params, signal), placeholderData: keepPreviousData, enabled: allowed });

  if (!allowed) return <NoAccess what="user management" />;

  const columns: Column<User>[] = [
    {
      id: "name",
      header: "User",
      sortKey: "fullName",
      cell: (u) => (
        <div>
          <Link href={`/users/${u.id}`} className="font-medium hover:underline">
            {u.fullName}
          </Link>
          <div className="text-xs text-muted-foreground">{u.email}</div>
        </div>
      ),
    },
    { id: "role", header: "Role", sortKey: "role", cell: (u) => <Pill tone={u.role === "SUPER_ADMIN" ? "brand" : "neutral"}>{ROLE_LABELS[u.role]}</Pill> },
    {
      id: "groups",
      header: "Groups",
      hideBelow: "md",
      cell: (u) => (u.role === "SUPER_ADMIN" ? <span className="text-muted-foreground">All groups</span> : u.groups.length ? <span className="line-clamp-1">{u.groups.map((g) => g.name).join(", ")}</span> : <Pill tone="warning">None</Pill>),
    },
    { id: "status", header: "Status", cell: (u) => <ActiveBadge active={u.status === "ACTIVE"} inactiveText="Disabled" /> },
    { id: "login", header: "Last sign-in", hideBelow: "lg", cell: (u) => <span className="text-muted-foreground" title={formatDateTime(u.lastLoginAt)}>{formatRelative(u.lastLoginAt)}</span> },
  ];

  return (
    <>
      <PageHeader
        title="User management"
        description="Dashboard accounts, roles and the CDS groups each scoped user can access."
        actions={
          <Button onClick={() => setCreating(true)}>
            <Plus /> New user
          </Button>
        }
      />
      <Panel>
        <FilterBar onReset={() => setF({ q: "", role: "", status: "" })} canReset={!!(f.q || f.role || f.status)}>
          <SearchFilter value={f.q} onChange={(q) => setF({ q })} placeholder="Name or email" />
          <SelectFilter label="Role" value={f.role as Role | ""} onChange={(role) => setF({ role })} options={(Object.keys(ROLE_LABELS) as Role[]).map((r) => ({ value: r, label: ROLE_LABELS[r] }))} />
          <SelectFilter
            label="Status"
            value={f.status as "" | "ACTIVE" | "DISABLED"}
            onChange={(status) => setF({ status })}
            options={[
              { value: "ACTIVE", label: "Active" },
              { value: "DISABLED", label: "Disabled" },
            ]}
          />
        </FilterBar>
        <DataTable
          columns={columns}
          rows={query.data?.data}
          rowKey={(u) => u.id}
          isLoading={query.isFetching}
          error={query.error}
          onRetry={() => query.refetch()}
          sort={f.sort}
          onSortChange={(sort) => setF({ sort })}
          onRowClick={(u) => router.push(`/users/${u.id}`)}
          caption="Users"
          empty={<EmptyState icon={ShieldCheck} title="No users match" />}
        />
        <Pagination meta={query.data?.meta} onPageChange={(page) => setF({ page }, { resetPage: false })} onPageSizeChange={(pageSize) => setF({ pageSize })} />
      </Panel>
      <CreateUserDialog open={creating} onOpenChange={setCreating} onCreated={(u) => router.push(`/users/${u.id}`)} />
    </>
  );
}
