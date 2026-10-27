"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Consequence } from "@/components/common/action-dialog";
import { Field } from "@/components/common/form";
import { DefinitionList, PageHeader, Panel } from "@/components/common/page-header";
import { InlineError } from "@/components/common/states";
import { authApi } from "@/lib/api/endpoints";
import { isApiError } from "@/lib/api/errors";
import { useAuth, useCurrentUser } from "@/lib/auth/auth-context";
import { DISPLAY_TIMEZONE, formatDateTime } from "@/lib/datetime";
import { ROLE_DESCRIPTIONS, ROLE_LABELS } from "@/lib/permissions";
import { useApiMutation } from "@/lib/use-api-mutation";

const PASSWORD_MIN = 10;
export const passwordSchema = z
  .object({
    currentPassword: z.string().min(1, "Enter your current password"),
    newPassword: z.string().min(PASSWORD_MIN, `At least ${PASSWORD_MIN} characters`).max(128),
    confirm: z.string(),
  })
  .refine((v) => v.newPassword === v.confirm, { path: ["confirm"], message: "Passwords do not match" })
  .refine((v) => v.newPassword !== v.currentPassword, { path: ["newPassword"], message: "Choose a different password" });
type Values = z.infer<typeof passwordSchema>;

function ChangePassword() {
  const { signOut } = useAuth();
  const form = useForm<Values>({ resolver: zodResolver(passwordSchema), defaultValues: { currentPassword: "", newPassword: "", confirm: "" } });
  const mutation = useApiMutation({
    mutationFn: (v: Values) => authApi.changePassword({ currentPassword: v.currentPassword, newPassword: v.newPassword }),
    success: "Password changed. Please sign in again.",
    // The backend revokes every refresh token of the user, including this session's.
    onSuccess: () => void signOut(),
  });
  const e = form.formState.errors;
  const wrongCurrent = isApiError(mutation.error) && mutation.error.code === "INVALID_CREDENTIALS";
  return (
    <form id="password" noValidate onSubmit={form.handleSubmit((v) => mutation.mutate(v))} className="grid max-w-md gap-4 p-4">
      <Field label="Current password" error={wrongCurrent ? "Current password is incorrect" : e.currentPassword?.message} required>
        <Input type="password" autoComplete="current-password" {...form.register("currentPassword")} />
      </Field>
      <Field label="New password" error={e.newPassword?.message} required description={`At least ${PASSWORD_MIN} characters.`}>
        <Input type="password" autoComplete="new-password" {...form.register("newPassword")} />
      </Field>
      <Field label="Confirm new password" error={e.confirm?.message} required>
        <Input type="password" autoComplete="new-password" {...form.register("confirm")} />
      </Field>
      {!wrongCurrent && <InlineError error={mutation.error} />}
      <Consequence tone="info">Changing your password signs you out of every session, including this one.</Consequence>
      <div>
        <Button type="submit" disabled={mutation.isPending}>
          {mutation.isPending && <Loader2 className="animate-spin" />}
          Change password
        </Button>
      </div>
    </form>
  );
}

export function SettingsPage() {
  const user = useCurrentUser();
  return (
    <>
      <PageHeader title="Settings" description="Your account and security. System options (session timing, generation horizon, rate limits) are configured on the server and are not editable here." />
      <div className="grid gap-6 lg:grid-cols-2">
        <Panel title="Account details">
          <DefinitionList
            columns={1}
            items={[
              { label: "Name", value: user.fullName },
              { label: "Email", value: user.email },
              { label: "Role", value: `${ROLE_LABELS[user.role]}. ${ROLE_DESCRIPTIONS[user.role]}` },
              { label: "Groups", value: user.role === "SUPER_ADMIN" ? "All groups" : user.groups.map((g) => g.name).join(", ") || "None assigned" },
              { label: "Last sign-in", value: formatDateTime(user.lastLoginAt) },
              { label: "Display timezone", value: `${DISPLAY_TIMEZONE} (session times use each session's own timezone)` },
            ]}
          />
          <p className="border-t px-4 py-3 text-xs text-muted-foreground">To change your name or role, ask a super administrator.</p>
        </Panel>
        <Panel title="Change password">
          <ChangePassword />
        </Panel>
      </div>
    </>
  );
}
