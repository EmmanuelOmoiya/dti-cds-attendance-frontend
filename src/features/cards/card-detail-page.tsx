"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useState } from "react";
import { Ban, Undo2, UserMinus, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ActionDialog, Consequence } from "@/components/common/action-dialog";
import { DefinitionList, PageHeader, Panel } from "@/components/common/page-header";
import { CardStatusBadge, Pill } from "@/components/common/status-badge";
import { BlockSkeleton, EmptyState, ErrorState } from "@/components/common/states";
import { DataTable, type Column } from "@/components/data-table/data-table";
import { cardsApi } from "@/lib/api/endpoints";
import type { CardAssignment } from "@/lib/api/types";
import { useAuth } from "@/lib/auth/auth-context";
import { formatDateTime } from "@/lib/datetime";
import { ASSIGNMENT_END_REASON_LABELS, CARD_REVOKE_REASON_LABELS, label } from "@/lib/labels";
import { Permission } from "@/lib/permissions";
import { useApiMutation } from "@/lib/use-api-mutation";
import { AssignCardDialog, CARD_INVALIDATE, EndAssignmentDialog, RevokeCardDialog } from "./card-dialogs";

export function CardDetailPage({ id }: { id: string }) {
  const { can, user } = useAuth();
  const canWrite = can(Permission.CARDS_WRITE);
  const [dialog, setDialog] = useState<null | "assign" | "revoke" | "reinstate">(null);
  const [ending, setEnding] = useState<CardAssignment | null>(null);
  const card = useQuery({ queryKey: ["cards", "detail", id], queryFn: ({ signal }) => cardsApi.get(id, signal) });
  const reinstate = useApiMutation({ mutationFn: () => cardsApi.reinstate(id), invalidate: CARD_INVALIDATE, success: "Card returned to stock", onSuccess: () => setDialog(null) });

  const c = card.data;
  if (card.error) return <ErrorState error={card.error} onRetry={() => card.refetch()} />;
  if (!c) return <BlockSkeleton className="h-64" />;

  const columns: Column<CardAssignment>[] = [
    {
      id: "member",
      header: "Holder",
      cell: (a) => (
        <div>
          <Link href={`/members/${a.member.id}`} className="font-medium hover:underline">
            {a.member.fullName}
          </Link>
          <div className="font-mono text-xs text-muted-foreground">{a.member.stateCode}</div>
        </div>
      ),
    },
    { id: "from", header: "From", cell: (a) => <span className="whitespace-nowrap tabular-nums">{formatDateTime(a.assignedAt)}</span> },
    { id: "to", header: "Until", cell: (a) => <span className="whitespace-nowrap tabular-nums">{a.endedAt ? formatDateTime(a.endedAt) : "—"}</span> },
    {
      id: "status",
      header: "Status",
      cell: (a) => (
        <div className="flex flex-col items-start gap-0.5">
          {a.status === "ACTIVE" ? <Pill tone="success">Active</Pill> : <Pill tone="muted">{label(ASSIGNMENT_END_REASON_LABELS, a.endReason, "Ended")}</Pill>}
          {a.endNote && <span className="text-xs text-muted-foreground">{a.endNote}</span>}
        </div>
      ),
    },
  ];

  return (
    <>
      <PageHeader
        breadcrumbs={[{ label: "NFC cards", href: "/cards" }, { label: c.cardUid }]}
        title={<span className="font-mono">{c.cardUid}</span>}
        description={c.label ? `Label: ${c.label}` : undefined}
        meta={<CardStatusBadge status={c.status} />}
        actions={
          canWrite && (
            <>
              {c.status === "UNASSIGNED" && (
                <Button onClick={() => setDialog("assign")}>
                  <UserPlus /> Assign to member
                </Button>
              )}
              {c.currentAssignment && (
                <Button variant="outline" onClick={() => setEnding(c.currentAssignment)}>
                  <UserMinus /> Take back
                </Button>
              )}
              {c.status !== "REVOKED" ? (
                <Button variant="destructive" onClick={() => setDialog("revoke")}>
                  <Ban /> Revoke
                </Button>
              ) : (
                <Button variant="outline" onClick={() => setDialog("reinstate")}>
                  <Undo2 /> Reinstate
                </Button>
              )}
            </>
          )
        }
      />
      <div className="grid gap-6 lg:grid-cols-3">
        <Panel title="Card" className="lg:col-span-1">
          <DefinitionList
            columns={1}
            items={[
              { label: "UID", value: <span className="font-mono">{c.cardUid}</span> },
              { label: "Status", value: <CardStatusBadge status={c.status} /> },
              { label: "Current holder", value: c.currentAssignment ? <Link className="hover:underline" href={`/members/${c.currentAssignment.member.id}`}>{c.currentAssignment.member.fullName}</Link> : "—" },
              ...(c.status === "REVOKED"
                ? [
                    { label: "Revoked", value: formatDateTime(c.revokedAt) },
                    { label: "Revoke reason", value: `${label(CARD_REVOKE_REASON_LABELS, c.revokeReason)}${c.revokeNote ? ` · ${c.revokeNote}` : ""}` },
                  ]
                : []),
              { label: "Registered", value: formatDateTime(c.createdAt) },
            ]}
          />
        </Panel>
        <Panel
          title="Assignment history"
          description={user?.role === "SUPER_ADMIN" ? "Every holder of this card." : "Holders from your groups only; holders in other groups are hidden."}
          className="lg:col-span-2"
        >
          <DataTable columns={columns} rows={c.assignments} rowKey={(a) => a.id} caption="Card assignment history" empty={<EmptyState title="Never assigned" />} />
        </Panel>
      </div>
      <AssignCardDialog open={dialog === "assign"} onOpenChange={(o) => !o && setDialog(null)} card={c} />
      <RevokeCardDialog card={c} open={dialog === "revoke"} onOpenChange={(o) => !o && setDialog(null)} />
      <EndAssignmentDialog assignment={ending} onClose={() => setEnding(null)} />
      <ActionDialog
        open={dialog === "reinstate"}
        onOpenChange={(o) => {
          if (!o) {
            setDialog(null);
            reinstate.reset();
          }
        }}
        title="Reinstate this card?"
        confirmLabel="Return to stock"
        pending={reinstate.isPending}
        error={reinstate.error}
        onSubmit={() => reinstate.mutate()}
      >
        <Consequence tone="info">The card was found or repaired. It returns to stock as unassigned and can be given to a member again. Its history is kept.</Consequence>
      </ActionDialog>
    </>
  );
}
