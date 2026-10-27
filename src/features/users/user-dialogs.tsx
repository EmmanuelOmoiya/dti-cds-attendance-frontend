"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { ActionDialog, Consequence } from "@/components/common/action-dialog";
import { Field, FormGrid, NativeSelect } from "@/components/common/form";
import { usersApi } from "@/lib/api/endpoints";
import type { Role, User } from "@/lib/api/types";
import { useGroups } from "@/lib/group-context";
import { ROLE_DESCRIPTIONS, ROLE_LABELS } from "@/lib/permissions";
import { useApiMutation } from "@/lib/use-api-mutation";

export const PASSWORD_MIN = 10;
const ROLES: Role[] = ["SUPER_ADMIN", "CDS_ADMIN", "LGI_VIEWER"];
const USER_INVALIDATE = [["users"], ["groups"]];

export function GroupChecklist({ value, onChange }: { value: string[]; onChange: (ids: string[]) => void }) {
  const { groups } = useGroups();
  if (!groups.length) return <p className="text-sm text-muted-foreground">No groups exist yet.</p>;
  return (
    <div className="max-h-48 overflow-y-auto rounded-lg border p-2">
      {groups.map((g) => (
        <label key={g.id} className="flex items-center gap-2 rounded px-1.5 py-1 text-sm hover:bg-muted">
          <Checkbox checked={value.includes(g.id)} onCheckedChange={(c) => onChange(c === true ? [...value, g.id] : value.filter((v) => v !== g.id))} />
          {g.name}
          {g.status === "INACTIVE" && <span className="text-xs text-muted-foreground">(inactive)</span>}
        </label>
      ))}
    </div>
  );
}

const createSchema = z.object({
  fullName: z.string().trim().min(2, "At least 2 characters").max(120),
  email: z.email("Enter a valid email").max(254),
  role: z.enum(["SUPER_ADMIN", "CDS_ADMIN", "LGI_VIEWER"]),
  password: z.string().min(PASSWORD_MIN, `At least ${PASSWORD_MIN} characters`).max(128),
});
type CreateValues = z.infer<typeof createSchema>;

function CreateUserDialogBody({ open, onOpenChange, onCreated }: { open: boolean; onOpenChange: (o: boolean) => void; onCreated: (u: User) => void }) {
  const form = useForm<CreateValues>({ resolver: zodResolver(createSchema), defaultValues: { fullName: "", email: "", role: "CDS_ADMIN", password: "" } });
  const [groupIds, setGroupIds] = useState<string[]>([]);
  const role = form.watch("role");
  const mutation = useApiMutation({
    mutationFn: (v: CreateValues) => usersApi.create({ ...v, groupIds: v.role === "SUPER_ADMIN" ? undefined : groupIds }),
    invalidate: USER_INVALIDATE,
    success: "User created",
    onSuccess: (u) => {
      onOpenChange(false);
      onCreated(u);
    },
  });
  const e = form.formState.errors;
  return (
    <ActionDialog
      open={open}
      onOpenChange={(o) => {
        if (!o) mutation.reset();
        onOpenChange(o);
      }}
      title="Create user"
      description="Invitations are not supported by the backend. Share the initial password securely and ask the user to change it after signing in."
      confirmLabel="Create user"
      pending={mutation.isPending}
      error={mutation.error}
      onSubmit={form.handleSubmit((v) => mutation.mutate(v))}
      size="lg"
    >
      <FormGrid>
        <Field label="Full name" error={e.fullName?.message} required>
          <Input {...form.register("fullName")} autoComplete="off" />
        </Field>
        <Field label="Email" error={e.email?.message} required>
          <Input type="email" {...form.register("email")} autoComplete="off" />
        </Field>
        <Field label="Role" required description={ROLE_DESCRIPTIONS[role]}>
          <NativeSelect {...form.register("role")}>
            {ROLES.map((r) => (
              <option key={r} value={r}>
                {ROLE_LABELS[r]}
              </option>
            ))}
          </NativeSelect>
        </Field>
        <Field label="Initial password" error={e.password?.message} required description={`At least ${PASSWORD_MIN} characters.`}>
          <Input type="password" {...form.register("password")} autoComplete="new-password" />
        </Field>
      </FormGrid>
      {role !== "SUPER_ADMIN" && (
        <div className="grid gap-1.5">
          <span className="text-sm font-medium">CDS groups this user can access</span>
          <GroupChecklist value={groupIds} onChange={setGroupIds} />
          {groupIds.length === 0 && <p className="text-xs text-[oklch(0.45_0.11_60)]">Without groups the user can sign in but will see no data.</p>}
        </div>
      )}
    </ActionDialog>
  );
}

function EditUserDialogBody({ user, open, onOpenChange, isSelf }: { user: User; open: boolean; onOpenChange: (o: boolean) => void; isSelf: boolean }) {
  const [fullName, setFullName] = useState(user.fullName);
  const [role, setRole] = useState<Role>(user.role);
  const mutation = useApiMutation({
    mutationFn: () => usersApi.update(user.id, { fullName: fullName.trim() !== user.fullName ? fullName.trim() : undefined, role: role !== user.role ? role : undefined }),
    invalidate: USER_INVALIDATE,
    success: "User updated",
    onSuccess: () => onOpenChange(false),
  });
  return (
    <ActionDialog
      open={open}
      onOpenChange={(o) => {
        if (!o) mutation.reset();
        onOpenChange(o);
      }}
      title="Edit user"
      confirmLabel="Save"
      pending={mutation.isPending}
      error={mutation.error}
      confirmDisabled={fullName.trim().length < 2}
      onSubmit={() => mutation.mutate()}
    >
      <Field label="Full name" required>
        <Input value={fullName} onChange={(e) => setFullName(e.target.value)} />
      </Field>
      <Field label="Role" description={isSelf ? "You cannot change your own role." : ROLE_DESCRIPTIONS[role]}>
        <NativeSelect value={role} onChange={(e) => setRole(e.target.value as Role)} disabled={isSelf}>
          {ROLES.map((r) => (
            <option key={r} value={r}>
              {ROLE_LABELS[r]}
            </option>
          ))}
        </NativeSelect>
      </Field>
      {role === "SUPER_ADMIN" && user.role !== "SUPER_ADMIN" && <Consequence>Super admins have access to every group; their group scopes are removed.</Consequence>}
    </ActionDialog>
  );
}

function GroupScopesDialogBody({ user, open, onOpenChange }: { user: User; open: boolean; onOpenChange: (o: boolean) => void }) {
  const [ids, setIds] = useState<string[]>(user.groups.map((g) => g.id));
  const mutation = useApiMutation({ mutationFn: () => usersApi.setGroupScopes(user.id, ids), invalidate: USER_INVALIDATE, success: "Group access updated", onSuccess: () => onOpenChange(false) });
  return (
    <ActionDialog
      open={open}
      onOpenChange={(o) => {
        if (!o) mutation.reset();
        onOpenChange(o);
      }}
      title={`Group access for ${user.fullName}`}
      description="Replaces the user&apos;s group scopes. Changes take effect on their next request."
      confirmLabel="Save access"
      pending={mutation.isPending}
      error={mutation.error}
      onSubmit={() => mutation.mutate()}
    >
      <GroupChecklist value={ids} onChange={setIds} />
    </ActionDialog>
  );
}

function ResetPasswordDialogBody({ user, open, onOpenChange }: { user: User; open: boolean; onOpenChange: (o: boolean) => void }) {
  const [pw, setPw] = useState("");
  const [confirm, setConfirm] = useState("");
  const mutation = useApiMutation({ mutationFn: () => usersApi.resetPassword(user.id, pw), invalidate: USER_INVALIDATE, success: "Password reset. The user's sessions were signed out.", onSuccess: () => onOpenChange(false) });
  const mismatch = !!confirm && pw !== confirm;
  return (
    <ActionDialog
      open={open}
      onOpenChange={(o) => {
        if (!o) mutation.reset();
        onOpenChange(o);
      }}
      title={`Reset password for ${user.fullName}`}
      confirmLabel="Reset password"
      destructive
      pending={mutation.isPending}
      error={mutation.error}
      confirmDisabled={pw.length < PASSWORD_MIN || pw !== confirm}
      onSubmit={() => mutation.mutate()}
    >
      <Field label="New password" required error={pw && pw.length < PASSWORD_MIN ? `At least ${PASSWORD_MIN} characters` : undefined}>
        <Input type="password" value={pw} onChange={(e) => setPw(e.target.value)} autoComplete="new-password" />
      </Field>
      <Field label="Confirm new password" required error={mismatch ? "Passwords do not match" : undefined}>
        <Input type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} autoComplete="new-password" />
      </Field>
      <Consequence>All of this user's sessions are signed out immediately.</Consequence>
    </ActionDialog>
  );
}

function UserStatusDialogBody({ user, open, onOpenChange }: { user: User; open: boolean; onOpenChange: (o: boolean) => void }) {
  const disabling = user.status === "ACTIVE";
  const mutation = useApiMutation({
    mutationFn: () => (disabling ? usersApi.disable(user.id) : usersApi.enable(user.id)),
    invalidate: USER_INVALIDATE,
    success: disabling ? "User disabled" : "User enabled",
    onSuccess: () => onOpenChange(false),
  });
  return (
    <ActionDialog
      open={open}
      onOpenChange={(o) => {
        if (!o) mutation.reset();
        onOpenChange(o);
      }}
      title={disabling ? `Disable ${user.fullName}?` : `Enable ${user.fullName}?`}
      confirmLabel={disabling ? "Disable user" : "Enable user"}
      destructive={disabling}
      pending={mutation.isPending}
      error={mutation.error}
      onSubmit={() => mutation.mutate()}
    >
      <Consequence tone={disabling ? "danger" : "info"}>
        {disabling ? "The user is signed out everywhere and refused on their next request. Their past actions stay in the audit log." : "The user can sign in again with their existing password."}
      </Consequence>
    </ActionDialog>
  );
}

export function CreateUserDialog(props: React.ComponentProps<typeof CreateUserDialogBody>) {
  return props.open ? <CreateUserDialogBody {...props} /> : null;
}

export function EditUserDialog(props: React.ComponentProps<typeof EditUserDialogBody>) {
  return props.open ? <EditUserDialogBody {...props} /> : null;
}

export function GroupScopesDialog(props: React.ComponentProps<typeof GroupScopesDialogBody>) {
  return props.open ? <GroupScopesDialogBody {...props} /> : null;
}

export function ResetPasswordDialog(props: React.ComponentProps<typeof ResetPasswordDialogBody>) {
  return props.open ? <ResetPasswordDialogBody {...props} /> : null;
}

export function UserStatusDialog(props: React.ComponentProps<typeof UserStatusDialogBody>) {
  return props.open ? <UserStatusDialogBody {...props} /> : null;
}
