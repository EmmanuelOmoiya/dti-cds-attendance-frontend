"use client";

import { useState } from "react";
import { KeyRound, TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ActionDialog, Consequence } from "@/components/common/action-dialog";
import { CopyButton } from "@/components/common/copy-button";
import { Field, NativeSelect } from "@/components/common/form";
import { devicesApi } from "@/lib/api/endpoints";
import type { Device, DeviceCredentials, DeviceStatus } from "@/lib/api/types";
import { useGroups } from "@/lib/group-context";
import { useApiMutation } from "@/lib/use-api-mutation";

export const DEVICE_INVALIDATE = [["devices"], ["groups"]];
export const DEVICE_IDENTIFIER_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]{2,63}$/;

/**
 * Shows a device secret exactly once. The secret lives only in this component's state (never in
 * the query cache, URL, storage or logs) and is discarded when the dialog closes.
 */
function SecretRevealDialogBody({ credentials, onClose, title }: { credentials: DeviceCredentials | null; onClose: () => void; title: string }) {
  const [confirmed, setConfirmed] = useState(false);
  const [shown, setShown] = useState(false);
  if (!credentials) return null;
  return (
    <Dialog open onOpenChange={(o) => !o && confirmed && onClose()}>
      <DialogContent className="sm:max-w-lg" showCloseButton={false} onInteractOutside={(e) => e.preventDefault()} onEscapeKeyDown={(e) => !confirmed && e.preventDefault()}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <KeyRound className="size-4" /> {title}
          </DialogTitle>
          <DialogDescription>Load these credentials onto the device now. The secret is shown only once and cannot be retrieved again.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-3">
          <Field label="Device identifier">
            <Input readOnly value={credentials.deviceIdentifier} className="font-mono" />
          </Field>
          <div className="grid gap-1.5">
            <span className="text-sm font-medium">Device secret</span>
            <div className="flex gap-2">
              <Input
                readOnly
                value={shown ? credentials.secret : "•".repeat(Math.min(credentials.secret.length, 48))}
                className="font-mono text-xs"
                aria-label="Device secret"
                onFocus={(e) => shown && e.currentTarget.select()}
              />
              <Button type="button" variant="outline" size="sm" onClick={() => setShown((s) => !s)}>
                {shown ? "Hide" : "Show"}
              </Button>
              <CopyButton value={credentials.secret} />
            </div>
          </div>
          <div className="flex gap-2 rounded-md border border-warning/30 bg-warning-soft px-3 py-2 text-sm text-[oklch(0.4_0.09_60)]">
            <TriangleAlert className="mt-0.5 size-4 shrink-0" />
            <span>{credentials.notice} Do not paste it into chat, email or tickets. If it is lost, rotate the credentials.</span>
          </div>
          <label className="flex items-start gap-2 text-sm">
            <Checkbox checked={confirmed} onCheckedChange={(c) => setConfirmed(c === true)} className="mt-0.5" />
            I have stored the secret on the device or in a secure place.
          </label>
        </div>
        <DialogFooter>
          <Button disabled={!confirmed} onClick={onClose}>
            Done
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function RegisterDeviceDialogBody({ open, onOpenChange, onRegistered }: { open: boolean; onOpenChange: (o: boolean) => void; onRegistered: (r: { device: Device; credentials: DeviceCredentials }) => void }) {
  const { groups, activeGroupId } = useGroups();
  const activeGroups = groups.filter((g) => g.status === "ACTIVE");
  const [identifier, setIdentifier] = useState("");
  const [name, setName] = useState("");
  const [groupId, setGroupId] = useState(() => activeGroupId ?? (activeGroups.length === 1 ? activeGroups[0].id : ""));
  const valid = DEVICE_IDENTIFIER_PATTERN.test(identifier.trim()) && name.trim().length >= 2 && !!groupId;
  const mutation = useApiMutation({
    mutationFn: () => devicesApi.register({ deviceIdentifier: identifier.trim(), name: name.trim(), assignedGroupId: groupId }),
    invalidate: DEVICE_INVALIDATE,
    success: "Device registered (pending activation)",
    onSuccess: (r) => {
      mutation.reset();
      onOpenChange(false);
      onRegistered(r);
    },
  });
  return (
    <ActionDialog
      open={open}
      onOpenChange={(o) => {
        if (!o) mutation.reset();
        onOpenChange(o);
      }}
      title="Register device"
      description="The device starts as Pending and cannot sync until you activate it. A one-time secret is shown after registration."
      confirmLabel="Register device"
      pending={mutation.isPending}
      error={mutation.error}
      confirmDisabled={!valid}
      onSubmit={() => mutation.mutate()}
    >
      <Field
        label="Device identifier"
        required
        description="Public ID printed on the reader, e.g. DTI-DEV-0001. It is not a credential."
        error={identifier && !DEVICE_IDENTIFIER_PATTERN.test(identifier.trim()) ? "3–64 letters, digits, dots, dashes or underscores" : undefined}
      >
        <Input value={identifier} onChange={(e) => setIdentifier(e.target.value)} className="font-mono" autoComplete="off" />
      </Field>
      <Field label="Name" required>
        <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Main hall reader" maxLength={120} />
      </Field>
      <Field label="Assigned CDS group" required description="The device can only record attendance for this group's sessions.">
        <NativeSelect value={groupId} onChange={(e) => setGroupId(e.target.value)}>
          <option value="">Choose a group…</option>
          {activeGroups.map((g) => (
            <option key={g.id} value={g.id}>
              {g.name}
            </option>
          ))}
        </NativeSelect>
      </Field>
    </ActionDialog>
  );
}

function EditDeviceDialogBody({ device, open, onOpenChange }: { device: Device; open: boolean; onOpenChange: (o: boolean) => void }) {
  const { groups } = useGroups();
  const [name, setName] = useState(device.name);
  const [groupId, setGroupId] = useState(device.assignedGroupId);
  const mutation = useApiMutation({
    mutationFn: () =>
      devicesApi.update(device.id, {
        name: name.trim() !== device.name ? name.trim() : undefined,
        assignedGroupId: groupId !== device.assignedGroupId ? groupId : undefined,
      }),
    invalidate: DEVICE_INVALIDATE,
    success: "Device updated",
    onSuccess: () => onOpenChange(false),
  });
  return (
    <ActionDialog
      open={open}
      onOpenChange={(o) => {
        if (!o) mutation.reset();
        onOpenChange(o);
      }}
      title="Edit device"
      confirmLabel="Save"
      pending={mutation.isPending}
      error={mutation.error}
      confirmDisabled={name.trim().length < 2}
      onSubmit={() => mutation.mutate()}
    >
      <Field label="Name" required>
        <Input value={name} onChange={(e) => setName(e.target.value)} maxLength={120} />
      </Field>
      <Field label="Assigned CDS group" required>
        <NativeSelect value={groupId} onChange={(e) => setGroupId(e.target.value)}>
          {groups
            .filter((g) => g.status === "ACTIVE" || g.id === device.assignedGroupId)
            .map((g) => (
              <option key={g.id} value={g.id}>
                {g.name}
              </option>
            ))}
        </NativeSelect>
      </Field>
      {groupId !== device.assignedGroupId && (
        <Consequence>After moving, the device only resolves sessions of the new group. It downloads the new roster on its next sync. Past attendance stays with the original sessions.</Consequence>
      )}
    </ActionDialog>
  );
}

export type DeviceAction = "activate" | "suspend" | "revoke" | "decommission" | "rotate";

/** Allowed source statuses per action (mirrors backend devices.service TRANSITIONS). */
export const DEVICE_TRANSITIONS: Record<DeviceAction, DeviceStatus[]> = {
  activate: ["PENDING", "SUSPENDED"],
  suspend: ["PENDING", "ACTIVE"],
  revoke: ["PENDING", "ACTIVE", "SUSPENDED"],
  decommission: ["PENDING", "ACTIVE", "SUSPENDED", "REVOKED"],
  rotate: ["PENDING", "ACTIVE", "SUSPENDED"],
};

const ACTION_COPY: Record<DeviceAction, { title: string; confirm: string; tone: "info" | "warning" | "danger"; body: string; destructive?: boolean }> = {
  activate: {
    title: "Activate device",
    confirm: "Activate",
    tone: "info",
    body: "The device will be allowed to authenticate and synchronize attendance for its group.",
  },
  suspend: {
    title: "Suspend device",
    confirm: "Suspend",
    tone: "warning",
    body: "Temporary: the device is refused immediately on its next request, even with a valid token. Taps it stores offline will upload once it is re-activated. You can activate it again at any time.",
  },
  revoke: {
    title: "Revoke device",
    confirm: "Revoke permanently",
    tone: "danger",
    destructive: true,
    body: "Permanent: use for a lost, stolen or compromised reader. It will never be permitted to synchronize again and its credentials stop working immediately. Attendance it already uploaded is kept. Taps still stored on it will not be accepted.",
  },
  decommission: {
    title: "Decommission device",
    confirm: "Decommission",
    tone: "danger",
    destructive: true,
    body: "Permanent: retires the reader from service. It can never synchronize again. Make sure it has uploaded all pending taps first. Historical attendance is kept.",
  },
  rotate: {
    title: "Rotate credentials",
    confirm: "Rotate credentials",
    tone: "warning",
    body: "A new secret is issued and shown once. The old secret and every token issued with it stop working immediately, so the device cannot sync until the new secret is loaded onto it.",
  },
};

function DeviceActionDialogBody({
  device,
  action,
  onClose,
  onRotated,
}: {
  device: Device;
  action: DeviceAction | null;
  onClose: () => void;
  onRotated: (c: DeviceCredentials) => void;
}) {
  const [reason, setReason] = useState("");
  const [typed, setTyped] = useState("");
  const mutation = useApiMutation({
    mutationFn: async () => {
      if (action === "rotate") {
        const r = await devicesApi.rotateCredentials(device.id);
        return { kind: "rotate" as const, credentials: r.credentials };
      }
      await devicesApi.transition(device.id, action!, reason.trim() || undefined);
      return { kind: "status" as const };
    },
    invalidate: DEVICE_INVALIDATE,
    success: action === "rotate" ? "Credentials rotated" : `Device ${action === "activate" ? "activated" : action === "suspend" ? "suspended" : action === "revoke" ? "revoked" : "decommissioned"}`,
    onSuccess: (r) => {
      mutation.reset();
      onClose();
      if (r.kind === "rotate") onRotated(r.credentials);
    },
  });
  if (!action) return null;
  const copy = ACTION_COPY[action];
  const needsTyping = action === "revoke" || action === "decommission";
  return (
    <ActionDialog
      open
      onOpenChange={(o) => {
        if (!o) {
          mutation.reset();
          onClose();
        }
      }}
      title={`${copy.title}: ${device.deviceIdentifier}`}
      confirmLabel={copy.confirm}
      destructive={copy.destructive}
      pending={mutation.isPending}
      error={mutation.error}
      confirmDisabled={needsTyping && typed.trim().toUpperCase() !== device.deviceIdentifier}
      onSubmit={() => mutation.mutate()}
    >
      <Consequence tone={copy.tone}>{copy.body}</Consequence>
      {action !== "rotate" && (
        <Field label="Reason" description="Recorded with the status change and in the audit log.">
          <Textarea rows={2} value={reason} onChange={(e) => setReason(e.target.value)} maxLength={1000} />
        </Field>
      )}
      {needsTyping && (
        <Field label={`Type ${device.deviceIdentifier} to confirm`} required>
          <Input value={typed} onChange={(e) => setTyped(e.target.value)} className="font-mono" autoComplete="off" />
        </Field>
      )}
    </ActionDialog>
  );
}

export function SecretRevealDialog(props: React.ComponentProps<typeof SecretRevealDialogBody>) {
  return props.credentials ? <SecretRevealDialogBody key={props.credentials.secret} {...props} /> : null;
}

export function RegisterDeviceDialog(props: React.ComponentProps<typeof RegisterDeviceDialogBody>) {
  return props.open ? <RegisterDeviceDialogBody {...props} /> : null;
}

export function EditDeviceDialog(props: React.ComponentProps<typeof EditDeviceDialogBody>) {
  return props.open ? <EditDeviceDialogBody {...props} /> : null;
}

export function DeviceActionDialog(props: React.ComponentProps<typeof DeviceActionDialogBody>) {
  return props.action ? <DeviceActionDialogBody key={props.action} {...props} /> : null;
}
