"use client";

import { Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { ErrorState } from "@/components/common/states";
import { isApiError } from "@/lib/api/errors";
import { AuthProvider, loginRedirectUrl, useAuth } from "@/lib/auth/auth-context";
import { GroupProvider } from "@/lib/group-context";
import { useStoredString } from "@/lib/use-stored";
import { Header } from "./header";
import { DesktopSidebar } from "./sidebar";

const COLLAPSE_KEY = "dla.sidebarCollapsed";

/**
 * Nothing under the dashboard renders until the backend has confirmed who the user is, so
 * protected data and controls are never shown to an unauthenticated visitor.
 */
function AuthGate({ children }: { children: React.ReactNode }) {
  const { status, error, refetch } = useAuth();
  const router = useRouter();
  const unauthenticated = status === "error" && isApiError(error) && error.status === 401;

  useEffect(() => {
    if (unauthenticated) router.replace(loginRedirectUrl(window.location.pathname + window.location.search, "expired"));
  }, [unauthenticated, router]);

  if (status === "loading" || unauthenticated) {
    return (
      <div className="flex min-h-screen items-center justify-center" role="status" aria-live="polite">
        <Loader2 className="size-5 animate-spin text-muted-foreground" />
        <span className="ml-2 text-sm text-muted-foreground">Checking your session…</span>
      </div>
    );
  }
  if (status === "error") {
    return (
      <div className="flex min-h-screen items-center justify-center p-6">
        <ErrorState error={error} onRetry={refetch} title="Couldn't load your account" />
      </div>
    );
  }
  return <>{children}</>;
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const [stored, setStored] = useStoredString(COLLAPSE_KEY);
  const collapsed = stored === "1";
  const toggle = () => setStored(collapsed ? "0" : "1");

  return (
    <AuthProvider>
      <AuthGate>
        <GroupProvider>
          <div className="flex min-h-screen">
            <DesktopSidebar collapsed={collapsed} onToggle={toggle} />
            <div className="flex min-w-0 flex-1 flex-col">
              <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-50 focus:rounded focus:bg-background focus:px-3 focus:py-2">
                Skip to content
              </a>
              <Header />
              <main id="main" className="mx-auto w-full max-w-[1400px] flex-1 px-4 py-6 lg:px-6">
                {children}
              </main>
            </div>
          </div>
        </GroupProvider>
      </AuthGate>
    </AuthProvider>
  );
}
