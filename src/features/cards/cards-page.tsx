"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { CreditCard, Plus, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PageHeader, Panel } from "@/components/common/page-header";
import { CardStatusBadge } from "@/components/common/status-badge";
import { EmptyState } from "@/components/common/states";
import { DataTable, Pagination, type Column } from "@/components/data-table/data-table";
import { FilterBar, SearchFilter } from "@/components/data-table/filters";
import { cardsApi } from "@/lib/api/endpoints";
import type { CardWithCurrent } from "@/lib/api/types";
import { useCan } from "@/lib/auth/auth-context";
import { formatDateTime } from "@/lib/datetime";
import { CARD_REVOKE_REASON_LABELS, label } from "@/lib/labels";
import { Permission } from "@/lib/permissions";
import { toInt, useUrlState } from "@/lib/use-url-state";
import { AssignCardDialog, isValidUid, RegisterCardDialog } from "./card-dialogs";

export function CardsPage() {
  const router = useRouter();
  const canWrite = useCan(Permission.CARDS_WRITE);
  const [f, setF] = useUrlState({ status: "", uid: "", page: "1", pageSize: "20", sort: "" });
  const [dialog, setDialog] = useState<null | "register" | "assign">(null);
  const uidValid = !f.uid || isValidUid(f.uid);
  const params = { status: f.status || undefined, cardUid: f.uid && uidValid ? f.uid : undefined, page: toInt(f.page, 1), pageSize: toInt(f.pageSize, 20), sort: f.sort || undefined };
  const query = useQuery({
    queryKey: ["cards", "list", params],
    queryFn: ({ signal }) => cardsApi.list(params, signal),
    placeholderData: keepPreviousData,
    enabled: uidValid,
  });

  const columns: Column<CardWithCurrent>[] = [
    {
      id: "uid",
      header: "Card UID",
      sortKey: "cardUid",
      cell: (c) => (
        <div>
          <Link href={`/cards/${c.id}`} className="font-mono text-sm font-medium hover:underline">
            {c.cardUid}
          </Link>
          {c.label && <div className="text-xs text-muted-foreground">{c.label}</div>}
        </div>
      ),
    },
    { id: "status", header: "Status", sortKey: "status", cell: (c) => <CardStatusBadge status={c.status} /> },
    {
      id: "holder",
      header: "Current holder",
      cell: (c) =>
        c.currentAssignment ? (
          <div>
            <Link href={`/members/${c.currentAssignment.member.id}`} className="hover:underline">
              {c.currentAssignment.member.fullName}
            </Link>
            <div className="text-xs text-muted-foreground">since {formatDateTime(c.currentAssignment.assignedAt)}</div>
          </div>
        ) : c.status === "REVOKED" ? (
          <span className="text-muted-foreground">{label(CARD_REVOKE_REASON_LABELS, c.revokeReason)}</span>
        ) : (
          <span className="text-muted-foreground">—</span>
        ),
    },
    { id: "created", header: "Registered", sortKey: "createdAt", hideBelow: "md", cell: (c) => <span className="text-muted-foreground">{formatDateTime(c.createdAt)}</span> },
  ];

  return (
    <>
      <PageHeader
        title="NFC cards"
        description="Shared card inventory. A card is assigned to a person for a period and returns to stock afterwards; it never belongs to a group. Assignment history is always kept."
        actions={
          canWrite && (
            <>
              <Button variant="outline" onClick={() => setDialog("register")}>
                <Plus /> Register card
              </Button>
              <Button onClick={() => setDialog("assign")}>
                <UserPlus /> Assign card
              </Button>
            </>
          )
        }
      />
      <Tabs value={f.status || "all"} onValueChange={(v) => setF({ status: v === "all" ? "" : v })} className="mb-3">
        <TabsList>
          <TabsTrigger value="all">All</TabsTrigger>
          <TabsTrigger value="UNASSIGNED">In stock</TabsTrigger>
          <TabsTrigger value="ASSIGNED">Assigned</TabsTrigger>
          <TabsTrigger value="REVOKED">Revoked</TabsTrigger>
        </TabsList>
      </Tabs>
      <Panel>
        <FilterBar onReset={() => setF({ uid: "" })} canReset={!!f.uid}>
          <SearchFilter value={f.uid} onChange={(uid) => setF({ uid })} label="Card UID" placeholder="Exact UID, e.g. 04A1B2C3D4E5F6" />
          {!uidValid && <p className="text-xs text-destructive sm:self-center">Enter a complete hexadecimal UID (4–16 bytes).</p>}
        </FilterBar>
        <DataTable
          columns={columns}
          rows={query.data?.data}
          rowKey={(c) => c.id}
          isLoading={query.isFetching}
          error={query.error}
          onRetry={() => query.refetch()}
          sort={f.sort}
          onSortChange={(sort) => setF({ sort })}
          onRowClick={(c) => router.push(`/cards/${c.id}`)}
          caption="NFC cards"
          empty={
            <EmptyState
              icon={CreditCard}
              title={f.uid ? "No card with this UID" : "No cards in this view"}
              description={f.uid ? "It may not be registered, or it was only ever held by members outside your groups." : canWrite ? "Register blank cards into stock, or assign a card by UID." : undefined}
            />
          }
        />
        <Pagination meta={query.data?.meta} onPageChange={(page) => setF({ page }, { resetPage: false })} onPageSizeChange={(pageSize) => setF({ pageSize })} />
      </Panel>
      <RegisterCardDialog open={dialog === "register"} onOpenChange={(o) => !o && setDialog(null)} />
      <AssignCardDialog open={dialog === "assign"} onOpenChange={(o) => !o && setDialog(null)} />
    </>
  );
}
