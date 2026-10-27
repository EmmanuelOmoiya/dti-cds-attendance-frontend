"use client";

import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { ArrowRight } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ActionDialog, Consequence } from "@/components/common/action-dialog";
import { Field, FormGrid, NativeSelect } from "@/components/common/form";
import { MemberPicker } from "@/features/members/member-picker";
import { cardsApi, membersApi } from "@/lib/api/endpoints";
import type {
  Card,
  CardAssignment,
  CardRevokeReason,
  Member,
  ReplacementReason,
  UserAssignmentEndReason,
} from "@/lib/api/types";
import { DISPLAY_TIMEZONE, formatDateTime, localInputToIso, nowLocalInput, zoneAbbreviation } from "@/lib/datetime";
import { ASSIGNMENT_END_REASON_LABELS, CARD_REVOKE_REASON_LABELS } from "@/lib/labels";
import { useApiMutation } from "@/lib/use-api-mutation";

export const CARD_INVALIDATE = [["cards"], ["card-assignments"], ["members"]];
const ZONE = DISPLAY_TIMEZONE;
const ABBR = zoneAbbreviation(ZONE);

/** Card UIDs are hex (4–16 bytes); separators ':' '-' ' ' are accepted and stripped by the backend. */
export function normalizeUidInput(raw: string): string {
  return raw.replace(/[\s:-]/g, "").toUpperCase();
}
export function isValidUid(raw: string): boolean {
  return /^[0-9A-F]{8,32}$/.test(normalizeUidInput(raw)) && normalizeUidInput(raw).length % 2 === 0;
}

/** Chooses a card from stock or by UID (unknown UIDs are registered by the backend on assignment). */
function CardChooser({ mode, setMode, cardId, setCardId, uid, setUid, excludeId }: {
  mode: "stock" | "uid";
  setMode: (m: "stock" | "uid") => void;
  cardId: string;
  setCardId: (v: string) => void;
  uid: string;
  setUid: (v: string) => void;
  excludeId?: string;
}) {
  const stock = useQuery({
    queryKey: ["cards", "list", { status: "UNASSIGNED", pageSize: 100 }],
    queryFn: ({ signal }) => cardsApi.list({ status: "UNASSIGNED", pageSize: 100, sort: "createdAt:desc" }, signal),
  });
  const options = (stock.data?.data ?? []).filter((c) => c.id !== excludeId);
  return (
    <div className="grid gap-3">
      <div role="radiogroup" aria-label="Choose card" className="flex gap-4 text-sm">
        <label className="flex items-center gap-1.5">
          <input type="radio" checked={mode === "stock"} onChange={() => setMode("stock")} /> From stock
        </label>
        <label className="flex items-center gap-1.5">
          <input type="radio" checked={mode === "uid"} onChange={() => setMode("uid")} /> Enter or scan UID
        </label>
      </div>
      {mode === "stock" ? (
        <Field label="Card in stock" required description={stock.data && stock.data.meta.total > 100 ? "Showing the 100 most recent. Enter the UID for others." : undefined}>
          <NativeSelect value={cardId} onChange={(e) => setCardId(e.target.value)} disabled={stock.isPending}>
            <option value="">{stock.isPending ? "Loading…" : options.length ? "Choose a card…" : "No unassigned cards in stock"}</option>
            {options.map((c) => (
              <option key={c.id} value={c.id}>
                {c.label ? `${c.label} · ` : ""}
                {c.cardUid}
              </option>
            ))}
          </NativeSelect>
        </Field>
      ) : (
        <Field label="Card UID" required error={uid && !isValidUid(uid) ? "Hex UID, 4–16 bytes (e.g. 04A1B2C3D4E5F6)" : undefined} description="Unregistered UIDs are added to the inventory automatically.">
          <Input value={uid} onChange={(e) => setUid(e.target.value)} placeholder="04:A1:B2:C3:D4:E5:F6" autoComplete="off" className="font-mono" />
        </Field>
      )}
    </div>
  );
}

function RegisterCardDialogBody({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const [uid, setUid] = useState("");
  const [labelText, setLabel] = useState("");
  const mutation = useApiMutation({
    mutationFn: () => cardsApi.register({ cardUid: uid, label: labelText.trim() || undefined }),
    invalidate: CARD_INVALIDATE,
    success: (c) => `Card ${c.cardUid} added to stock`,
    onSuccess: () => onOpenChange(false),
  });
  return (
    <ActionDialog
      open={open}
      onOpenChange={(o) => {
        if (!o) mutation.reset();
        onOpenChange(o);
      }}
      title="Register card"
      description="Adds a blank card to the shared inventory. Only the UID is stored; no personal data is written to the card."
      confirmLabel="Add to stock"
      pending={mutation.isPending}
      error={mutation.error}
      confirmDisabled={!isValidUid(uid)}
      onSubmit={() => mutation.mutate()}
    >
      <Field label="Card UID" required error={uid && !isValidUid(uid) ? "Hex UID, 4–16 bytes" : undefined}>
        <Input value={uid} onChange={(e) => setUid(e.target.value)} className="font-mono" autoComplete="off" autoFocus />
      </Field>
      <Field label="Printed label" description="Optional serial or sticker number.">
        <Input value={labelText} onChange={(e) => setLabel(e.target.value)} maxLength={64} />
      </Field>
    </ActionDialog>
  );
}

/** Assign a card to a member. Either the member or the card can be fixed by the caller. */
function AssignCardDialogBody({
  open,
  onOpenChange,
  member: fixedMember,
  card: fixedCard,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  member?: Member;
  card?: Card;
}) {
  const [member, setMember] = useState<Member | null>(fixedMember ?? null);
  const [mode, setMode] = useState<"stock" | "uid">("stock");
  const [cardId, setCardId] = useState("");
  const [uid, setUid] = useState("");
  const [backdate, setBackdate] = useState("");

  const mutation = useApiMutation({
    mutationFn: () =>
      cardsApi.assign({
        memberId: member!.id,
        ...(fixedCard ? { cardId: fixedCard.id } : mode === "stock" ? { cardId } : { cardUid: uid }),
        assignedAt: backdate ? (localInputToIso(backdate, ZONE) ?? undefined) : undefined,
      }),
    invalidate: CARD_INVALIDATE,
    success: (a) => `Card ${a.card.cardUid} assigned to ${a.member.fullName}`,
    onSuccess: () => onOpenChange(false),
  });

  const cardReady = fixedCard ? true : mode === "stock" ? !!cardId : isValidUid(uid);
  const memberHasCard = !!member?.activeCard;

  return (
    <ActionDialog
      open={open}
      onOpenChange={(o) => {
        if (!o) mutation.reset();
        onOpenChange(o);
      }}
      title="Assign card"
      confirmLabel="Assign card"
      pending={mutation.isPending}
      error={mutation.error}
      confirmDisabled={!member || !cardReady || memberHasCard}
      onSubmit={() => mutation.mutate()}
      size="lg"
    >
      {fixedCard ? (
        <Field label="Card">
          <Input value={`${fixedCard.label ? `${fixedCard.label} · ` : ""}${fixedCard.cardUid}`} readOnly disabled className="font-mono" />
        </Field>
      ) : (
        <CardChooser mode={mode} setMode={setMode} cardId={cardId} setCardId={setCardId} uid={uid} setUid={setUid} />
      )}
      {fixedMember ? (
        <Field label="Member">
          <Input value={`${fixedMember.fullName} (${fixedMember.stateCode})`} readOnly disabled />
        </Field>
      ) : (
        <div className="grid gap-1.5">
          <span className="text-sm font-medium">Member *</span>
          <MemberPicker value={member} onChange={setMember} />
        </div>
      )}
      {memberHasCard && (
        <Consequence tone="danger">
          {member!.fullName} already holds card {member!.activeCard!.cardUid}. Use <strong>Replace card</strong> on the member’s page instead.
        </Consequence>
      )}
      <Field label={`Received at (${ABBR})`} description="Leave empty for now. Back-dating lets taps made before today count; it is recorded in the audit log.">
        <Input type="datetime-local" value={backdate} max={nowLocalInput(ZONE)} onChange={(e) => setBackdate(e.target.value)} />
      </Field>
    </ActionDialog>
  );
}

const REPLACEMENT_REASONS: ReplacementReason[] = ["LOST", "DAMAGED", "STOLEN", "OTHER"];

function ReplaceCardDialogBody({ member, open, onOpenChange }: { member: Member; open: boolean; onOpenChange: (o: boolean) => void }) {
  const [mode, setMode] = useState<"stock" | "uid">("stock");
  const [cardId, setCardId] = useState("");
  const [uid, setUid] = useState("");
  const [reason, setReason] = useState<ReplacementReason>("LOST");
  const [note, setNote] = useState("");

  const stock = useQuery({
    queryKey: ["cards", "list", { status: "UNASSIGNED", pageSize: 100 }],
    queryFn: ({ signal }) => cardsApi.list({ status: "UNASSIGNED", pageSize: 100, sort: "createdAt:desc" }, signal),
    enabled: open,
  });
  const newLabel = mode === "stock" ? (stock.data?.data.find((c) => c.id === cardId)?.cardUid ?? "") : normalizeUidInput(uid);

  const mutation = useApiMutation({
    mutationFn: () => membersApi.replaceCard(member.id, { ...(mode === "stock" ? { newCardId: cardId } : { newCardUid: uid }), reason, note: note.trim() || undefined }),
    invalidate: CARD_INVALIDATE,
    success: (r) => `Card replaced. New card ${r.assignment.card.cardUid} is active.`,
    onSuccess: () => onOpenChange(false),
  });
  const old = member.activeCard;
  if (!old) return null;
  const revokesOld = reason !== "OTHER";

  return (
    <ActionDialog
      open={open}
      onOpenChange={(o) => {
        if (!o) mutation.reset();
        onOpenChange(o);
      }}
      title={`Replace ${member.fullName}'s card`}
      confirmLabel="Replace card"
      pending={mutation.isPending}
      error={mutation.error}
      confirmDisabled={mode === "stock" ? !cardId : !isValidUid(uid)}
      onSubmit={() => mutation.mutate()}
      size="lg"
    >
      <div className="grid items-center gap-3 rounded-md border p-3 text-sm sm:grid-cols-[1fr_auto_1fr]">
        <div>
          <p className="text-xs text-muted-foreground">Current assignment (ends now)</p>
          <p className="font-mono">{old.cardUid}</p>
          <p className="text-xs text-muted-foreground">since {formatDateTime(old.assignedAt)}</p>
        </div>
        <ArrowRight className="hidden size-4 text-muted-foreground sm:block" aria-hidden />
        <div>
          <p className="text-xs text-muted-foreground">New assignment (starts now)</p>
          <p className="font-mono">{newLabel || "—"}</p>
        </div>
      </div>
      <CardChooser mode={mode} setMode={setMode} cardId={cardId} setCardId={setCardId} uid={uid} setUid={setUid} excludeId={old.id} />
      <FormGrid>
        <Field label="Reason" required>
          <NativeSelect value={reason} onChange={(e) => setReason(e.target.value as ReplacementReason)}>
            {REPLACEMENT_REASONS.map((r) => (
              <option key={r} value={r}>
                {CARD_REVOKE_REASON_LABELS[r]}
              </option>
            ))}
          </NativeSelect>
        </Field>
        <Field label="Note">
          <Input value={note} onChange={(e) => setNote(e.target.value)} maxLength={1000} />
        </Field>
      </FormGrid>
      <Consequence tone={revokesOld ? "warning" : "info"}>
        Taps with the old card before now stay valid; taps after now are rejected.{" "}
        {revokesOld ? "The old card will be revoked and cannot be reused until reinstated." : "The old card returns to stock."} The assignment history is kept.
      </Consequence>
    </ActionDialog>
  );
}

const END_REASONS: UserAssignmentEndReason[] = ["RETURNED", "LOST", "DAMAGED", "STOLEN", "MEMBER_LEFT", "REVOKED", "OTHER"];
const REVOKING = new Set<UserAssignmentEndReason>(["LOST", "DAMAGED", "STOLEN", "REVOKED"]);

function EndAssignmentDialogBody({ assignment, onClose }: { assignment: CardAssignment | null; onClose: () => void }) {
  const [reason, setReason] = useState<UserAssignmentEndReason>("RETURNED");
  const [at, setAt] = useState("");
  const [note, setNote] = useState("");
  const mutation = useApiMutation({
    mutationFn: () => cardsApi.endAssignment(assignment!.id, { reason, endedAt: at ? (localInputToIso(at, ZONE) ?? undefined) : undefined, note: note.trim() || undefined }),
    invalidate: CARD_INVALIDATE,
    success: "Card assignment ended",
    onSuccess: onClose,
  });
  if (!assignment) return null;
  return (
    <ActionDialog
      open
      onOpenChange={(o) => {
        if (!o) {
          mutation.reset();
          onClose();
        }
      }}
      title={`Take back card ${assignment.card.cardUid}`}
      description={`Held by ${assignment.member.fullName} since ${formatDateTime(assignment.assignedAt)}.`}
      confirmLabel="End assignment"
      destructive={REVOKING.has(reason)}
      pending={mutation.isPending}
      error={mutation.error}
      onSubmit={() => mutation.mutate()}
    >
      <FormGrid>
        <Field label="Reason" required>
          <NativeSelect value={reason} onChange={(e) => setReason(e.target.value as UserAssignmentEndReason)}>
            {END_REASONS.map((r) => (
              <option key={r} value={r}>
                {ASSIGNMENT_END_REASON_LABELS[r]}
              </option>
            ))}
          </NativeSelect>
        </Field>
        <Field label={`Ended at (${ABBR})`} description="Empty = now.">
          <Input type="datetime-local" value={at} max={nowLocalInput(ZONE)} onChange={(e) => setAt(e.target.value)} />
        </Field>
      </FormGrid>
      <Field label="Note">
        <Textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} maxLength={1000} />
      </Field>
      <Consequence tone={REVOKING.has(reason) ? "danger" : "info"}>
        {REVOKING.has(reason) ? "The physical card will also be revoked: it cannot be assigned again until reinstated." : "The card returns to the shared stock and can be assigned to someone else."} The member will have no active card.
      </Consequence>
    </ActionDialog>
  );
}

const REVOKE_REASONS: CardRevokeReason[] = ["LOST", "DAMAGED", "STOLEN", "RETIRED", "OTHER"];

function RevokeCardDialogBody({ card, open, onOpenChange }: { card: Card & { currentAssignment?: CardAssignment | null }; open: boolean; onOpenChange: (o: boolean) => void }) {
  const [reason, setReason] = useState<CardRevokeReason>("LOST");
  const [note, setNote] = useState("");
  const mutation = useApiMutation({
    mutationFn: () => cardsApi.revoke(card.id, { reason, note: note.trim() || undefined }),
    invalidate: CARD_INVALIDATE,
    success: "Card revoked",
    onSuccess: () => onOpenChange(false),
  });
  return (
    <ActionDialog
      open={open}
      onOpenChange={(o) => {
        if (!o) mutation.reset();
        onOpenChange(o);
      }}
      title={`Revoke card ${card.cardUid}?`}
      confirmLabel="Revoke card"
      destructive
      pending={mutation.isPending}
      error={mutation.error}
      onSubmit={() => mutation.mutate()}
    >
      <Field label="Reason" required>
        <NativeSelect value={reason} onChange={(e) => setReason(e.target.value as CardRevokeReason)}>
          {REVOKE_REASONS.map((r) => (
            <option key={r} value={r}>
              {CARD_REVOKE_REASON_LABELS[r]}
            </option>
          ))}
        </NativeSelect>
      </Field>
      <Field label="Note">
        <Textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} maxLength={1000} />
      </Field>
      <Consequence tone="danger">
        {card.currentAssignment ? `${card.currentAssignment.member.fullName}'s assignment ends now. ` : ""}
        Taps with this card from now on are rejected. Earlier taps stay valid. The card can be reinstated later if found.
      </Consequence>
    </ActionDialog>
  );
}

export function RegisterCardDialog(props: React.ComponentProps<typeof RegisterCardDialogBody>) {
  return props.open ? <RegisterCardDialogBody {...props} /> : null;
}

export function AssignCardDialog(props: React.ComponentProps<typeof AssignCardDialogBody>) {
  return props.open ? <AssignCardDialogBody {...props} /> : null;
}

export function ReplaceCardDialog(props: React.ComponentProps<typeof ReplaceCardDialogBody>) {
  return props.open ? <ReplaceCardDialogBody {...props} /> : null;
}

export function EndAssignmentDialog(props: React.ComponentProps<typeof EndAssignmentDialogBody>) {
  return props.assignment ? <EndAssignmentDialogBody key={props.assignment.id} {...props} /> : null;
}

export function RevokeCardDialog(props: React.ComponentProps<typeof RevokeCardDialogBody>) {
  return props.open ? <RevokeCardDialogBody {...props} /> : null;
}
