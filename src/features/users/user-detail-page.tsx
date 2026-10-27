"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useState } from "react";
import { KeyRound, Pencil, Power, UsersRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DefinitionList, PageHeader, Panel } from "@/components/common/page-header";
import { ActiveBadge, Pill } from "@/components/common/status-badge";
import { BlockSkeleton, EmptyState, ErrorState, NoAccess } from "@/components/common/states";
import { auditApi, usersApi } from "@/lib/api/endpoints";
import { useAuth } from "@/lib/auth/auth-context";
import { formatDateTime } from "@/lib/datetime";
import { Permission, ROLE_DESCRIPTIONS, ROLE_LABELS } from "@/lib/permissions";
import { EditUserDialog, GroupScopesDialog, ResetPasswordDialog, UserStatusDialog } from "./user-dialogs";

export function UserDetailPage({ id }: { id: string }) {
  const { can, user: me } = useAuth();
  const allowed = can(Permission.USERS_MANAGE);
  const [dialog, setDialog] = useState<null | "edit" | "scopes" | "password" | "status">(null);
  const user = useQuery({ queryKey: ["users", "detail", id], queryFn: ({ signal }) => usersApi.get(id, signal), enabled: allowed });
  const activity = useQuery({ queryKey: ["audit", "list", { actorId: id, pageSize: 10 }], queryFn: ({ signal }) => auditApi.list({ actorId: id, pageSize: 10 }, signal), enabled: allowed });

  if (!allowed) return <NoAccess what="user management" />;
  const u = user.data;
  if (user.error) return <ErrorState error={user.error} onRetry={() => user.refetch()} />;
  if (!u) return <BlockSkeleton className="h-64" />;
  const isSelf = me?.id === u.id;

  return (
    <>
      <PageHeader
        breadcrumbs={[{ label: "User management", href: "/users" }, { label: u.fullName }]}
        title={u.fullName}
        description={u.email}
        meta={
          <>
            <Pill tone={u.role === "SUPER_ADMIN" ? "brand" : "neutral"}>{ROLE_LABELS[u.role]}</Pill>
            <ActiveBadge active={u.status === "ACTIVE"} inactiveText="Disabled" />
            {isSelf && <Pill tone="info">You</Pill>}
          </>
        }
        actions={
          <>
            <Button variant="outline" onClick={() => setDialog("edit")}>
              <Pencil /> Edit
            </Button>
            {u.role !== "SUPER_ADMIN" && (
              <Button variant="outline" onClick={() => setDialog("scopes")}>
                <UsersRound /> Group access
              </Button>
            )}
            <Button variant="outline" onClick={() => setDialog("password")}>
              <KeyRound /> Reset password
            </Button>
            {!isSelf && (
              <Button variant={u.status === "ACTIVE" ? "destructive" : "outline"} onClick={() => setDialog("status")}>
                <Power /> {u.status === "ACTIVE" ? "Disable" : "Enable"}
              </Button>
            )}
          </>
        }
      />
      <div className="grid gap-6 lg:grid-cols-2">
        <Panel title="Account">
          <DefinitionList
            items={[
              { label: "Role", value: ROLE_LABELS[u.role] },
              { label: "What this role can do", value: ROLE_DESCRIPTIONS[u.role] },
              { label: "Last sign-in", value: formatDateTime(u.lastLoginAt) },
              { label: "Created", value: formatDateTime(u.createdAt) },
            ]}
          />
        </Panel>
        <Panel title="Group access">
          {u.role === "SUPER_ADMIN" ? (
            <p className="p-4 text-sm text-muted-foreground">Super admins can access every CDS group.</p>
          ) : u.groups.length === 0 ? (
            <EmptyState title="No groups assigned" description="This user can sign in but sees no data until groups are assigned." />
          ) : (
            <ul className="divide-y">
              {u.groups.map((g) => (
                <li key={g.id} className="px-4 py-2.5 text-sm">
                  <Link className="hover:underline" href={`/groups/${g.id}`}>
                    {g.name}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Panel>
        <Panel title="Recent activity" className="lg:col-span-2" actions={<Button variant="ghost" size="sm" asChild><Link href={`/audit?actorId=${u.id}`}>Full audit trail</Link></Button>}>
          {activity.error ? (
            <ErrorState error={activity.error} />
          ) : !activity.data ? (
            <BlockSkeleton className="m-4 h-16 w-auto" />
          ) : activity.data.data.length === 0 ? (
            <EmptyState title="No recorded activity" />
          ) : (
            <ul className="divide-y">
              {activity.data.data.map((l) => (
                <li key={l.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-2 text-sm">
                  <span className="font-mono text-xs">{l.action}</span>
                  <span className="text-xs text-muted-foreground tabular-nums">{formatDateTime(l.createdAt)}</span>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>
      <EditUserDialog user={u} open={dialog === "edit"} onOpenChange={(o) => !o && setDialog(null)} isSelf={isSelf} />
      <GroupScopesDialog user={u} open={dialog === "scopes"} onOpenChange={(o) => !o && setDialog(null)} />
      <ResetPasswordDialog user={u} open={dialog === "password"} onOpenChange={(o) => !o && setDialog(null)} />
      <UserStatusDialog user={u} open={dialog === "status"} onOpenChange={(o) => !o && setDialog(null)} />
    </>
  );
}
