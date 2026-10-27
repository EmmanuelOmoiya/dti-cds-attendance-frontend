"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef } from "react";
import { onSessionExpired } from "@/lib/api/client";
import { authApi } from "@/lib/api/endpoints";
import type { CurrentUser } from "@/lib/api/types";
import { roleCan, type Permission } from "@/lib/permissions";

interface AuthContextValue {
  user: CurrentUser | null;
  status: "loading" | "authenticated" | "error";
  error: unknown;
  can: (permission: Permission) => boolean;
  signOut: () => Promise<void>;
  refetch: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export const ME_QUERY_KEY = ["auth", "me"] as const;

export function loginRedirectUrl(pathname: string, reason?: "expired"): string {
  const params = new URLSearchParams();
  if (reason) params.set("reason", reason);
  if (pathname && pathname !== "/" && !pathname.startsWith("/login")) params.set("next", pathname);
  const s = params.toString();
  return s ? `/login?${s}` : "/login";
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const queryClient = useQueryClient();
  const router = useRouter();
  const redirecting = useRef(false);

  const me = useQuery({
    queryKey: ME_QUERY_KEY,
    queryFn: ({ signal }) => authApi.me(signal),
    staleTime: 5 * 60_000,
    retry: false,
  });

  useEffect(() => {
    return onSessionExpired(() => {
      if (redirecting.current) return;
      redirecting.current = true;
      queryClient.clear();
      router.replace(loginRedirectUrl(window.location.pathname + window.location.search, "expired"));
    });
  }, [queryClient, router]);

  const signOut = useCallback(async () => {
    redirecting.current = true;
    try {
      await fetch("/api/auth/logout", { method: "POST", headers: { "x-dla-client": "dashboard" } });
    } finally {
      queryClient.clear();
      router.replace("/login");
    }
  }, [queryClient, router]);

  const { data, isPending, error, refetch } = me;
  const user = data ?? null;
  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      status: isPending ? "loading" : user ? "authenticated" : "error",
      error,
      can: (p) => roleCan(user?.role, p),
      signOut,
      refetch: () => void refetch(),
    }),
    [user, isPending, error, signOut, refetch],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}

/** The signed-in user; only call below <AuthGate>, which guarantees it is present. */
export function useCurrentUser(): CurrentUser {
  const { user } = useAuth();
  if (!user) throw new Error("useCurrentUser called outside an authenticated area");
  return user;
}

export function useCan(permission: Permission): boolean {
  return useAuth().can(permission);
}
