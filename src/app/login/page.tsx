import type { Metadata } from "next";
import { Nfc } from "lucide-react";
import { Suspense } from "react";
import { LoginForm } from "@/features/auth/login-form";

export const metadata: Metadata = { title: "Sign in" };

export default function LoginPage() {
  return (
    <div className="grid min-h-screen lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
      <div className="relative hidden flex-col justify-between bg-sidebar p-10 text-sidebar-foreground lg:flex">
        <div className="flex items-center gap-2.5">
          <span className="flex size-8 items-center justify-center rounded-md bg-sidebar-primary text-sidebar-primary-foreground">
            <Nfc className="size-4" aria-hidden />
          </span>
          <span className="text-sm font-semibold text-sidebar-primary">DTI CDS Digital Attendance</span>
        </div>
        <div className="max-w-md space-y-3">
          <h2 className="text-2xl font-semibold tracking-tight text-sidebar-primary">Attendance administration for NYSC CDS groups</h2>
          <p className="text-sm leading-relaxed text-sidebar-foreground/80">
            Manage members, NFC cards, meeting sessions and readers. Attendance captured offline is judged by the time of the tap, not the time it was uploaded.
          </p>
        </div>
        <p className="text-xs text-sidebar-foreground/60">Authorized personnel only. Activity is recorded in the audit log.</p>
      </div>
      <div className="flex items-center justify-center p-6">
        <div className="w-full max-w-sm">
          <div className="mb-6 space-y-1">
            <div className="mb-4 flex items-center gap-2 lg:hidden">
              <span className="flex size-8 items-center justify-center rounded-md bg-primary text-primary-foreground">
                <Nfc className="size-4" aria-hidden />
              </span>
              <span className="text-sm font-semibold">DTI CDS Digital Attendance</span>
            </div>
            <h1 className="text-xl font-semibold tracking-tight">Sign in</h1>
            <p className="text-sm text-muted-foreground">Use the account your administrator created for you.</p>
          </div>
          <Suspense>
            <LoginForm />
          </Suspense>
        </div>
      </div>
    </div>
  );
}
