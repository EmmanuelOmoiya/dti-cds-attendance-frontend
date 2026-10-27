"use client";

import Link from "next/link";
import { useState } from "react";
import { MoreHorizontal, RotateCcw, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Textarea } from "@/components/ui/textarea";
import { ActionDialog } from "@/components/common/action-dialog";
import { Field } from "@/components/common/form";
import { AckBadge, Pill, ResolutionBadge } from "@/components/common/status-badge";
import { EmptyState } from "@/components/common/states";
import { DataTable, type Column } from "@/components/data-table/data-table";
import { attendanceApi } from "@/lib/api/endpoints";
import type { AttendanceEvent, ReprocessResult } from "@/lib/api/types";
import { useCan } from "@/lib/auth/auth-context";
import { formatDateTime, formatDuration } from "@/lib/datetime";
import { REJECT_REASON_LABELS, label } from "@/lib/labels";
import { Permission } from "@/lib/permissions";
import { useApiMutation } from "@/lib/use-api-mutation";
import { ATTENDANCE_INVALIDATE } from "./correction-dialogs";

export function uploadDelayMs(e: Pick<AttendanceEvent, "capturedAt" | "receivedAt">): number {
  return new Date(e.receivedAt).getTime() - new Date(e.capturedAt).getTime();
}

export function ReprocessSummary({ result }: { result: ReprocessResult }) {
  const still = result.results.filter((r) => r.outcome === "STILL_REJECTED").length;
  const already = result.results.filter((r) => r.outcome === "ALREADY_RECORDED").length;
  return (
    <span>
      Re-evaluated {result.evaluated} tap{result.evaluated === 1 ? "" : "s"}: {result.recordsCreated} recovered, {already} already recorded, {still} still rejected.
    </span>
  );
}

export function EventsTable({
  rows,
  isLoading,
  error,
  onRetry,
  sort,
  onSortChange,
  showDevice = true,
  empty,
  onReprocessed,
}: {
  rows: AttendanceEvent[] | undefined;
  isLoading?: boolean;
  error?: unknown;
  onRetry?: () => void;
  sort?: string;
  onSortChange?: (s: string) => void;
  showDevice?: boolean;
  empty?: React.ReactNode;
  onReprocessed?: (r: ReprocessResult) => void;
}) {
  const canCorrect = useCan(Permission.ATTENDANCE_CORRECT);
  const [dismissing, setDismissing] = useState<AttendanceEvent | null>(null);
  const [note, setNote] = useState("");

  const dismiss = useApiMutation({
    mutationFn: () => attendanceApi.dismiss(dismissing!.id, note.trim()),
    invalidate: ATTENDANCE_INVALIDATE,
    success: "Tap dismissed",
    onSuccess: () => setDismissing(null),
  });
  const reprocess = useApiMutation({
    mutationFn: (eventId: string) => attendanceApi.reprocess({ eventIds: [eventId] }),
    invalidate: ATTENDANCE_INVALIDATE,
    success: (r) => (r.recordsCreated ? "Tap recovered: attendance record created" : r.results[0]?.outcome === "ALREADY_RECORDED" ? "Member was already recorded for that session" : `Still rejected: ${label(REJECT_REASON_LABELS, r.results[0]?.reason as never, "no change")}`),
    onSuccess: (r) => onReprocessed?.(r),
    errorToast: true,
  });

  const columns: Column<AttendanceEvent>[] = [
    {
      id: "captured",
      header: "Captured",
      sortKey: "capturedAt",
      cell: (e) => (
        <div className="whitespace-nowrap">
          <span className="tabular-nums">{formatDateTime(e.capturedAt)}</span>
          {uploadDelayMs(e) > 15 * 60_000 && (
            <span className="block text-xs text-muted-foreground" title="Captured offline and uploaded later. Judged by capture time.">
              Uploaded {formatDuration(uploadDelayMs(e))} later
            </span>
          )}
        </div>
      ),
    },
    {
      id: "member",
      header: "Member / card",
      cell: (e) =>
        e.member ? (
          <div>
            <Link href={`/members/${e.member.id}`} className="font-medium hover:underline">
              {e.member.fullName}
            </Link>
            <div className="font-mono text-xs text-muted-foreground">{e.member.stateCode}</div>
          </div>
        ) : (
          <div>
            <span className="text-muted-foreground">Unidentified</span>
            <div className="font-mono text-xs text-muted-foreground">Card {e.cardUid}</div>
          </div>
        ),
    },
    ...(showDevice
      ? [
          {
            id: "device",
            header: "Device",
            hideBelow: "md" as const,
            cell: (e: AttendanceEvent) =>
              e.device ? (
                <Link href={`/devices/${e.device.id}`} className="font-mono text-xs hover:underline">
                  {e.device.deviceIdentifier}
                </Link>
              ) : (
                "—"
              ),
          },
        ]
      : []),
    {
      id: "outcome",
      header: "Device was told",
      cell: (e) => (
        <div className="flex flex-col items-start gap-0.5">
          <AckBadge status={e.ackStatus} />
          {e.ackReason && <span className="text-xs text-muted-foreground">{label(REJECT_REASON_LABELS, e.ackReason)}</span>}
        </div>
      ),
    },
    {
      id: "review",
      header: "Review",
      hideBelow: "sm",
      cell: (e) =>
        e.ackStatus === "REJECTED" ? (
          <div className="flex flex-col items-start gap-0.5">
            <ResolutionBadge value={e.resolution} />
            {e.resolutionNote && <span className="line-clamp-1 max-w-[14rem] text-xs text-muted-foreground" title={e.resolutionNote}>{e.resolutionNote}</span>}
          </div>
        ) : e.attendanceRecordId ? (
          <Link href={`/attendance/${e.attendanceRecordId}`} className="text-xs hover:underline">
            View record
          </Link>
        ) : (
          <span className="text-xs text-muted-foreground">—</span>
        ),
    },
    {
      id: "session",
      header: "Session",
      hideBelow: "lg",
      cell: (e) =>
        e.sessionId ? (
          <span className="flex items-center gap-1">
            <Link href={`/sessions/${e.sessionId}`} className="text-xs hover:underline">
              Open session
            </Link>
            {e.sessionReassigned && <Pill tone="info" title="The device's claimed session was replaced by the session whose window contains the capture time.">Re-matched</Pill>}
          </span>
        ) : (
          <span className="text-xs text-muted-foreground">None</span>
        ),
    },
    {
      id: "actions",
      header: <span className="sr-only">Actions</span>,
      className: "w-10 text-right",
      cell: (e) =>
        canCorrect && e.ackStatus === "REJECTED" && e.resolution === "NONE" ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon-sm" aria-label="Review tap" disabled={reprocess.isPending}>
                <MoreHorizontal />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onSelect={() => reprocess.mutate(e.id)}>
                <RotateCcw /> Re-evaluate against current data
              </DropdownMenuItem>
              <DropdownMenuItem
                onSelect={() => {
                  setNote("");
                  setDismissing(e);
                }}
              >
                <XCircle /> Dismiss (no action)
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ) : null,
    },
  ];

  return (
    <>
      <DataTable
        columns={columns}
        rows={rows}
        rowKey={(e) => e.id}
        isLoading={isLoading}
        error={error}
        onRetry={onRetry}
        sort={sort}
        onSortChange={onSortChange}
        caption="Device taps"
        empty={empty ?? <EmptyState title="No device taps" />}
      />
      <ActionDialog
        open={!!dismissing}
        onOpenChange={(o) => {
          if (!o) {
            setDismissing(null);
            dismiss.reset();
          }
        }}
        title="Dismiss rejected tap"
        description="Marks the tap as reviewed without creating attendance (for example a test tap). The tap and the device's original acknowledgement are kept."
        confirmLabel="Dismiss tap"
        pending={dismiss.isPending}
        error={dismiss.error}
        confirmDisabled={note.trim().length < 3}
        onSubmit={() => dismiss.mutate()}
      >
        <Field label="Note" required>
          <Textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} maxLength={1000} />
        </Field>
      </ActionDialog>
    </>
  );
}
