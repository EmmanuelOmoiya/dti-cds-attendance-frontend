"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { CalendarPlus, CalendarX2, Pencil, RefreshCw, Repeat } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { ActionDialog, Consequence } from "@/components/common/action-dialog";
import { Field } from "@/components/common/form";
import { DefinitionList, PageHeader, Panel } from "@/components/common/page-header";
import { ActiveBadge } from "@/components/common/status-badge";
import { BlockSkeleton, EmptyState, ErrorState } from "@/components/common/states";
import { SessionsTable } from "@/features/sessions/sessions-table";
import { schedulesApi } from "@/lib/api/endpoints";
import type { ScheduleEndResult } from "@/lib/api/types";
import { useCan } from "@/lib/auth/auth-context";
import { addDays, formatDate, formatDateTime, formatTime, todayInZone } from "@/lib/datetime";
import { useGroups } from "@/lib/group-context";
import { Permission } from "@/lib/permissions";
import { useApiMutation } from "@/lib/use-api-mutation";
import { ScheduleFormDialog } from "./schedule-form-dialog";
import { effectivePeriod, scheduleSummary } from "./schedules-table";

const INVALIDATE = [["schedules"], ["sessions"], ["groups"]];

function EndResultSummary({ result }: { result: ScheduleEndResult }) {
  return (
    <div className="space-y-1 text-sm">
      <p>{result.cancelledSessionIds.length} future expected session(s) without attendance were cancelled (reason: schedule changed).</p>
      {result.sessionsKeptWithAttendance.length > 0 && (
        <p className="text-[oklch(0.45_0.11_60)]">
          {result.sessionsKeptWithAttendance.length} session(s) already have attendance data and were kept unchanged:{" "}
          {result.sessionsKeptWithAttendance.map((s) => formatDate(s.occurrenceDate, { weekday: false })).join(", ")}. Review them individually.
        </p>
      )}
    </div>
  );
}

export function ScheduleDetailPage({ id }: { id: string }) {
  const router = useRouter();
  const canWrite = useCan(Permission.SCHEDULES_WRITE);
  const { groupName } = useGroups();
  const [dialog, setDialog] = useState<null | "rename" | "end" | "deactivate" | "generate" | "replace">(null);
  const [title, setTitle] = useState("");
  const [endDate, setEndDate] = useState("");
  const [backfill, setBackfill] = useState(false);
  const [lastEnd, setLastEnd] = useState<ScheduleEndResult | null>(null);

  const schedule = useQuery({ queryKey: ["schedules", "detail", id], queryFn: ({ signal }) => schedulesApi.get(id, signal) });
  const s = schedule.data;
  const today = s ? todayInZone(s.timezone) : todayInZone();
  const previewRange = { from: today, to: addDays(today, 84) };
  const preview = useQuery({
    queryKey: ["schedules", "preview", id, previewRange],
    queryFn: ({ signal }) => schedulesApi.preview(id, previewRange.from, previewRange.to, signal),
    enabled: !!s && s.status === "ACTIVE",
  });


  const close = () => setDialog(null);
  const rename = useApiMutation({ mutationFn: () => schedulesApi.rename(id, title.trim()), invalidate: INVALIDATE, success: "Schedule renamed", onSuccess: close });
  const end = useApiMutation({
    mutationFn: () => schedulesApi.end(id, endDate),
    invalidate: INVALIDATE,
    success: "Schedule end date set",
    onSuccess: (r) => {
      setLastEnd(r);
      close();
    },
  });
  const deactivate = useApiMutation({
    mutationFn: () => schedulesApi.deactivate(id),
    invalidate: INVALIDATE,
    success: "Schedule deactivated",
    onSuccess: (r) => {
      setLastEnd(r);
      close();
    },
  });
  const generate = useApiMutation({
    mutationFn: () => schedulesApi.generate(id, backfill),
    invalidate: INVALIDATE,
    onSuccess: (r) => {
      toast.success(r.created ? `${r.created} new expected session(s) created` : "All expected sessions already exist");
      close();
    },
  });

  if (schedule.error) return <ErrorState error={schedule.error} onRetry={() => schedule.refetch()} />;
  if (!s) return <BlockSkeleton className="h-64" />;

  const active = s.status === "ACTIVE";

  return (
    <>
      <PageHeader
        breadcrumbs={[{ label: "Schedules", href: "/schedules" }, { label: s.title }]}
        title={s.title}
        description={scheduleSummary(s)}
        meta={<ActiveBadge active={active} />}
        actions={
          canWrite && (
            <>
              <Button variant="outline" onClick={() => { setTitle(s.title); setDialog("rename"); }}>
                <Pencil /> Rename
              </Button>
              {active && (
                <>
                  <Button variant="outline" onClick={() => setDialog("generate")}>
                    <RefreshCw /> Generate now
                  </Button>
                  <Button variant="outline" onClick={() => { setEndDate(today); setDialog("end"); }}>
                    <CalendarX2 /> End schedule
                  </Button>
                </>
              )}
              <Button variant="outline" onClick={() => setDialog("replace")}>
                <Repeat /> New version
              </Button>
              {active && (
                <Button variant="destructive" onClick={() => setDialog("deactivate")}>
                  Deactivate
                </Button>
              )}
            </>
          )
        }
      />

      {lastEnd && (
        <div className="mb-4">
          <Consequence tone="info">
            <EndResultSummary result={lastEnd} />
          </Consequence>
        </div>
      )}

      <div className="grid gap-6 xl:grid-cols-3">
        <Panel title="Rule" className="xl:col-span-1">
          <DefinitionList
            columns={1}
            items={[
              { label: "CDS group", value: <Link className="hover:underline" href={`/groups/${s.groupId}`}>{groupName(s.groupId)}</Link> },
              { label: "Meets", value: scheduleSummary(s) },
              { label: "Timezone", value: s.timezone },
              { label: "Effective", value: effectivePeriod(s) },
              { label: "Created", value: formatDateTime(s.createdAt) },
            ]}
          />
          <p className="border-t px-4 py-3 text-xs text-muted-foreground">
            Timing is immutable. Use <strong>New version</strong> to change the day or time: end this schedule, then create the replacement. Past sessions are never modified.
          </p>
        </Panel>
        <Panel title="Next sessions" description="Up to 10 upcoming sessions generated from this schedule." className="xl:col-span-2">
          <SessionsTable
            rows={s.upcomingSessions}
            showGroup={false}
            empty={<EmptyState icon={CalendarPlus} title="No upcoming sessions" description={active ? "Use Generate now if you expected sessions here." : "This schedule is no longer active."} />}
          />
        </Panel>
        {active && (
          <Panel title="Projected occurrences (next 12 weeks)" description="Dry run of the rule. Nothing is saved; sessions outside the six-week horizon are created later by the maintenance job." className="xl:col-span-3">
            {preview.error ? (
              <ErrorState error={preview.error} onRetry={() => preview.refetch()} />
            ) : !preview.data ? (
              <BlockSkeleton className="m-4 h-16 w-auto" />
            ) : preview.data.length === 0 ? (
              <EmptyState title="No occurrences in this period" />
            ) : (
              <ul className="grid gap-px bg-border sm:grid-cols-2 lg:grid-cols-4">
                {preview.data.map((o) => (
                  <li key={o.occurrenceDate} className="bg-card px-4 py-2.5 text-sm">
                    <span className="font-medium">{formatDate(o.occurrenceDate)}</span>
                    <span className="block text-xs text-muted-foreground tabular-nums">
                      {formatTime(o.plannedStart, s.timezone)} – {formatTime(o.plannedEnd, s.timezone)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        )}
      </div>

      <ActionDialog
        open={dialog === "rename"}
        onOpenChange={(o) => !o && (close(), rename.reset())}
        title="Rename schedule"
        confirmLabel="Save"
        pending={rename.isPending}
        error={rename.error}
        confirmDisabled={title.trim().length < 2}
        onSubmit={() => rename.mutate()}
      >
        <Field label="Title" required description="Only the title can be changed. Existing sessions keep their own titles.">
          <Input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={120} />
        </Field>
      </ActionDialog>

      <ActionDialog
        open={dialog === "end"}
        onOpenChange={(o) => !o && (close(), end.reset())}
        title="End this schedule"
        confirmLabel="Set end date"
        pending={end.isPending}
        error={end.error}
        confirmDisabled={!endDate}
        onSubmit={() => end.mutate()}
      >
        <Field label="Last meeting date (inclusive)" required>
          <Input type="date" value={endDate} min={s.effectiveFrom} onChange={(e) => setEndDate(e.target.value)} />
        </Field>
        <Consequence>
          Expected sessions after this date that are still scheduled and have no attendance will be cancelled with reason “Schedule changed”. Sessions with attendance data are kept and listed for you to review.
        </Consequence>
      </ActionDialog>

      <ActionDialog
        open={dialog === "deactivate"}
        onOpenChange={(o) => !o && (close(), deactivate.reset())}
        title="Deactivate schedule?"
        confirmLabel="Deactivate"
        destructive
        pending={deactivate.isPending}
        error={deactivate.error}
        onSubmit={() => deactivate.mutate()}
      >
        <Consequence tone="danger">
          No further sessions will be generated. Future expected sessions without attendance will be cancelled. Past sessions and any session with data are not modified. This cannot be undone; create a new schedule to resume.
        </Consequence>
      </ActionDialog>

      <ActionDialog
        open={dialog === "generate"}
        onOpenChange={(o) => !o && (close(), generate.reset())}
        title="Generate expected sessions now"
        description="The maintenance job does this automatically every 15 minutes. Generation is idempotent: existing sessions are never duplicated."
        confirmLabel="Generate"
        pending={generate.isPending}
        error={generate.error}
        onSubmit={() => generate.mutate()}
      >
        <label className="flex items-start gap-2 text-sm">
          <Checkbox checked={backfill} onCheckedChange={(c) => setBackfill(c === true)} className="mt-0.5" />
          <span>
            Also back-fill past occurrences since {formatDate(s.effectiveFrom, { weekday: false })}
            <span className="block text-xs text-muted-foreground">Back-filled sessions start as Unresolved and each needs an administrator decision.</span>
          </span>
        </label>
      </ActionDialog>

      <ScheduleFormDialog
        open={dialog === "replace"}
        onOpenChange={(o) => !o && close()}
        defaults={{
          groupId: s.groupId,
          title: s.title,
          dayOfWeek: s.dayOfWeek,
          startLocalTime: s.startLocalTime,
          endLocalTime: s.endLocalTime,
          timezone: s.timezone,
          effectiveFrom: s.effectiveUntil ? addDays(s.effectiveUntil, 1) : today,
        }}
        onCreated={(n) => router.push(`/schedules/${n.id}`)}
      />
    </>
  );
}
