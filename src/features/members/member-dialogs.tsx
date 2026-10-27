"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ActionDialog, Consequence } from "@/components/common/action-dialog";
import { Field, FormGrid, NativeSelect } from "@/components/common/form";
import { membersApi, membershipsApi } from "@/lib/api/endpoints";
import { fieldErrors } from "@/lib/api/errors";
import type { Member, Membership, UserMembershipEndReason } from "@/lib/api/types";
import { DISPLAY_TIMEZONE, formatDateTime, isoToLocalInput, localInputToIso, nowLocalInput, zoneAbbreviation } from "@/lib/datetime";
import { useGroups } from "@/lib/group-context";
import { MEMBERSHIP_END_REASON_LABELS } from "@/lib/labels";
import { useApiMutation } from "@/lib/use-api-mutation";

export const MEMBER_INVALIDATE = [["members"], ["memberships"], ["groups"], ["reports"], ["cards"], ["card-assignments"]];
const ZONE = DISPLAY_TIMEZONE;
const ABBR = zoneAbbreviation(ZONE);

/** NYSC state codes look like LA/24A/1234; the backend accepts letters, digits, '/', '-', spaces. */
export const STATE_CODE_PATTERN = /^[A-Za-z0-9][A-Za-z0-9/ -]{2,30}$/;

const memberSchema = z.object({
  fullName: z.string().trim().min(2, "At least 2 characters").max(120),
  stateCode: z.string().trim().regex(STATE_CODE_PATTERN, "Use the NYSC format, e.g. LA/25A/1234"),
  groupId: z.string(),
  joinedAt: z.string(),
});
type MemberValues = z.infer<typeof memberSchema>;

/** Register a member (with their first membership) or edit identity fields. */
export function MemberFormDialog({
  open,
  onOpenChange,
  member,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  member?: Member;
  onSaved?: (m: Member) => void;
}) {
  const { groups, activeGroupId } = useGroups();
  const activeGroups = groups.filter((g) => g.status === "ACTIVE");
  const form = useForm<MemberValues>({
    resolver: zodResolver(
      member ? memberSchema : memberSchema.refine((v) => !!v.groupId, { path: ["groupId"], message: "Choose a group" }),
    ),
  });

  useEffect(() => {
    if (!open) return;
    form.reset({
      fullName: member?.fullName ?? "",
      stateCode: member?.stateCode ?? "",
      groupId: activeGroupId ?? (activeGroups.length === 1 ? activeGroups[0].id : ""),
      joinedAt: nowLocalInput(ZONE),
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, member]);

  const mutation = useApiMutation({
    mutationFn: (v: MemberValues) =>
      member
        ? membersApi.update(member.id, {
            fullName: v.fullName !== member.fullName ? v.fullName : undefined,
            stateCode: v.stateCode.toUpperCase().replace(/\s+/g, "") !== member.stateCode ? v.stateCode : undefined,
          })
        : membersApi.create({ fullName: v.fullName, stateCode: v.stateCode, groupId: v.groupId, joinedAt: localInputToIso(v.joinedAt, ZONE) ?? undefined }),
    invalidate: MEMBER_INVALIDATE,
    success: member ? "Member updated" : "Member registered",
    onSuccess: (m) => {
      onOpenChange(false);
      onSaved?.(m);
    },
  });

  useEffect(() => {
    for (const [field, message] of Object.entries(fieldErrors(mutation.error))) form.setError(field as keyof MemberValues, { message });
    if (mutation.error && (mutation.error as { code?: string }).code === "STATE_CODE_TAKEN") form.setError("stateCode", { message: "A member with this state code already exists" });
  }, [mutation.error, form]);

  const e = form.formState.errors;
  return (
    <ActionDialog
      open={open}
      onOpenChange={(o) => {
        if (!o) mutation.reset();
        onOpenChange(o);
      }}
      title={member ? "Edit member" : "Register member"}
      description={member ? "Identity details only. Use Transfer or memberships to change the group." : "Creates the person and their first CDS group membership."}
      confirmLabel={member ? "Save changes" : "Register member"}
      pending={mutation.isPending}
      error={Object.keys(fieldErrors(mutation.error)).length || (mutation.error as { code?: string } | null)?.code === "STATE_CODE_TAKEN" ? null : mutation.error}
      onSubmit={form.handleSubmit((v) => mutation.mutate(v))}
      size="lg"
    >
      <FormGrid>
        <Field label="Full name" error={e.fullName?.message} required>
          <Input autoComplete="off" {...form.register("fullName")} />
        </Field>
        <Field label="State code" error={e.stateCode?.message} required description="Stored in upper case without spaces.">
          <Input autoComplete="off" placeholder="LA/25A/1234" {...form.register("stateCode")} />
        </Field>
        {!member && (
          <>
            <Field label="CDS group" error={e.groupId?.message} required>
              <NativeSelect {...form.register("groupId")}>
                <option value="">Choose a group…</option>
                {activeGroups.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.name}
                  </option>
                ))}
              </NativeSelect>
            </Field>
            <Field label={`Joined at (${ABBR})`} error={e.joinedAt?.message} description="The member is expected only at sessions that start at or after this time.">
              <Input type="datetime-local" {...form.register("joinedAt")} />
            </Field>
          </>
        )}
      </FormGrid>
    </ActionDialog>
  );
}

function TransferDialogBody({ member, open, onOpenChange }: { member: Member; open: boolean; onOpenChange: (o: boolean) => void }) {
  const { groups } = useGroups();
  const targets = groups.filter((g) => g.status === "ACTIVE" && g.id !== member.currentGroup?.id);
  const [toGroupId, setTo] = useState("");
  const [at, setAt] = useState(() => nowLocalInput(ZONE));
  const [note, setNote] = useState("");
  const mutation = useApiMutation({
    mutationFn: () => membersApi.transfer(member.id, { toGroupId, effectiveAt: localInputToIso(at, ZONE) ?? undefined, note: note.trim() || undefined }),
    invalidate: MEMBER_INVALIDATE,
    success: "Member transferred",
    onSuccess: () => onOpenChange(false),
  });
  const target = groups.find((g) => g.id === toGroupId);
  return (
    <ActionDialog
      open={open}
      onOpenChange={(o) => {
        if (!o) mutation.reset();
        onOpenChange(o);
      }}
      title={`Transfer ${member.fullName}`}
      confirmLabel="Transfer member"
      pending={mutation.isPending}
      error={mutation.error}
      confirmDisabled={!toGroupId || !at}
      onSubmit={() => mutation.mutate()}
    >
      <Field label="From">
        <Input value={member.currentGroup?.name ?? "No current group"} readOnly disabled />
      </Field>
      <Field label="To CDS group" required>
        <NativeSelect value={toGroupId} onChange={(e) => setTo(e.target.value)}>
          <option value="">Choose a group…</option>
          {targets.map((g) => (
            <option key={g.id} value={g.id}>
              {g.name}
            </option>
          ))}
        </NativeSelect>
      </Field>
      <Field label={`Effective at (${ABBR})`} required description="The old membership ends and the new one starts at this exact moment.">
        <Input type="datetime-local" value={at} onChange={(e) => setAt(e.target.value)} />
      </Field>
      <Field label="Note">
        <Textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} maxLength={1000} />
      </Field>
      {target && (
        <Consequence tone="info">
          Sessions starting before this time stay with {member.currentGroup?.name ?? "the old group"}; sessions from then on are expected in {target.name}. The member keeps their NFC card.
        </Consequence>
      )}
    </ActionDialog>
  );
}

function DeactivateMemberDialogBody({ member, open, onOpenChange }: { member: Member; open: boolean; onOpenChange: (o: boolean) => void }) {
  const [at, setAt] = useState(() => nowLocalInput(ZONE));
  const [note, setNote] = useState("");
  const reactivating = member.status === "INACTIVE";
  const mutation = useApiMutation({
    mutationFn: () => (reactivating ? membersApi.reactivate(member.id) : membersApi.deactivate(member.id, { effectiveAt: localInputToIso(at, ZONE) ?? undefined, note: note.trim() || undefined })),
    invalidate: MEMBER_INVALIDATE,
    success: reactivating ? "Member reactivated" : "Member deactivated",
    onSuccess: () => onOpenChange(false),
  });
  return (
    <ActionDialog
      open={open}
      onOpenChange={(o) => {
        if (!o) mutation.reset();
        onOpenChange(o);
      }}
      title={reactivating ? `Reactivate ${member.fullName}?` : `Deactivate ${member.fullName}?`}
      confirmLabel={reactivating ? "Reactivate" : "Deactivate member"}
      destructive={!reactivating}
      pending={mutation.isPending}
      error={mutation.error}
      onSubmit={() => mutation.mutate()}
    >
      {reactivating ? (
        <Consequence tone="info">The person record becomes active again. Memberships and cards are not restored automatically: add a membership and assign a card explicitly.</Consequence>
      ) : (
        <>
          <Field label={`Effective at (${ABBR})`} description="Cannot be in the future.">
            <Input type="datetime-local" value={at} max={nowLocalInput(ZONE)} onChange={(e) => setAt(e.target.value)} />
          </Field>
          <Field label="Note" description="For example: service completed.">
            <Textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} maxLength={1000} />
          </Field>
          <Consequence>
            Ends the current membership and the active card assignment at this time (the card returns to stock). Taps after this are rejected. History is kept.
          </Consequence>
        </>
      )}
    </ActionDialog>
  );
}

function AddMembershipDialogBody({ member, open, onOpenChange }: { member: Member; open: boolean; onOpenChange: (o: boolean) => void }) {
  const { groups } = useGroups();
  const [groupId, setGroupId] = useState("");
  const [at, setAt] = useState(() => nowLocalInput(ZONE));
  const mutation = useApiMutation({
    mutationFn: () => membershipsApi.create({ memberId: member.id, groupId, joinedAt: localInputToIso(at, ZONE)! }),
    invalidate: MEMBER_INVALIDATE,
    success: "Membership added",
    onSuccess: () => onOpenChange(false),
  });
  return (
    <ActionDialog
      open={open}
      onOpenChange={(o) => {
        if (!o) mutation.reset();
        onOpenChange(o);
      }}
      title="Add membership"
      description="For a member re-joining a group, or a new posting after a gap. Memberships of one person can never overlap."
      confirmLabel="Add membership"
      pending={mutation.isPending}
      error={mutation.error}
      confirmDisabled={!groupId || !at}
      onSubmit={() => mutation.mutate()}
    >
      <Field label="CDS group" required>
        <NativeSelect value={groupId} onChange={(e) => setGroupId(e.target.value)}>
          <option value="">Choose a group…</option>
          {groups
            .filter((g) => g.status === "ACTIVE")
            .map((g) => (
              <option key={g.id} value={g.id}>
                {g.name}
              </option>
            ))}
        </NativeSelect>
      </Field>
      <Field label={`Joined at (${ABBR})`} required>
        <Input type="datetime-local" value={at} onChange={(e) => setAt(e.target.value)} />
      </Field>
    </ActionDialog>
  );
}

const END_REASONS: UserMembershipEndReason[] = ["SERVICE_COMPLETED", "REMOVED", "DATA_CORRECTION", "OTHER"];

function EndMembershipDialogBody({ membership, onClose }: { membership: Membership | null; onClose: () => void }) {
  const [at, setAt] = useState(() => nowLocalInput(ZONE));
  const [reason, setReason] = useState<UserMembershipEndReason>("SERVICE_COMPLETED");
  const [note, setNote] = useState("");
  const mutation = useApiMutation({
    mutationFn: () => membershipsApi.end(membership!.id, { leftAt: localInputToIso(at, ZONE) ?? undefined, reason, note: note.trim() || undefined }),
    invalidate: MEMBER_INVALIDATE,
    success: "Membership ended",
    onSuccess: onClose,
  });
  if (!membership) return null;
  return (
    <ActionDialog
      open
      onOpenChange={(o) => {
        if (!o) {
          mutation.reset();
          onClose();
        }
      }}
      title={`End membership in ${membership.group?.name ?? "group"}`}
      confirmLabel="End membership"
      destructive
      pending={mutation.isPending}
      error={mutation.error}
      onSubmit={() => mutation.mutate()}
    >
      <Field label={`Left at (${ABBR})`} required description="Sessions starting at or after this moment are no longer expected.">
        <Input type="datetime-local" value={at} onChange={(e) => setAt(e.target.value)} />
      </Field>
      <Field label="Reason" required>
        <NativeSelect value={reason} onChange={(e) => setReason(e.target.value as UserMembershipEndReason)}>
          {END_REASONS.map((r) => (
            <option key={r} value={r}>
              {MEMBERSHIP_END_REASON_LABELS[r]}
            </option>
          ))}
        </NativeSelect>
      </Field>
      <Field label="Note">
        <Textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} maxLength={1000} />
      </Field>
      <Consequence>The server refuses the change if it would leave existing attendance records outside the membership period. Void those records first if they are wrong.</Consequence>
    </ActionDialog>
  );
}

/** Correct historical dates (data-entry mistakes), audited with before/after values. */
function CorrectMembershipDialogBody({ membership, onClose }: { membership: Membership | null; onClose: () => void }) {
  const [joined, setJoined] = useState(() => isoToLocalInput(membership?.joinedAt, ZONE));
  const [left, setLeft] = useState(() => isoToLocalInput(membership?.leftAt, ZONE));
  const [note, setNote] = useState("");
  const mutation = useApiMutation({
    mutationFn: () => {
      const m = membership!;
      const joinedIso = localInputToIso(joined, ZONE);
      const leftIso = left ? localInputToIso(left, ZONE) : null;
      const sameJoin = joinedIso && new Date(joinedIso).getTime() === new Date(m.joinedAt).getTime();
      const sameLeft = (leftIso === null && m.leftAt === null) || (leftIso && m.leftAt && new Date(leftIso).getTime() === new Date(m.leftAt).getTime());
      return membershipsApi.correct(m.id, {
        joinedAt: sameJoin ? undefined : (joinedIso ?? undefined),
        leftAt: sameLeft ? undefined : leftIso,
        note: note.trim(),
      });
    },
    invalidate: MEMBER_INVALIDATE,
    success: "Membership corrected",
    onSuccess: onClose,
  });
  if (!membership) return null;
  return (
    <ActionDialog
      open
      onOpenChange={(o) => {
        if (!o) {
          mutation.reset();
          onClose();
        }
      }}
      title="Correct membership dates"
      description={`Currently ${formatDateTime(membership.joinedAt)} → ${membership.leftAt ? formatDateTime(membership.leftAt) : "present"}.`}
      confirmLabel="Save correction"
      pending={mutation.isPending}
      error={mutation.error}
      confirmDisabled={note.trim().length < 3 || !joined}
      onSubmit={() => mutation.mutate()}
    >
      <FormGrid>
        <Field label={`Joined at (${ABBR})`} required>
          <Input type="datetime-local" value={joined} onChange={(e) => setJoined(e.target.value)} />
        </Field>
        <Field label={`Left at (${ABBR})`} description="Clear to re-open the membership.">
          <Input type="datetime-local" value={left} onChange={(e) => setLeft(e.target.value)} />
        </Field>
      </FormGrid>
      <Field label="Why is this being corrected?" required description="Recorded with the before/after values in the audit log.">
        <Textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} maxLength={1000} />
      </Field>
      <Consequence tone="info">After correcting dates, rejected taps from this member can be re-evaluated on the Device taps tab.</Consequence>
    </ActionDialog>
  );
}

export function TransferDialog(props: React.ComponentProps<typeof TransferDialogBody>) {
  return props.open ? <TransferDialogBody {...props} /> : null;
}

export function DeactivateMemberDialog(props: React.ComponentProps<typeof DeactivateMemberDialogBody>) {
  return props.open ? <DeactivateMemberDialogBody {...props} /> : null;
}

export function AddMembershipDialog(props: React.ComponentProps<typeof AddMembershipDialogBody>) {
  return props.open ? <AddMembershipDialogBody {...props} /> : null;
}

export function EndMembershipDialog(props: React.ComponentProps<typeof EndMembershipDialogBody>) {
  return props.membership ? <EndMembershipDialogBody key={props.membership.id} {...props} /> : null;
}

export function CorrectMembershipDialog(props: React.ComponentProps<typeof CorrectMembershipDialogBody>) {
  return props.membership ? <CorrectMembershipDialogBody key={props.membership.id} {...props} /> : null;
}
