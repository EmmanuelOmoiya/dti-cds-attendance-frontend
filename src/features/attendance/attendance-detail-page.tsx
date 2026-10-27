"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useState } from "react";
import { Ban, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Consequence } from "@/components/common/action-dialog";
import { DefinitionList, PageHeader, Panel } from "@/components/common/page-header";
import { AckBadge, Pill, SessionStatusBadge } from "@/components/common/status-badge";
import { BlockSkeleton, ErrorState } from "@/components/common/states";
import { attendanceApi } from "@/lib/api/endpoints";
import { useCan } from "@/lib/auth/auth-context";
import { formatDate, formatDateTime, formatDuration } from "@/lib/datetime";
import { useGroups } from "@/lib/group-context";
import { SOURCE_LABELS } from "@/lib/labels";
import { Permission } from "@/lib/permissions";
import { CorrectionDialog, type CorrectionTarget } from "./correction-dialogs";

export function AttendanceDetailPage({ id }: { id: string }) {
  const canCorrect = useCan(Permission.ATTENDANCE_CORRECT);
  const { groupName } = useGroups();
  const [correction, setCorrection] = useState<CorrectionTarget | null>(null);
  const record = useQuery({ queryKey: ["attendance", "detail", id], queryFn: ({ signal }) => attendanceApi.get(id, signal) });
  const r = record.data;
  if (record.error) return <ErrorState error={record.error} onRetry={() => record.refetch()} />;
  if (!r) return <BlockSkeleton className="h-64" />;

  const ev = r.sourceEvent;
  const delay = ev ? new Date(ev.receivedAt).getTime() - new Date(ev.capturedAt).getTime() : null;

  return (
    <>
      <PageHeader
        breadcrumbs={[{ label: "Attendance", href: "/attendance" }, { label: r.member.fullName }]}
        title={`${r.member.fullName} · ${formatDate(r.session.occurrenceDate)}`}
        description={r.session.title}
        meta={
          <>
            {r.status === "PRESENT" ? <Pill tone="success">Present</Pill> : <Pill tone="muted">Voided</Pill>}
            <Pill>{SOURCE_LABELS[r.source]}</Pill>
            {r.lateSync && <Pill tone="info">Synced after close</Pill>}
          </>
        }
        actions={
          canCorrect &&
          r.session.status !== "CANCELLED" && (
            <Button
              variant={r.status === "PRESENT" ? "destructive" : "outline"}
              onClick={() =>
                setCorrection({
                  kind: r.status === "PRESENT" ? "void" : "restore",
                  recordId: r.id,
                  sessionId: r.sessionId,
                  memberId: r.memberId,
                  memberName: r.member.fullName,
                  stateCode: r.member.stateCode,
                  sessionTitle: r.session.title,
                  occurrenceDate: r.session.occurrenceDate,
                  capturedAt: r.capturedAt,
                })
              }
            >
              {r.status === "PRESENT" ? <><Ban /> Void record</> : <><RotateCcw /> Restore record</>}
            </Button>
          )
        }
      />
      {r.lateSync && (
        <div className="mb-4">
          <Consequence tone="info">
            The tap was captured while attendance was open and uploaded after it closed. Devices work offline, so this is expected and the record is valid. It is not an attendance violation.
          </Consequence>
        </div>
      )}
      <div className="grid gap-6 lg:grid-cols-2">
        <Panel title="Official record">
          <DefinitionList
            items={[
              { label: "Member", value: <Link className="hover:underline" href={`/members/${r.member.id}`}>{r.member.fullName} ({r.member.stateCode})</Link> },
              { label: "Session", value: <Link className="hover:underline" href={`/sessions/${r.session.id}`}>{r.session.title}</Link> },
              { label: "Session status", value: <SessionStatusBadge status={r.session.status} /> },
              { label: "CDS group", value: groupName(r.session.groupId) },
              { label: "Recorded tap time", value: formatDateTime(r.capturedAt) },
              { label: "Received by server", value: formatDateTime(r.receivedAt) },
              { label: "Source", value: SOURCE_LABELS[r.source] },
              { label: "Note", value: r.note || "—" },
              ...(r.status === "VOIDED"
                ? [
                    { label: "Voided", value: formatDateTime(r.voidedAt) },
                    { label: "Void reason", value: `${r.voidReason === "SESSION_CANCELLED" ? "Session cancelled" : "Administrative correction"}${r.voidNote ? ` · ${r.voidNote}` : ""}` },
                  ]
                : []),
            ]}
          />
        </Panel>
        <Panel title="Source device tap" description="What the reader uploaded and what it was told. The acknowledgement never changes.">
          {ev ? (
            <DefinitionList
              items={[
                { label: "Outcome", value: <AckBadge status={ev.ackStatus} /> },
                { label: "Card UID", value: <span className="font-mono">{ev.cardUid}</span> },
                { label: "Captured on device", value: formatDateTime(ev.capturedAt) },
                { label: "Uploaded", value: `${formatDateTime(ev.receivedAt)}${delay !== null && delay > 60_000 ? ` (${formatDuration(delay)} later)` : ""}` },
                { label: "Device clock skew", value: ev.clockSkewMs !== null ? formatDuration(ev.clockSkewMs) : "—" },
                { label: "Session re-matched", value: ev.sessionReassigned ? "Yes: matched by capture time" : "No" },
                { label: "Device event ID", value: <span className="font-mono text-xs break-all">{ev.clientEventId}</span> },
                { label: "Device", value: r.deviceId ? <Link className="hover:underline" href={`/devices/${r.deviceId}`}>Open device</Link> : "—" },
              ]}
            />
          ) : (
            <p className="p-4 text-sm text-muted-foreground">{r.source === "MANUAL" ? "Entered manually by an administrator; no device tap." : "No source tap is linked."}</p>
          )}
        </Panel>
      </div>
      <CorrectionDialog target={correction} onClose={() => setCorrection(null)} />
    </>
  );
}
