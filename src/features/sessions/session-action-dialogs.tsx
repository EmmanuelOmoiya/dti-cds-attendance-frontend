"use client";

import { useState } from "react";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ActionDialog, Consequence } from "@/components/common/action-dialog";
import { Field, FormGrid, NativeSelect } from "@/components/common/form";
import { sessionsApi } from "@/lib/api/endpoints";
import type { SessionDetail, UserCancellationReason } from "@/lib/api/types";
import { formatDateTime, isoToLocalInput, localInputToIso, zoneAbbreviation } from "@/lib/datetime";
import { CANCELLATION_REASON_LABELS, USER_CANCELLATION_REASONS } from "@/lib/labels";
import { useApiMutation } from "@/lib/use-api-mutation";

export type SessionAction = "open" | "close" | "confirm" | "cancel" | "reinstate";

const INVALIDATE = [["sessions"], ["attendance"], ["reports"], ["schedules"], ["attendance-events"]];

/** Default auto-close grace (SESSION_CLOSE_GRACE_MINUTES); only used to pre-fill the form. */
const CLOSE_GRACE_MS = 30 * 60_000;

export function SessionActionDialog({ session, action, onClose }: { session: SessionDetail; action: SessionAction | null; onClose: () => void }) {
  if (!action) return null;
  return <SessionActionDialogBody key={action} session={session} action={action} onClose={onClose} />;
}

function SessionActionDialogBody({ session, action, onClose }: { session: SessionDetail; action: SessionAction; onClose: () => void }) {
  const tz = session.timezone;
  const [reason, setReason] = useState<UserCancellationReason>("NOT_HELD");
  const [note, setNote] = useState("");
  const [voidRecords, setVoidRecords] = useState(false);
  const [reprocess, setReprocess] = useState(true);
  const [openedAt, setOpenedAt] = useState(() => isoToLocalInput(session.plannedStart, tz));
  const [closedAt, setClosedAt] = useState(() => isoToLocalInput(new Date(new Date(session.plannedEnd).getTime() + CLOSE_GRACE_MS).toISOString(), tz));

  const present = session.attendanceSummary.present;

  const mutation = useApiMutation({
    mutationFn: async () => {
      switch (action) {
        case "open":
          return sessionsApi.open(session.id);
        case "close":
          return sessionsApi.close(session.id);
        case "confirm":
          return sessionsApi.confirmHeld(session.id, {
            openedAt: localInputToIso(openedAt, tz) ?? undefined,
            closedAt: localInputToIso(closedAt, tz) ?? undefined,
            note: note.trim() || undefined,
          });
        case "cancel":
          return sessionsApi.cancel(session.id, { reason, note: note.trim() || undefined, voidExistingAttendance: present > 0 ? voidRecords : undefined });
        case "reinstate":
          return sessionsApi.reinstate(session.id, { note: note.trim(), reprocessRejectedEvents: reprocess });
        default:
          throw new Error("No action");
      }
    },
    invalidate: INVALIDATE,
    success: (r) => {
      const res = r as { voidedRecords?: number; restoredRecords?: number; reprocessing?: { recordsCreated: number } };
      switch (action) {
        case "open":
          return "Session opened. Attendance is being taken live.";
        case "close":
          return "Attendance closed. Taps captured before now are still accepted when uploaded.";
        case "confirm":
          return "Session confirmed as held";
        case "cancel":
          return res.voidedRecords ? `Session cancelled · ${res.voidedRecords} record(s) voided` : "Session cancelled";
        case "reinstate":
          return `Session reinstated · ${res.restoredRecords ?? 0} record(s) restored${res.reprocessing ? ` · ${res.reprocessing.recordsCreated} tap(s) recovered` : ""}`;
        default:
          return "Done";
      }
    },
    onSuccess: onClose,
  });

  const common = {
    open: true,
    onOpenChange: (o: boolean) => {
      if (!o) {
        mutation.reset();
        onClose();
      }
    },
    pending: mutation.isPending,
    error: mutation.error,
    onSubmit: () => mutation.mutate(),
  };

  const abbr = zoneAbbreviation(tz, session.plannedStart);

  if (action === "open")
    return (
      <ActionDialog {...common} title="Open this session now?" confirmLabel="Open session">
        <p className="text-sm">
          Opening confirms that the meeting is happening now. It can only be done around the planned time ({formatDateTime(session.plannedStart, tz)}).
        </p>
        <Consequence tone="info">Device taps are accepted inside the admission window regardless; opening records that an authorized person confirmed the meeting.</Consequence>
      </ActionDialog>
    );

  if (action === "close")
    return (
      <ActionDialog {...common} title="Close attendance?" confirmLabel="Close attendance">
        <p className="text-sm">The session will be marked held and closed at the current time.</p>
        <Consequence tone="info">
          Readers may be offline. Taps captured before the close time are still accepted when they upload later (flagged as late sync). Taps captured after it are rejected.
        </Consequence>
      </ActionDialog>
    );

  if (action === "confirm")
    return (
      <ActionDialog {...common} title="Confirm the meeting was held" confirmLabel="Confirm held" size="lg">
        <p className="text-sm">Use this after the meeting when nobody opened it live. Only an authorized person can make a meeting count; device taps never do.</p>
        <FormGrid>
          <Field label={`Actual start (${abbr})`} description="Defaults to the planned start.">
            <Input type="datetime-local" value={openedAt} onChange={(e) => setOpenedAt(e.target.value)} />
          </Field>
          <Field label={`Attendance closed at (${abbr})`} description="Defaults to the planned end plus the close grace. Taps after this are rejected.">
            <Input type="datetime-local" value={closedAt} onChange={(e) => setClosedAt(e.target.value)} />
          </Field>
        </FormGrid>
        <Field label="Note" description="Optional, recorded in the audit log.">
          <Textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} maxLength={1000} />
        </Field>
      </ActionDialog>
    );

  if (action === "cancel") {
    const noteRequired = session.status === "CLOSED";
    return (
      <ActionDialog
        {...common}
        title="Cancel this session"
        description="Record that the meeting did not take place. No attendance is expected from members for a cancelled session."
        confirmLabel="Cancel session"
        destructive
        confirmDisabled={(noteRequired && !note.trim()) || (present > 0 && !voidRecords)}
      >
        <Field label="Reason" required>
          <NativeSelect value={reason} onChange={(e) => setReason(e.target.value as UserCancellationReason)}>
            {USER_CANCELLATION_REASONS.map((r) => (
              <option key={r} value={r}>
                {CANCELLATION_REASON_LABELS[r]}
              </option>
            ))}
          </NativeSelect>
        </Field>
        <Field label="Note" required={noteRequired} description={noteRequired ? "Required: this session was already confirmed held." : "Optional detail, e.g. the holiday name."}>
          <Textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} maxLength={1000} />
        </Field>
        {present > 0 && (
          <>
            <Consequence tone="danger">
              This session has {present} attendance record{present === 1 ? "" : "s"}. Cancelling voids them (they are kept in history and restored if the session is reinstated).
            </Consequence>
            <label className="flex items-start gap-2 text-sm">
              <Checkbox checked={voidRecords} onCheckedChange={(c) => setVoidRecords(c === true)} className="mt-0.5" />
              <span>I understand that {present} record{present === 1 ? "" : "s"} will be voided</span>
            </label>
          </>
        )}
      </ActionDialog>
    );
  }

  return (
    <ActionDialog {...common} title="Reinstate this session" confirmLabel="Reinstate session" confirmDisabled={note.trim().length < 3}>
      <p className="text-sm">
        The session returns to Scheduled, or to Unresolved if its resolution deadline has passed. Records voided by the cancellation are restored. It must then be confirmed held to count.
      </p>
      <Field label="Reason for reinstating" required>
        <Textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} maxLength={1000} />
      </Field>
      <label className="flex items-start gap-2 text-sm">
        <Checkbox checked={reprocess} onCheckedChange={(c) => setReprocess(c === true)} className="mt-0.5" />
        <span>
          Re-evaluate taps that were rejected because the session was cancelled
          <span className="block text-xs text-muted-foreground">Creates recovered records where those taps are now valid.</span>
        </span>
      </label>
    </ActionDialog>
  );
}
