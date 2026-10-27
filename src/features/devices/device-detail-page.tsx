"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useState } from "react";
import { Ban, KeyRound, Pause, Pencil, Play, Archive } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Consequence } from "@/components/common/action-dialog";
import { DefinitionList, PageHeader, Panel, StatTile } from "@/components/common/page-header";
import { DeviceStatusBadge, SyncResultBadge } from "@/components/common/status-badge";
import { BlockSkeleton, EmptyState, ErrorState } from "@/components/common/states";
import { Pagination } from "@/components/data-table/data-table";
import { FilterBar, SelectFilter } from "@/components/data-table/filters";
import { EventsTable } from "@/features/attendance/events-table";
import { attendanceApi, devicesApi } from "@/lib/api/endpoints";
import type { DeviceCredentials, SyncEventType } from "@/lib/api/types";
import { useCan } from "@/lib/auth/auth-context";
import { formatDateTime, formatDuration, formatRelative } from "@/lib/datetime";
import { DEVICE_STATUS_HELP, SYNC_TYPE_LABELS } from "@/lib/labels";
import { Permission } from "@/lib/permissions";
import { DEVICE_TRANSITIONS, DeviceActionDialog, EditDeviceDialog, SecretRevealDialog, type DeviceAction } from "./device-dialogs";
import { SyncHealthPill } from "./devices-table";
import { SyncEventsTable } from "./sync-events-table";

const ACTIONS: { action: DeviceAction; label: string; icon: React.ComponentType; variant: "default" | "outline" | "destructive" }[] = [
  { action: "activate", label: "Activate", icon: Play, variant: "default" },
  { action: "suspend", label: "Suspend", icon: Pause, variant: "outline" },
  { action: "rotate", label: "Rotate credentials", icon: KeyRound, variant: "outline" },
  { action: "revoke", label: "Revoke", icon: Ban, variant: "destructive" },
  { action: "decommission", label: "Decommission", icon: Archive, variant: "destructive" },
];

export function DeviceDetailPage({ id }: { id: string }) {
  const canManage = useCan(Permission.DEVICES_MANAGE);
  const canAttendance = useCan(Permission.ATTENDANCE_READ);
  const [action, setAction] = useState<DeviceAction | null>(null);
  const [editing, setEditing] = useState(false);
  const [credentials, setCredentials] = useState<DeviceCredentials | null>(null);
  const [syncType, setSyncType] = useState<SyncEventType | "">("");
  const [syncPage, setSyncPage] = useState(1);

  const device = useQuery({ queryKey: ["devices", "detail", id], queryFn: ({ signal }) => devicesApi.get(id, signal), refetchInterval: 60_000 });
  const syncParams = { type: syncType || undefined, page: syncPage, pageSize: 20 };
  const sync = useQuery({
    queryKey: ["devices", "sync-events", id, syncParams],
    queryFn: ({ signal }) => devicesApi.syncEvents(id, syncParams, signal),
    enabled: device.isSuccess,
    placeholderData: keepPreviousData,
  });
  const taps = useQuery({
    queryKey: ["attendance-events", "list", { deviceId: id }],
    queryFn: ({ signal }) => attendanceApi.events({ deviceId: id, pageSize: 50 }, signal),
    enabled: device.isSuccess && canAttendance,
  });

  const d = device.data;
  if (device.error) return <ErrorState error={device.error} onRetry={() => device.refetch()} />;
  if (!d) return <BlockSkeleton className="h-64" />;

  const hb = d.lastStatus;
  const available = canManage ? ACTIONS.filter((a) => DEVICE_TRANSITIONS[a.action].includes(d.status)) : [];
  const upload = d.lastUpload;

  return (
    <>
      <PageHeader
        breadcrumbs={[{ label: "Devices", href: "/devices" }, { label: d.deviceIdentifier }]}
        title={<span className="font-mono">{d.deviceIdentifier}</span>}
        description={d.name}
        meta={
          <>
            <DeviceStatusBadge status={d.status} />
            <SyncHealthPill device={d} />
            {d.group && (
              <Link href={`/groups/${d.group.id}`} className="text-xs text-muted-foreground hover:underline">
                {d.group.name}
              </Link>
            )}
          </>
        }
        actions={
          <>
            {canManage && d.status !== "REVOKED" && d.status !== "DECOMMISSIONED" && (
              <Button variant="outline" onClick={() => setEditing(true)}>
                <Pencil /> Edit
              </Button>
            )}
            {available.map((a) => {
              const Icon = a.icon;
              return (
                <Button key={a.action} variant={a.variant} onClick={() => setAction(a.action)}>
                  <Icon /> {a.label}
                </Button>
              );
            })}
          </>
        }
      />
      <div className="mb-4">
        <Consequence tone={d.status === "ACTIVE" ? "info" : d.status === "SUSPENDED" || d.status === "PENDING" ? "warning" : "danger"}>
          <strong>{DEVICE_STATUS_HELP[d.status]}</strong>
          {d.statusReason && <span className="block">Reason: {d.statusReason}</span>}
          {d.status === "PENDING" && <span className="block">Load the secret onto the device, then activate it.</span>}
        </Consequence>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile label="Last sync" value={d.lastSyncAt ? formatRelative(d.lastSyncAt) : "Never"} hint={formatDateTime(d.lastSyncAt)} />
        <StatTile label="Last seen" value={d.lastSeenAt ? formatRelative(d.lastSeenAt) : "Never"} hint={formatDateTime(d.lastSeenAt)} />
        <StatTile
          label="Taps waiting on device"
          value={d.reportedPendingEvents ?? "—"}
          hint="As reported in the last heartbeat"
          tone={typeof d.reportedPendingEvents === "number" && d.reportedPendingEvents > 0 ? "warning" : "default"}
        />
        <StatTile
          label="Last upload"
          value={upload ? <SyncResultBadge result={upload.result} /> : "—"}
          hint={upload ? `${upload.itemsAccepted} accepted · ${upload.itemsAlreadyRecorded} duplicate · ${upload.itemsRejected} rejected · ${formatDateTime(upload.createdAt)}` : "No uploads yet"}
        />
      </div>

      <Tabs defaultValue="sync" className="mt-6">
        <TabsList>
          <TabsTrigger value="sync">Sync history</TabsTrigger>
          {canAttendance && <TabsTrigger value="taps">Uploaded taps</TabsTrigger>}
          <TabsTrigger value="details">Details</TabsTrigger>
        </TabsList>
        <TabsContent value="sync">
          <Panel>
            <FilterBar>
              <SelectFilter
                label="Type"
                value={syncType}
                onChange={(v) => {
                  setSyncType(v);
                  setSyncPage(1);
                }}
                options={(Object.keys(SYNC_TYPE_LABELS) as SyncEventType[]).map((t) => ({ value: t, label: SYNC_TYPE_LABELS[t] }))}
              />
            </FilterBar>
            <SyncEventsTable rows={sync.data?.data} isLoading={sync.isFetching} error={sync.error} onRetry={() => sync.refetch()} empty={<EmptyState title="No synchronization activity yet" />} />
            <Pagination meta={sync.data?.meta} onPageChange={setSyncPage} />
          </Panel>
        </TabsContent>
        {canAttendance && (
          <TabsContent value="taps">
            <Panel title="Most recent taps uploaded by this device" actions={<Button variant="ghost" size="sm" asChild><Link href={`/attendance?tab=events&deviceId=${id}`}>All taps</Link></Button>}>
              <EventsTable rows={taps.data?.data} isLoading={taps.isFetching} error={taps.error} onRetry={() => taps.refetch()} showDevice={false} empty={<EmptyState title="No taps uploaded yet" />} />
            </Panel>
          </TabsContent>
        )}
        <TabsContent value="details">
          <div className="grid gap-6 lg:grid-cols-2">
            <Panel title="Lifecycle">
              <DefinitionList
                items={[
                  { label: "Registered", value: formatDateTime(d.createdAt) },
                  { label: "Activated", value: formatDateTime(d.activatedAt) },
                  { label: "Suspended", value: formatDateTime(d.suspendedAt) },
                  { label: "Revoked", value: formatDateTime(d.revokedAt) },
                  { label: "Decommissioned", value: formatDateTime(d.decommissionedAt) },
                  { label: "Credentials last rotated", value: formatDateTime(d.credentialRotatedAt) },
                  { label: "Credential version", value: d.credentialVersion, hint: "Increases on rotation, revocation and decommissioning; older tokens stop working." },
                ]}
              />
            </Panel>
            <Panel title="Last heartbeat" description="Self-reported by the device.">
              {hb ? (
                <DefinitionList
                  items={[
                    { label: "Firmware", value: hb.firmwareVersion ?? "—" },
                    { label: "Battery", value: typeof hb.batteryPct === "number" ? `${hb.batteryPct}%` : "—" },
                    { label: "Pending taps", value: typeof hb.pendingEvents === "number" ? hb.pendingEvents : "—" },
                    { label: "Last capture on device", value: typeof hb.lastCaptureAt === "string" ? formatDateTime(hb.lastCaptureAt) : "—" },
                    { label: "Device time", value: typeof hb.deviceTime === "string" ? formatDateTime(hb.deviceTime) : "—" },
                    { label: "Roster version", value: typeof hb.snapshotVersion === "string" ? <span className="font-mono text-xs">{hb.snapshotVersion.slice(0, 12)}</span> : "—" },
                    { label: "Upload duration (last)", value: upload ? formatDuration(upload.durationMs) : "—" },
                  ]}
                />
              ) : (
                <EmptyState title="No heartbeat received yet" />
              )}
            </Panel>
          </div>
        </TabsContent>
      </Tabs>

      <EditDeviceDialog device={d} open={editing} onOpenChange={setEditing} />
      <DeviceActionDialog device={d} action={action} onClose={() => setAction(null)} onRotated={setCredentials} />
      <SecretRevealDialog title="New device credentials" credentials={credentials} onClose={() => setCredentials(null)} />
    </>
  );
}
