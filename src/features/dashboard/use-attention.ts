"use client";

import { useQuery } from "@tanstack/react-query";
import { attendanceApi, devicesApi, sessionsApi } from "@/lib/api/endpoints";
import { useAuth } from "@/lib/auth/auth-context";
import { Permission } from "@/lib/permissions";

/**
 * Items that need an administrator, counted from the API's own list totals (`meta.total`), so the
 * numbers are exact even though only one row is fetched.
 */
export function useAttention(groupId: string | null) {
  const { can } = useAuth();
  const gid = groupId ?? undefined;

  const unresolved = useQuery({
    queryKey: ["sessions", "count", { needsResolution: true, groupId: gid }],
    queryFn: ({ signal }) => sessionsApi.list({ needsResolution: true, groupId: gid, pageSize: 1 }, signal),
    enabled: can(Permission.SESSIONS_READ),
    select: (r) => r.meta.total,
    refetchInterval: 120_000,
  });

  const rejected = useQuery({
    queryKey: ["attendance-events", "count", { ackStatus: "REJECTED", resolution: "NONE", groupId: gid }],
    queryFn: ({ signal }) => attendanceApi.events({ ackStatus: "REJECTED", resolution: "NONE", groupId: gid, pageSize: 1 }, signal),
    enabled: can(Permission.ATTENDANCE_READ),
    select: (r) => r.meta.total,
    refetchInterval: 120_000,
  });

  const suspended = useQuery({
    queryKey: ["devices", "count", { status: "SUSPENDED", groupId: gid }],
    queryFn: ({ signal }) => devicesApi.list({ status: "SUSPENDED", groupId: gid, pageSize: 1 }, signal),
    enabled: can(Permission.DEVICES_READ),
    select: (r) => r.meta.total,
  });

  const pending = useQuery({
    queryKey: ["devices", "count", { status: "PENDING", groupId: gid }],
    queryFn: ({ signal }) => devicesApi.list({ status: "PENDING", groupId: gid, pageSize: 1 }, signal),
    enabled: can(Permission.DEVICES_READ),
    select: (r) => r.meta.total,
  });

  const items = [
    {
      key: "unresolved",
      count: unresolved.data,
      label: "Sessions awaiting resolution",
      description: "Planned time passed without being confirmed held or cancelled.",
      href: "/sessions?view=resolution",
      enabled: can(Permission.SESSIONS_READ),
    },
    {
      key: "rejected",
      count: rejected.data,
      label: "Rejected taps to review",
      description: "Device taps that were not accepted and have not been reviewed.",
      href: "/attendance?tab=events&ackStatus=REJECTED&resolution=NONE",
      enabled: can(Permission.ATTENDANCE_READ),
    },
    {
      key: "pending",
      count: pending.data,
      label: "Devices pending activation",
      description: "Registered devices that cannot sync until activated.",
      href: "/devices?status=PENDING",
      enabled: can(Permission.DEVICES_READ),
    },
    {
      key: "suspended",
      count: suspended.data,
      label: "Suspended devices",
      description: "Temporarily blocked from synchronizing.",
      href: "/devices?status=SUSPENDED",
      enabled: can(Permission.DEVICES_READ),
    },
  ].filter((i) => i.enabled);

  const total = items.reduce((sum, i) => sum + (i.count ?? 0), 0);
  const loading = unresolved.isPending || rejected.isPending;
  return { items, total, loading };
}
