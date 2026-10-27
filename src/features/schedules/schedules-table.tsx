"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { CalendarClock } from "lucide-react";
import { ActiveBadge } from "@/components/common/status-badge";
import { EmptyState } from "@/components/common/states";
import { DataTable, type Column } from "@/components/data-table/data-table";
import type { Schedule } from "@/lib/api/types";
import { formatDate, weekdayName, zoneAbbreviation } from "@/lib/datetime";
import { useGroups } from "@/lib/group-context";

export function scheduleSummary(s: Pick<Schedule, "dayOfWeek" | "startLocalTime" | "endLocalTime" | "timezone">): string {
  return `${weekdayName(s.dayOfWeek)}s, ${s.startLocalTime}–${s.endLocalTime} ${zoneAbbreviation(s.timezone)}`;
}

export function effectivePeriod(s: Pick<Schedule, "effectiveFrom" | "effectiveUntil">): string {
  return `${formatDate(s.effectiveFrom, { weekday: false })} → ${s.effectiveUntil ? formatDate(s.effectiveUntil, { weekday: false }) : "open-ended"}`;
}

export function SchedulesTable({
  rows,
  isLoading,
  error,
  onRetry,
  sort,
  onSortChange,
  showGroup = true,
  empty,
}: {
  rows: Schedule[] | undefined;
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
  const columns: Column<Schedule>[] = [
    {
      id: "title",
      header: "Schedule",
      cell: (s) => (
        <Link href={`/schedules/${s.id}`} className="font-medium hover:underline">
          {s.title}
        </Link>
      ),
    },
    { id: "when", header: "Meets", sortKey: "dayOfWeek", cell: (s) => <span className="whitespace-nowrap tabular-nums">{scheduleSummary(s)}</span> },
    ...(showGroup ? [{ id: "group", header: "Group", hideBelow: "md" as const, cell: (s: Schedule) => <span className="text-muted-foreground">{groupName(s.groupId)}</span> }] : []),
    { id: "effective", header: "Effective", sortKey: "effectiveFrom", hideBelow: "lg", cell: (s) => <span className="whitespace-nowrap text-muted-foreground">{effectivePeriod(s)}</span> },
    { id: "status", header: "Status", cell: (s) => <ActiveBadge active={s.status === "ACTIVE"} /> },
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
      onRowClick={(s) => router.push(`/schedules/${s.id}`)}
      caption="Schedules"
      empty={empty ?? <EmptyState icon={CalendarClock} title="No schedules" />}
    />
  );
}
