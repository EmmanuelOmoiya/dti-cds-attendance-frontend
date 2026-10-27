"use client";

import { useQuery } from "@tanstack/react-query";
import { createContext, useContext, useMemo } from "react";
import { groupsApi } from "@/lib/api/endpoints";
import type { Group } from "@/lib/api/types";
import { useAuth } from "@/lib/auth/auth-context";
import { useStoredString } from "@/lib/use-stored";

/**
 * The header "group context": which CDS group the user is working in ("all" = every group they can
 * access). Pages use it as the default group filter. It is a convenience only: the backend
 * scopes every request to the user's groups and returns 404 for anything outside them.
 */
interface GroupContextValue {
  groups: Group[];
  groupsLoading: boolean;
  groupsError: unknown;
  groupById: Map<string, Group>;
  activeGroupId: string | null;
  setActiveGroupId: (id: string | null) => void;
  activeGroup: Group | null;
  groupName: (id: string | null | undefined) => string;
}

const GroupContext = createContext<GroupContextValue | null>(null);
const STORAGE_KEY = "dla.activeGroupId";

export const GROUPS_ALL_KEY = ["groups", "all"] as const;

export function useAllGroups() {
  return useQuery({
    queryKey: GROUPS_ALL_KEY,
    queryFn: ({ signal }) => groupsApi.all(signal),
    staleTime: 5 * 60_000,
  });
}

export function GroupProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const groupsQuery = useAllGroups();
  const groups = useMemo(() => groupsQuery.data?.data ?? [], [groupsQuery.data]);
  const [stored, setActiveGroupId] = useStoredString(user ? `${STORAGE_KEY}.${user.id}` : null);

  const groupById = useMemo(() => new Map(groups.map((g) => [g.id, g])), [groups]);

  // A scoped user with exactly one group always works in that group.
  const singleGroup = user?.role !== "SUPER_ADMIN" && groups.length === 1 ? groups[0].id : null;
  const activeGroupId = singleGroup ?? (stored && groupById.has(stored) ? stored : null);

  const value = useMemo<GroupContextValue>(
    () => ({
      groups,
      groupsLoading: groupsQuery.isPending,
      groupsError: groupsQuery.error,
      groupById,
      activeGroupId,
      setActiveGroupId,
      activeGroup: activeGroupId ? (groupById.get(activeGroupId) ?? null) : null,
      groupName: (id) => (id ? (groupById.get(id)?.name ?? "Unknown group") : "—"),
    }),
    [groups, groupsQuery.isPending, groupsQuery.error, groupById, activeGroupId, setActiveGroupId],
  );

  return <GroupContext.Provider value={value}>{children}</GroupContext.Provider>;
}

export function useGroups(): GroupContextValue {
  const ctx = useContext(GroupContext);
  if (!ctx) throw new Error("useGroups must be used within GroupProvider");
  return ctx;
}
