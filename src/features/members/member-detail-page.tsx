"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useState } from "react";
import { ArrowLeftRight, CreditCard, Download, MoreHorizontal, Pencil, Plus, Power, RefreshCcw, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Consequence } from "@/components/common/action-dialog";
import { PageHeader, Panel, StatTile } from "@/components/common/page-header";
import { ActiveBadge, MembershipStatusBadge, ParticipationBadge, Pill, SessionStatusBadge } from "@/components/common/status-badge";
import { BlockSkeleton, EmptyState, ErrorState } from "@/components/common/states";
import { DataTable, type Column } from "@/components/data-table/data-table";
import { DateRangeFilter, SelectFilter } from "@/components/data-table/filters";
import { EventsTable, ReprocessSummary } from "@/features/attendance/events-table";
import { AssignCardDialog, EndAssignmentDialog, ReplaceCardDialog } from "@/features/cards/card-dialogs";
import { attendanceApi, membersApi, reportsApi } from "@/lib/api/endpoints";
import { errorMessage } from "@/lib/api/errors";
import type { CardAssignment, MemberReportSession, Membership, Participation, ReprocessResult } from "@/lib/api/types";
import { useCan } from "@/lib/auth/auth-context";
import { formatDate, formatDateTime, formatPercent } from "@/lib/datetime";
import { useGroups } from "@/lib/group-context";
import { ASSIGNMENT_END_REASON_LABELS, MEMBERSHIP_END_REASON_LABELS, PARTICIPATION_LABELS, label } from "@/lib/labels";
import { Permission } from "@/lib/permissions";
import { useApiMutation } from "@/lib/use-api-mutation";
import {
  AddMembershipDialog,
  CorrectMembershipDialog,
  DeactivateMemberDialog,
  EndMembershipDialog,
  MemberFormDialog,
  TransferDialog,
} from "./member-dialogs";

type DialogName = "edit" | "transfer" | "status" | "addMembership" | "assignCard" | "replaceCard";

export function MemberDetailPage({ id }: { id: string }) {
  const canWrite = useCan(Permission.MEMBERS_WRITE);
  const canCards = useCan(Permission.CARDS_WRITE);
  const canCorrect = useCan(Permission.ATTENDANCE_CORRECT);
  const canExport = useCan(Permission.REPORTS_EXPORT);
  const { groupName } = useGroups();
  const [dialog, setDialog] = useState<DialogName | null>(null);
  const [ending, setEnding] = useState<Membership | null>(null);
  const [correcting, setCorrecting] = useState<Membership | null>(null);
  const [endingCard, setEndingCard] = useState<CardAssignment | null>(null);
  const [range, setRange] = useState({ from: "", to: "" });
  const [participation, setParticipation] = useState<Participation | "">("");
  const [reprocessResult, setReprocessResult] = useState<ReprocessResult | null>(null);
  const [exporting, setExporting] = useState(false);

  const member = useQuery({ queryKey: ["members", "detail", id], queryFn: ({ signal }) => membersApi.get(id, signal) });
  const rangeQ = { from: range.from || undefined, to: range.to || undefined };
  const report = useQuery({
    queryKey: ["reports", "member", id, rangeQ],
    queryFn: ({ signal }) => reportsApi.member(id, rangeQ, signal),
    enabled: member.isSuccess,
  });
  const cards = useQuery({
    queryKey: ["card-assignments", "member", id],
    queryFn: ({ signal }) => membersApi.cardAssignments(id, { pageSize: 100 }, signal),
    enabled: member.isSuccess,
  });
  const events = useQuery({
    queryKey: ["attendance-events", "list", { memberId: id }],
    queryFn: ({ signal }) => attendanceApi.events({ memberId: id, pageSize: 50 }, signal),
    enabled: member.isSuccess,
  });
  const reprocess = useApiMutation({
    mutationFn: () => attendanceApi.reprocess({ memberId: id }),
    invalidate: [["attendance"], ["attendance-events"], ["reports"], ["sessions"]],
    onSuccess: (r) => {
      setReprocessResult(r);
      toast.success(`${r.recordsCreated} tap(s) recovered`);
    },
    errorToast: true,
  });

  const m = member.data;
  if (member.error) return <ErrorState error={member.error} onRetry={() => member.refetch()} />;
  if (!m) return <BlockSkeleton className="h-64" />;

  const summary = report.data?.summary;
  const sessions = report.data?.sessions ?? [];
  const shownSessions = (participation ? sessions.filter((s) => s.participation === participation) : sessions).slice().reverse();
  const rejectedOpen = events.data?.data.filter((e) => e.ackStatus === "REJECTED" && e.resolution === "NONE").length ?? 0;

  const sessionColumns: Column<MemberReportSession>[] = [
    {
      id: "date",
      header: "Date",
      cell: (s) => (
        <Link href={`/sessions/${s.sessionId}`} className="font-medium whitespace-nowrap hover:underline">
          {formatDate(s.occurrenceDate)}
        </Link>
      ),
    },
    { id: "title", header: "Session", cell: (s) => <span className="line-clamp-1">{s.title}</span> },
    { id: "group", header: "Group", hideBelow: "md", cell: (s) => <span className="text-muted-foreground">{s.groupName}</span> },
    { id: "status", header: "Session status", hideBelow: "sm", cell: (s) => <SessionStatusBadge status={s.sessionStatus} /> },
    {
      id: "participation",
      header: "Attendance",
      cell: (s) => (
        <div className="flex flex-col items-start gap-0.5">
          <ParticipationBadge value={s.participation} />
          {!s.countsTowardStatistics && s.participation !== "UPCOMING" && <span className="text-xs text-muted-foreground">Not counted</span>}
        </div>
      ),
    },
    { id: "recorded", header: "Recorded at", hideBelow: "lg", cell: (s) => <span className="text-muted-foreground tabular-nums">{s.recordedPresent ? formatDateTime(s.capturedAt) : "—"}</span> },
  ];

  const membershipColumns: Column<Membership>[] = [
    {
      id: "group",
      header: "CDS group",
      cell: (ms) => (
        <Link href={`/groups/${ms.groupId}`} className="font-medium hover:underline">
          {ms.group?.name ?? groupName(ms.groupId)}
        </Link>
      ),
    },
    { id: "joined", header: "Joined", cell: (ms) => <span className="whitespace-nowrap tabular-nums">{formatDateTime(ms.joinedAt)}</span> },
    { id: "left", header: "Left", cell: (ms) => <span className="whitespace-nowrap tabular-nums">{ms.leftAt ? formatDateTime(ms.leftAt) : "—"}</span> },
    { id: "status", header: "Status", cell: (ms) => <MembershipStatusBadge status={ms.status} /> },
    {
      id: "reason",
      header: "End reason",
      hideBelow: "md",
      cell: (ms) => (
        <span className="text-muted-foreground" title={ms.endNote ?? undefined}>
          {label(MEMBERSHIP_END_REASON_LABELS, ms.endReason)}
          {ms.endNote ? ` · ${ms.endNote}` : ""}
        </span>
      ),
    },
    {
      id: "actions",
      header: <span className="sr-only">Actions</span>,
      className: "w-10 text-right",
      cell: (ms) =>
        canWrite ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon-sm" aria-label="Membership actions">
                <MoreHorizontal />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {!ms.leftAt && <DropdownMenuItem onSelect={() => setEnding(ms)}>End membership</DropdownMenuItem>}
              <DropdownMenuItem onSelect={() => setCorrecting(ms)}>Correct dates</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ) : null,
    },
  ];

  const cardColumns: Column<CardAssignment>[] = [
    {
      id: "card",
      header: "Card",
      cell: (a) => (
        <Link href={`/cards/${a.cardId}`} className="font-mono text-xs hover:underline">
          {a.card.label ? `${a.card.label} · ` : ""}
          {a.card.cardUid}
        </Link>
      ),
    },
    { id: "assigned", header: "Assigned", cell: (a) => <span className="whitespace-nowrap tabular-nums">{formatDateTime(a.assignedAt)}</span> },
    { id: "ended", header: "Ended", cell: (a) => <span className="whitespace-nowrap tabular-nums">{a.endedAt ? formatDateTime(a.endedAt) : "—"}</span> },
    {
      id: "status",
      header: "Status",
      cell: (a) => (a.status === "ACTIVE" ? <Pill tone="success">Active</Pill> : <Pill tone="muted">{label(ASSIGNMENT_END_REASON_LABELS, a.endReason, "Ended")}</Pill>),
    },
    {
      id: "actions",
      header: <span className="sr-only">Actions</span>,
      className: "w-10 text-right",
      cell: (a) =>
        canCards && a.status === "ACTIVE" ? (
          <Button variant="ghost" size="sm" onClick={() => setEndingCard(a)}>
            End
          </Button>
        ) : null,
    },
  ];

  return (
    <>
      <PageHeader
        breadcrumbs={[{ label: "Members", href: "/members" }, { label: m.fullName }]}
        title={m.fullName}
        description={<span className="font-mono">{m.stateCode}</span>}
        meta={
          <>
            <ActiveBadge active={m.status === "ACTIVE"} />
            {m.currentGroup ? (
              <Link href={`/groups/${m.currentGroup.id}`} className="text-xs text-muted-foreground hover:underline">
                {m.currentGroup.name}
              </Link>
            ) : (
              <Pill tone="muted">No current group</Pill>
            )}
            {m.activeCard ? <Pill tone="neutral">Card {m.activeCard.cardUid}</Pill> : <Pill tone="warning">No active card</Pill>}
          </>
        }
        actions={
          <>
            {canWrite && (
              <Button variant="outline" onClick={() => setDialog("edit")}>
                <Pencil /> Edit
              </Button>
            )}
            {canWrite && m.status === "ACTIVE" && m.currentGroup && (
              <Button variant="outline" onClick={() => setDialog("transfer")}>
                <ArrowLeftRight /> Transfer
              </Button>
            )}
            {canCards && m.status === "ACTIVE" && (
              <Button variant="outline" onClick={() => setDialog(m.activeCard ? "replaceCard" : "assignCard")}>
                {m.activeCard ? <RefreshCcw /> : <CreditCard />} {m.activeCard ? "Replace card" : "Assign card"}
              </Button>
            )}
            {canWrite && (
              <Button variant={m.status === "ACTIVE" ? "destructive" : "outline"} onClick={() => setDialog("status")}>
                <Power /> {m.status === "ACTIVE" ? "Deactivate" : "Reactivate"}
              </Button>
            )}
          </>
        }
      />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile
          label="Attendance rate"
          value={summary ? formatPercent(summary.attendanceRate) : "…"}
          hint={summary ? `${summary.present} present of ${summary.eligibleSessions} eligible held sessions` : undefined}
        />
        <StatTile label="Absent" value={summary ? summary.absent : "…"} hint="Held sessions they were eligible for" />
        <StatTile label="Pending resolution" value={summary ? summary.pendingResolution : "…"} tone={summary && summary.pendingResolution > 0 ? "warning" : "default"} hint="Not counted until confirmed or cancelled" />
        <StatTile label="Cancelled / upcoming" value={summary ? `${summary.cancelledSessions} / ${summary.upcoming}` : "…"} hint="Never counted as absences" />
      </div>
      <p className="mt-2 text-xs text-muted-foreground">
        Attendance % = present ÷ held (closed) sessions the member was eligible for. Sessions before they joined, after they left, cancelled or unresolved are excluded. Calculated by the attendance service.
      </p>

      {report.data && report.data.byMembership.length > 1 && (
        <Panel title="By membership" className="mt-4">
          <ul className="divide-y">
            {report.data.byMembership.map((b) => (
              <li key={b.membershipId} className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5 text-sm">
                <span>
                  <span className="font-medium">{groupName(b.groupId)}</span>{" "}
                  <span className="text-xs text-muted-foreground">
                    {formatDateTime(b.joinedAt)} → {b.leftAt ? formatDateTime(b.leftAt) : "present"}
                  </span>
                </span>
                <span className="tabular-nums">
                  {formatPercent(b.attendanceRate)} <span className="text-xs text-muted-foreground">({b.present}/{b.eligibleSessions})</span>
                </span>
              </li>
            ))}
          </ul>
        </Panel>
      )}

      <Tabs defaultValue="history" className="mt-6">
        <TabsList className="flex-wrap">
          <TabsTrigger value="history">Attendance history</TabsTrigger>
          <TabsTrigger value="memberships">Memberships</TabsTrigger>
          <TabsTrigger value="cards">Cards</TabsTrigger>
          <TabsTrigger value="taps">
            Device taps {rejectedOpen > 0 && <span className="ml-1 rounded bg-danger-soft px-1 text-xs text-destructive">{rejectedOpen}</span>}
          </TabsTrigger>
        </TabsList>
        <TabsContent value="history">
          <Panel
            title="Sessions this member was expected at"
            description="Every session of their groups during their membership periods."
            actions={
              canExport && (
                <Button
                  variant="outline"
                  size="sm"
                  disabled={exporting}
                  onClick={async () => {
                    setExporting(true);
                    try {
                      await reportsApi.download("member", id, rangeQ);
                    } catch (e) {
                      toast.error(errorMessage(e));
                    } finally {
                      setExporting(false);
                    }
                  }}
                >
                  <Download /> CSV
                </Button>
              )
            }
          >
            <div className="flex flex-col gap-2 border-b px-4 py-3 sm:flex-row sm:items-end">
              <DateRangeFilter from={range.from} to={range.to} onChange={setRange} label="Session date" />
              <SelectFilter
                label="Attendance"
                value={participation}
                onChange={setParticipation}
                options={(Object.keys(PARTICIPATION_LABELS) as Participation[]).filter((p) => p !== "NOT_RECORDED").map((p) => ({ value: p, label: PARTICIPATION_LABELS[p] }))}
              />
            </div>
            <DataTable
              columns={sessionColumns}
              rows={report.data ? shownSessions : undefined}
              rowKey={(s) => s.sessionId}
              isLoading={report.isFetching}
              error={report.error}
              onRetry={() => report.refetch()}
              caption="Member attendance history"
              empty={<EmptyState title="No sessions in this period" description="The member was not expected at any session in this range." />}
            />
          </Panel>
        </TabsContent>
        <TabsContent value="memberships">
          <Panel
            title="Membership history"
            description="Periods are [joined, left): a member is expected at sessions starting from the join time and before the leave time. Periods never overlap."
            actions={
              canWrite && m.status === "ACTIVE" && !m.currentMembership && (
                <Button variant="outline" size="sm" onClick={() => setDialog("addMembership")}>
                  <Plus /> Add membership
                </Button>
              )
            }
          >
            <DataTable columns={membershipColumns} rows={m.memberships} rowKey={(ms) => ms.id} caption="Memberships" empty={<EmptyState title="No memberships" />} />
          </Panel>
        </TabsContent>
        <TabsContent value="cards">
          <Panel title="Card assignment history" description="Cards are central stock; a card belongs to the person only while assigned.">
            <DataTable
              columns={cardColumns}
              rows={cards.data?.data}
              rowKey={(a) => a.id}
              isLoading={cards.isFetching}
              error={cards.error}
              onRetry={() => cards.refetch()}
              caption="Card assignments"
              empty={<EmptyState icon={CreditCard} title="No cards assigned yet" />}
            />
          </Panel>
        </TabsContent>
        <TabsContent value="taps">
          <Panel
            title="Device taps"
            description="Raw taps attributed to this member, including rejected ones. Rejected taps are never official attendance."
            actions={
              canCorrect &&
              rejectedOpen > 0 && (
                <Button variant="outline" size="sm" disabled={reprocess.isPending} onClick={() => reprocess.mutate()}>
                  <RotateCcw /> {reprocess.isPending ? "Re-evaluating…" : "Re-evaluate rejected taps"}
                </Button>
              )
            }
          >
            {reprocessResult && (
              <div className="border-b px-4 py-2 text-sm">
                <ReprocessSummary result={reprocessResult} />
              </div>
            )}
            {rejectedOpen > 0 && (
              <div className="border-b px-4 py-2">
                <Consequence tone="info">If taps were rejected because of a wrong join date or a late card assignment, correct that first, then re-evaluate.</Consequence>
              </div>
            )}
            <EventsTable rows={events.data?.data} isLoading={events.isFetching} error={events.error} onRetry={() => events.refetch()} onReprocessed={setReprocessResult} empty={<EmptyState title="No taps from this member" />} />
          </Panel>
        </TabsContent>
      </Tabs>

      <p className="mt-6 text-xs text-muted-foreground">
        Registered {formatDateTime(m.createdAt)}
        {m.deactivatedAt ? ` · Deactivated ${formatDateTime(m.deactivatedAt)}` : ""}
      </p>

      <MemberFormDialog open={dialog === "edit"} onOpenChange={(o) => !o && setDialog(null)} member={m} />
      <TransferDialog member={m} open={dialog === "transfer"} onOpenChange={(o) => !o && setDialog(null)} />
      <DeactivateMemberDialog member={m} open={dialog === "status"} onOpenChange={(o) => !o && setDialog(null)} />
      <AddMembershipDialog member={m} open={dialog === "addMembership"} onOpenChange={(o) => !o && setDialog(null)} />
      <AssignCardDialog member={m} open={dialog === "assignCard"} onOpenChange={(o) => !o && setDialog(null)} />
      <ReplaceCardDialog member={m} open={dialog === "replaceCard"} onOpenChange={(o) => !o && setDialog(null)} />
      <EndMembershipDialog membership={ending} onClose={() => setEnding(null)} />
      <CorrectMembershipDialog membership={correcting} onClose={() => setCorrecting(null)} />
      <EndAssignmentDialog assignment={endingCard} onClose={() => setEndingCard(null)} />
    </>
  );
}
