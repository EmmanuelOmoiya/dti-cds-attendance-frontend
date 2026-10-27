"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { CalendarDays } from "lucide-react";
import { Pill, SessionStatusBadge } from "@/components/common/status-badge";
import { EmptyState } from "@/components/common/states";
import { DataTable, type Column } from "@/components/data-table/data-table";
import type { Session } from "@/lib/api/types";
import { formatDate, formatTime } from "@/lib/datetime";
import { useGroups } from "@/lib/group-context";
import { CANCELLATION_REASON_LABELS, label } from "@/lib/labels";

export function SessionsTable({
  rows,
  isLoading,
  error,
  onRetry,
  sort,
  onSortChange,
  showGroup = true,
  empty,
}: {
  rows: Session[] | undefined;
  isLoading?: boolean;
  error?: unknown;
  onRetry?: () => void;
  sort?: string;
  onSortChange?: (s: string) => void;
  showGroup?: boolean;
  empty?: React.ReactNode;
}) {
  const router = useRouter();
  const { groupName } = useGroups();
  const columns: Column<Session>[] = [
    {
      id: "date",
      header: "Date",
      sortKey: "plannedStart",
      cell: (s) => (
        <div className="whitespace-nowrap">
          <Link href={`/sessions/${s.id}`} className="font-medium hover:underline">
            {formatDate(s.occurrenceDate)}
          </Link>
          <div className="text-xs text-muted-foreground tabular-nums">
            {formatTime(s.plannedStart, s.timezone)} – {formatTime(s.plannedEnd, s.timezone)}
          </div>
        </div>
      ),
    },
    {
      id: "title",
      header: "Session",
      cell: (s) => (
        <div className="min-w-0">
          <span className="line-clamp-1">{s.title}</span>
          <div className="mt-0.5 flex flex-wrap gap-1">
            {s.origin === "AD_HOC" && <Pill tone="neutral">Ad-hoc</Pill>}
            {s.rescheduled && <Pill tone="info">Rescheduled</Pill>}
          </div>
        </div>
      ),
    },
    ...(showGroup ? [{ id: "group", header: "Group", hideBelow: "md" as const, cell: (s: Session) => <span className="text-muted-foreground">{groupName(s.groupId)}</span> }] : []),
    {
      id: "status",
      header: "Status",
      sortKey: "status",
      cell: (s) => (
        <div className="flex flex-col items-start gap-0.5">
          <SessionStatusBadge status={s.status} />
          {s.status === "CANCELLED" && (
            <span className="text-xs text-muted-foreground">{label(CANCELLATION_REASON_LABELS, s.cancellationReason)}</span>
          )}
          {s.heldConfirmation === "CONFIRMED_RETROSPECTIVELY" && <span className="text-xs text-muted-foreground">Confirmed afterwards</span>}
        </div>
      ),
    },
  ];
  return (
    <DataTable
      columns={columns}
      rows={rows}
      rowKey={(s) => s.id}
      isLoading={isLoading}
      error={error}
      onRetry={onRetry}
      sort={sort}
      onSortChange={onSortChange}
      onRowClick={(s) => router.push(`/sessions/${s.id}`)}
      caption="Sessions"
      empty={empty ?? <EmptyState icon={CalendarDays} title="No sessions" />}
    />
  );
}
