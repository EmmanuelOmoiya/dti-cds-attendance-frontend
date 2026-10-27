"use client";

import { keepPreviousData, useQueries, useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Plus, Smartphone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Consequence } from "@/components/common/action-dialog";
import { PageHeader, Panel } from "@/components/common/page-header";
import { EmptyState } from "@/components/common/states";
import { Pagination } from "@/components/data-table/data-table";
import { FilterBar, GroupFilter, SearchFilter, SelectFilter } from "@/components/data-table/filters";
import { devicesApi } from "@/lib/api/endpoints";
import type { DeviceCredentials, DeviceStatus, SyncEventType, SyncResult } from "@/lib/api/types";
import { useCan } from "@/lib/auth/auth-context";
import { useGroups } from "@/lib/group-context";
import { DEVICE_STATUS_LABELS, SYNC_RESULT_LABELS, SYNC_TYPE_LABELS } from "@/lib/labels";
import { Permission } from "@/lib/permissions";
import { toInt, useUrlState } from "@/lib/use-url-state";
import { RegisterDeviceDialog, SecretRevealDialog } from "./device-dialogs";
import { DevicesTable } from "./devices-table";
import { SyncEventsTable, type SyncRow } from "./sync-events-table";

/** The API exposes sync history per device only; the monitor fans out over at most this many devices. */
const MONITOR_DEVICE_LIMIT = 30;
const MONITOR_EVENTS_PER_DEVICE = 20;

function SyncMonitor({ groupId }: { groupId?: string }) {
  const [type, setType] = useState<SyncEventType | "">("UPLOAD");
  const [result, setResult] = useState<SyncResult | "">("");
  const { groupName } = useGroups();
  const devices = useQuery({
    queryKey: ["devices", "list", { groupId, status: "ACTIVE", pageSize: MONITOR_DEVICE_LIMIT, sort: "lastSeenAt:desc" }],
    queryFn: ({ signal }) => devicesApi.list({ groupId, status: "ACTIVE", pageSize: MONITOR_DEVICE_LIMIT, sort: "lastSeenAt:desc" }, signal),
  });
  const list = devices.data?.data ?? [];
  const perDevice = useQueries({
    queries: list.map((d) => ({
      queryKey: ["devices", "sync-events", d.id, { type, pageSize: MONITOR_EVENTS_PER_DEVICE }],
      queryFn: ({ signal }: { signal: AbortSignal }) => devicesApi.syncEvents(d.id, { type: type || undefined, pageSize: MONITOR_EVENTS_PER_DEVICE }, signal),
      refetchInterval: 60_000,
    })),
  });
  const rows = ((): SyncRow[] => {
    const out: SyncRow[] = [];
    perDevice.forEach((q, i) => {
      const d = list[i];
      for (const e of q.data?.data ?? []) out.push({ ...e, device: { id: d.id, deviceIdentifier: d.deviceIdentifier, name: d.name, groupName: d.group?.name ?? groupName(d.assignedGroupId) } });
    });
    return out.filter((e) => !result || e.result === result).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  })();

  const loading = devices.isPending || perDevice.some((q) => q.isPending);
  const error = devices.error ?? perDevice.find((q) => q.error)?.error;

  return (
    <Panel>
      <FilterBar>
        <SelectFilter label="Type" value={type} onChange={setType} options={(Object.keys(SYNC_TYPE_LABELS) as SyncEventType[]).map((t) => ({ value: t, label: SYNC_TYPE_LABELS[t] }))} />
        <SelectFilter label="Result" value={result} onChange={setResult} options={(Object.keys(SYNC_RESULT_LABELS) as SyncResult[]).map((t) => ({ value: t, label: SYNC_RESULT_LABELS[t] }))} />
      </FilterBar>
      <div className="border-b px-4 py-2">
        <Consequence tone="info">
          Latest {MONITOR_EVENTS_PER_DEVICE} events of each active device{devices.data && devices.data.meta.total > MONITOR_DEVICE_LIMIT ? ` (the ${MONITOR_DEVICE_LIMIT} most recently seen of ${devices.data.meta.total})` : ""}. Readers work offline, so uploads after a meeting are normal and are judged by capture time. Failed uploads are retried by the device itself; there is no server-side retry action.
        </Consequence>
      </div>
      <SyncEventsTable
        rows={loading && rows.length === 0 ? undefined : rows}
        isLoading={loading}
        error={error}
        onRetry={() => devices.refetch()}
        showDevice
        empty={<EmptyState title={list.length ? "No synchronization events match" : "No active devices"} />}
      />
    </Panel>
  );
}

export function DevicesPage() {
  const router = useRouter();
  const canManage = useCan(Permission.DEVICES_MANAGE);
  const { activeGroupId } = useGroups();
  const [f, setF] = useUrlState({ tab: "devices", q: "", groupId: "", status: "", page: "1", pageSize: "20", sort: "" });
  const [registering, setRegistering] = useState(false);
  const [secret, setSecret] = useState<{ deviceId: string; credentials: DeviceCredentials } | null>(null);
  const groupId = f.groupId || activeGroupId || undefined;
  const params = { q: f.q || undefined, groupId, status: f.status || undefined, page: toInt(f.page, 1), pageSize: toInt(f.pageSize, 20), sort: f.sort || undefined };
  const query = useQuery({ queryKey: ["devices", "list", params], queryFn: ({ signal }) => devicesApi.list(params, signal), placeholderData: keepPreviousData, enabled: f.tab === "devices" });

  return (
    <>
      <PageHeader
        title="Devices"
        description="NFC readers, their lifecycle and synchronization health. Device secrets are never displayed after provisioning."
        actions={
          canManage && (
            <Button onClick={() => setRegistering(true)}>
              <Plus /> Register device
            </Button>
          )
        }
      />
      <Tabs value={f.tab} onValueChange={(tab) => setF({ tab })} className="mb-3">
        <TabsList>
          <TabsTrigger value="devices">Devices</TabsTrigger>
          <TabsTrigger value="sync">Sync monitor</TabsTrigger>
        </TabsList>
      </Tabs>
      {f.tab === "sync" ? (
        <SyncMonitor groupId={groupId} />
      ) : (
        <Panel>
          <FilterBar onReset={() => setF({ q: "", groupId: "", status: "" })} canReset={!!(f.q || f.groupId || f.status)}>
            <SearchFilter value={f.q} onChange={(q) => setF({ q })} placeholder="Identifier or name" />
            <GroupFilter value={f.groupId || activeGroupId || ""} onChange={(gid) => setF({ groupId: gid })} />
            <SelectFilter
              label="Status"
              value={f.status as DeviceStatus | ""}
              onChange={(status) => setF({ status })}
              options={(Object.keys(DEVICE_STATUS_LABELS) as DeviceStatus[]).map((s) => ({ value: s, label: DEVICE_STATUS_LABELS[s] }))}
            />
          </FilterBar>
          <DevicesTable
            rows={query.data?.data}
            isLoading={query.isFetching}
            error={query.error}
            onRetry={() => query.refetch()}
            sort={f.sort}
            onSortChange={(sort) => setF({ sort })}
            empty={
              <EmptyState
                icon={Smartphone}
                title="No devices found"
                description={canManage ? "Register a reader, load its one-time secret onto it, then activate it." : undefined}
                action={canManage ? <Button onClick={() => setRegistering(true)}><Plus /> Register device</Button> : undefined}
              />
            }
          />
          <Pagination meta={query.data?.meta} onPageChange={(page) => setF({ page }, { resetPage: false })} onPageSizeChange={(pageSize) => setF({ pageSize })} />
        </Panel>
      )}
      <RegisterDeviceDialog open={registering} onOpenChange={setRegistering} onRegistered={(r) => setSecret({ deviceId: r.device.id, credentials: r.credentials })} />
      <SecretRevealDialog
        title="Device registered"
        credentials={secret?.credentials ?? null}
        onClose={() => {
          const id = secret?.deviceId;
          setSecret(null);
          if (id) router.push(`/devices/${id}`);
        }}
      />
    </>
  );
}
