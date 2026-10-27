"use client";

import { useState } from "react";
import { Textarea } from "@/components/ui/textarea";
import { ActionDialog, Consequence } from "@/components/common/action-dialog";
import { DefinitionList } from "@/components/common/page-header";
import { Field } from "@/components/common/form";
import { attendanceApi } from "@/lib/api/endpoints";
import { formatDate, formatDateTime } from "@/lib/datetime";
import { useApiMutation } from "@/lib/use-api-mutation";

export const ATTENDANCE_INVALIDATE = [["attendance"], ["sessions"], ["reports"], ["members"], ["attendance-events"]];

export interface CorrectionTarget {
  kind: "add" | "void" | "restore";
  recordId?: string;
  sessionId: string;
  memberId: string;
  memberName: string;
  stateCode: string;
  sessionTitle: string;
  occurrenceDate: string;
  capturedAt?: string | null;
  timezone?: string;
}

/**
 * Manual attendance corrections. Every change requires a note, shows the existing record and the
 * proposed change, and is recorded in the audit log by the backend. Records are voided, never deleted.
 */
export function CorrectionDialog({ target, onClose }: { target: CorrectionTarget | null; onClose: () => void }) {
  if (!target) return null;
  return <CorrectionDialogBody key={`${target.kind}-${target.memberId}-${target.recordId ?? ""}`} target={target} onClose={onClose} />;
}

function CorrectionDialogBody({ target, onClose }: { target: CorrectionTarget; onClose: () => void }) {
  const [note, setNote] = useState("");

  const mutation = useApiMutation({
    mutationFn: () => {
      const t = target;
      if (t.kind === "add") return attendanceApi.createManual({ sessionId: t.sessionId, memberId: t.memberId, note: note.trim() });
      if (t.kind === "void") return attendanceApi.void(t.recordId!, note.trim());
      return attendanceApi.restore(t.recordId!, note.trim());
    },
    invalidate: ATTENDANCE_INVALIDATE,
    success: () => (target.kind === "add" ? "Attendance recorded" : target.kind === "void" ? "Record voided" : "Record restored"),
    onSuccess: onClose,
  });

  const titles = {
    add: "Record attendance manually",
    void: "Void attendance record",
    restore: "Restore voided record",
  } as const;
  const proposed = {
    add: "A new PRESENT record (source: manual entry) will be created.",
    void: "The record will be marked VOIDED. It stays in history and can be restored.",
    restore: "The record will be marked PRESENT again.",
  } as const;
  const tooShort = note.trim().length < 3;

  return (
    <ActionDialog
      open
      onOpenChange={(o) => {
        if (!o) {
          mutation.reset();
          onClose();
        }
      }}
      title={titles[target.kind]}
      confirmLabel={target.kind === "add" ? "Record attendance" : target.kind === "void" ? "Void record" : "Restore record"}
      destructive={target.kind === "void"}
      pending={mutation.isPending}
      error={mutation.error}
      confirmDisabled={tooShort}
      onSubmit={() => mutation.mutate()}
    >
      <div className="rounded-md border">
        <DefinitionList
          items={[
            { label: "Member", value: `${target.memberName} (${target.stateCode})` },
            { label: "Session", value: `${target.sessionTitle} · ${formatDate(target.occurrenceDate)}` },
            { label: "Current record", value: target.kind === "add" ? "None" : target.kind === "void" ? `Present, recorded ${formatDateTime(target.capturedAt, target.timezone)}` : "Voided" },
            { label: "Proposed change", value: proposed[target.kind] },
          ]}
        />
      </div>
      {target.kind === "add" && (
        <Consequence tone="info">
          The member must have been a member of the group at the session start. There is no override for ineligible members: correct the membership dates instead.
        </Consequence>
      )}
      <Field label="Reason for this correction" required description="Recorded in the audit log, e.g. “Card forgotten, verified by CDS president”.">
        <Textarea rows={3} value={note} onChange={(e) => setNote(e.target.value)} maxLength={1000} />
      </Field>
    </ActionDialog>
  );
}
