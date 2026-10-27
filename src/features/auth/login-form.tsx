"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useQueryClient } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/common/form";
import { toApiError } from "@/lib/api/client";
import { ApiError, errorMessage } from "@/lib/api/errors";
import type { CurrentUser } from "@/lib/api/types";
import { ME_QUERY_KEY } from "@/lib/auth/auth-context";

export const loginSchema = z.object({
  email: z.email("Enter a valid email address").max(254),
  password: z.string().min(1, "Enter your password").max(128),
});
type LoginValues = z.infer<typeof loginSchema>;

/** Only same-site relative paths are accepted as a post-login destination (no open redirects). */
export function safeNext(next: string | null): string {
  if (!next || !next.startsWith("/") || next.startsWith("//") || next.startsWith("/\\") || next.startsWith("/login")) return "/overview";
  return next;
}

export function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const queryClient = useQueryClient();
  const [error, setError] = useState<unknown>(null);
  const reason = params.get("reason");

  const form = useForm<LoginValues>({ resolver: zodResolver(loginSchema), defaultValues: { email: "", password: "" } });

  const onSubmit = form.handleSubmit(async (values) => {
    setError(null);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "content-type": "application/json", "x-dla-client": "dashboard" },
        body: JSON.stringify(values),
      });
      if (!res.ok) throw await toApiError(res);
      const body = (await res.json()) as { data: CurrentUser | null };
      queryClient.clear();
      if (body.data) queryClient.setQueryData(ME_QUERY_KEY, body.data);
      router.replace(safeNext(params.get("next")));
    } catch (e) {
      setError(e instanceof ApiError ? e : new ApiError(0, "BACKEND_UNAVAILABLE", "Network error"));
      form.setValue("password", "");
      form.setFocus("password");
    }
  });

  const submitting = form.formState.isSubmitting;
  const disabledAccount = error instanceof ApiError && error.status === 403;

  return (
    <form onSubmit={onSubmit} noValidate className="grid gap-4">
      {reason === "expired" && !error && (
        <Alert>
          <AlertDescription>Your session ended. Sign in again to continue.</AlertDescription>
        </Alert>
      )}
      {error ? (
        <Alert variant="destructive" role="alert">
          <AlertDescription>
            {disabledAccount
              ? "This account is disabled. Contact a super administrator."
              : error instanceof ApiError && error.status === 429
                ? "Too many sign-in attempts. Wait a minute and try again."
                : errorMessage(error)}
          </AlertDescription>
        </Alert>
      ) : null}
      <Field label="Email" error={form.formState.errors.email?.message} required>
        <Input type="email" autoComplete="username" autoFocus {...form.register("email")} />
      </Field>
      <Field label="Password" error={form.formState.errors.password?.message} required>
        <Input type="password" autoComplete="current-password" {...form.register("password")} />
      </Field>
      <Button type="submit" size="lg" disabled={submitting} className="mt-1 w-full">
        {submitting && <Loader2 className="animate-spin" />}
        {submitting ? "Signing in…" : "Sign in"}
      </Button>
      <p className="text-center text-xs text-muted-foreground">
        Forgotten your password? Ask a super administrator to reset it. Self-service reset is not available.
      </p>
    </form>
  );
}
