"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Smartphone } from "lucide-react";
import { DeviceStatusBadge, Pill, type Tone } from "@/components/common/status-badge";
import { EmptyState } from "@/components/common/states";
import { DataTable, type Column } from "@/components/data-table/data-table";
import type { Device } from "@/lib/api/types";
import { formatDateTime, formatRelative } from "@/lib/datetime";

/** Hours without a sync after which an active device is flagged as stale (informational only). */
export const STALE_SYNC_HOURS = 24;

export function syncHealth(d: Pick<Device, "status" | "lastSyncAt">, now = new Date()): { tone: Tone; label: string; help: string } {
  if (d.status !== "ACTIVE") return { tone: "muted", label: "Not syncing", help: "Only active devices can synchronize." };
  if (!d.lastSyncAt) return { tone: "warning", label: "Never synced", help: "This device has not uploaded attendance yet." };
  const hours = (now.getTime() - new Date(d.lastSyncAt).getTime()) / 3_600_000;
  if (hours > STALE_SYNC_HOURS)
    return {
      tone: "warning",
      label: `No sync for ${hours > 48 ? `${Math.round(hours / 24)} days` : `${Math.round(hours)} h`}`,
      help: "The device may be offline. Taps captured offline are still accepted when it reconnects, judged by capture time.",
    };
  return { tone: "success", label: "Recently synced", help: `Last sync within the past ${STALE_SYNC_HOURS} hours.` };
}

export function SyncHealthPill({ device }: { device: Pick<Device, "status" | "lastSyncAt"> }) {
  const h = syncHealth(device);
  return (
    <Pill tone={h.tone} title={h.help} dot>
      {h.label}
    </Pill>
  );
}

export function DevicesTable({
  rows,
  isLoading,
  error,
  onRetry,
  sort,
  onSortChange,
  showGroup = true,
  empty,
}: {
  rows: Device[] | undefined;
  isLoading?: boolean;
  error?: unknown;
  onRetry?: () => void;
  sort?: string;
  onSortChange?: (s: string) => void;
  showGroup?: boolean;
  empty?: React.ReactNode;
}) {
  const router = useRouter();
  const columns: Column<Device>[] = [
    {
      id: "device",
      header: "Device",
      sortKey: "deviceIdentifier",
      cell: (d) => (
        <div className="min-w-0">
          <Link href={`/devices/${d.id}`} className="font-mono text-sm font-medium hover:underline">
            {d.deviceIdentifier}
          </Link>
          <div className="text-xs text-muted-foreground">{d.name}</div>
        </div>
      ),
    },
    ...(showGroup ? [{ id: "group", header: "Group", hideBelow: "md" as const, cell: (d: Device) => <span className="text-muted-foreground">{d.group?.name ?? "—"}</span> }] : []),
    { id: "status", header: "Status", sortKey: "status", cell: (d) => <DeviceStatusBadge status={d.status} /> },
    { id: "health", header: "Sync health", hideBelow: "sm", cell: (d) => <SyncHealthPill device={d} /> },
    {
      id: "lastSync",
      header: "Last sync",
      hideBelow: "lg",
      cell: (d) => (
        <span className="text-muted-foreground" title={formatDateTime(d.lastSyncAt)}>
          {d.lastSyncAt ? formatRelative(d.lastSyncAt) : "Never"}
        </span>
      ),
    },
    {
      id: "lastSeen",
      header: "Last seen",
      sortKey: "lastSeenAt",
      hideBelow: "lg",
      cell: (d) => (
        <span className="text-muted-foreground" title={formatDateTime(d.lastSeenAt)}>
          {d.lastSeenAt ? formatRelative(d.lastSeenAt) : "Never"}
        </span>
      ),
    },
  ];
  return (
    <DataTable
      columns={columns}
      rows={rows}
      rowKey={(d) => d.id}
      isLoading={isLoading}
      error={error}
      onRetry={onRetry}
      sort={sort}
      onSortChange={onSortChange}
      onRowClick={(d) => router.push(`/devices/${d.id}`)}
      caption="Devices"
      empty={empty ?? <EmptyState icon={Smartphone} title="No devices" />}
    />
  );
}
