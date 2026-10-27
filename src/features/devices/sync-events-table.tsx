"use client";

import Link from "next/link";
import { EmptyState } from "@/components/common/states";
import { SyncResultBadge } from "@/components/common/status-badge";
import { DataTable, type Column } from "@/components/data-table/data-table";
import type { Device, SyncEvent } from "@/lib/api/types";
import { formatDateTime, formatDuration } from "@/lib/datetime";
import { SYNC_TYPE_LABELS } from "@/lib/labels";

export type SyncRow = SyncEvent & { device?: Pick<Device, "id" | "deviceIdentifier" | "name"> & { groupName?: string } };

function Counts({ e }: { e: SyncEvent }) {
  if (e.type !== "UPLOAD") return <span className="text-muted-foreground">—</span>;
  return (
    <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-xs tabular-nums">
      <span title="Taps uploaded in this batch">{e.itemsReceived} uploaded</span>
      <span className="text-success" title="New official records">{e.itemsAccepted} accepted</span>
      <span title="Already recorded (duplicate tap or second device)">{e.itemsAlreadyRecorded} already recorded</span>
      <span className={e.itemsRejected ? "text-destructive" : undefined} title="Stored but not accepted: review in Attendance › Device taps">
        {e.itemsRejected} rejected
      </span>
      {e.itemsRetry > 0 && <span className="text-[oklch(0.45_0.11_60)]" title="Transient server error: the device will resend these">{e.itemsRetry} to retry</span>}
    </div>
  );
}

export function SyncEventsTable({ rows, isLoading, error, onRetry, showDevice = false, empty }: { rows: SyncRow[] | undefined; isLoading?: boolean; error?: unknown; onRetry?: () => void; showDevice?: boolean; empty?: React.ReactNode }) {
  const columns: Column<SyncRow>[] = [
    { id: "time", header: "Time", cell: (e) => <span className="whitespace-nowrap tabular-nums">{formatDateTime(e.createdAt)}</span> },
    ...(showDevice
      ? [
          {
            id: "device",
            header: "Device",
            cell: (e: SyncRow) =>
              e.device ? (
                <div>
                  <Link href={`/devices/${e.device.id}`} className="font-mono text-xs hover:underline">
                    {e.device.deviceIdentifier}
                  </Link>
                  {e.device.groupName && <div className="text-xs text-muted-foreground">{e.device.groupName}</div>}
                </div>
              ) : (
                "—"
              ),
          },
        ]
      : []),
    { id: "type", header: "Type", cell: (e) => SYNC_TYPE_LABELS[e.type] },
    { id: "result", header: "Result", cell: (e) => <SyncResultBadge result={e.result} /> },
    { id: "counts", header: "Taps", cell: (e) => <Counts e={e} /> },
    {
      id: "error",
      header: "Failure / detail",
      hideBelow: "md",
      cell: (e) => (
        <div className="text-xs">
          {e.errorCode ? <span className="font-mono text-destructive">{e.errorCode}</span> : <span className="text-muted-foreground">—</span>}
          {e.clockSkewMs !== null && Math.abs(e.clockSkewMs) > 60_000 && <span className="block text-[oklch(0.45_0.11_60)]">Device clock off by {formatDuration(e.clockSkewMs)}</span>}
        </div>
      ),
    },
    { id: "duration", header: "Duration", hideBelow: "lg", cell: (e) => <span className="text-muted-foreground tabular-nums">{formatDuration(e.durationMs)}</span> },
  ];
  return (
    <DataTable
      columns={columns}
      rows={rows}
      rowKey={(e) => e.id}
      isLoading={isLoading}
      error={error}
      onRetry={onRetry}
      caption="Synchronization history"
      rowClassName={(e) => (e.result === "FAILED" ? "bg-danger-soft/40" : undefined)}
      empty={empty ?? <EmptyState title="No synchronization activity" />}
    />
  );
}
