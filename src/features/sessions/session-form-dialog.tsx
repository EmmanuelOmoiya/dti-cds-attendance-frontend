"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Input } from "@/components/ui/input";
import { ActionDialog, Consequence } from "@/components/common/action-dialog";
import { Field, FormGrid, NativeSelect } from "@/components/common/form";
import { sessionsApi } from "@/lib/api/endpoints";
import type { Session } from "@/lib/api/types";
import { COMMON_TIMEZONES, isoToLocalInput, localInputToIso, todayInZone, zoneAbbreviation } from "@/lib/datetime";
import { useGroups } from "@/lib/group-context";
import { useApiMutation } from "@/lib/use-api-mutation";

const schema = z
  .object({
    groupId: z.string().min(1, "Choose a group"),
    title: z.string().trim().min(2, "At least 2 characters").max(120),
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Choose a date"),
    start: z.string().regex(/^\d{2}:\d{2}$/, "Choose a start time"),
    end: z.string().regex(/^\d{2}:\d{2}$/, "Choose an end time"),
    timezone: z.string().min(1),
  })
  .refine((v) => v.end > v.start, { path: ["end"], message: "End must be after start" });
type Values = z.infer<typeof schema>;

/** Create an ad-hoc session, or reschedule/rename a single SCHEDULED occurrence. */
export function SessionFormDialog({
  open,
  onOpenChange,
  session,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  session?: Session;
  onSaved?: (s: Session) => void;
}) {
  const { groups, activeGroupId, groupName } = useGroups();
  const activeGroups = groups.filter((g) => g.status === "ACTIVE");
  const form = useForm<Values>({ resolver: zodResolver(schema) });

  useEffect(() => {
    if (!open) return;
    if (session) {
      const start = isoToLocalInput(session.plannedStart, session.timezone);
      const end = isoToLocalInput(session.plannedEnd, session.timezone);
      form.reset({ groupId: session.groupId, title: session.title, date: start.slice(0, 10), start: start.slice(11), end: end.slice(11), timezone: session.timezone });
    } else {
      form.reset({
        groupId: activeGroupId ?? (activeGroups.length === 1 ? activeGroups[0].id : ""),
        title: "Special CDS meeting",
        date: todayInZone("Africa/Lagos"),
        start: "10:00",
        end: "12:00",
        timezone: "Africa/Lagos",
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, session]);

  const mutation = useApiMutation({
    mutationFn: (v: Values) => {
      const plannedStart = localInputToIso(`${v.date}T${v.start}`, v.timezone)!;
      const plannedEnd = localInputToIso(`${v.date}T${v.end}`, v.timezone)!;
      if (session) {
        const ms = (iso: string) => new Date(iso).getTime();
        const timesChanged = ms(plannedStart) !== ms(session.plannedStart) || ms(plannedEnd) !== ms(session.plannedEnd);
        return sessionsApi.update(session.id, {
          title: v.title !== session.title ? v.title : undefined,
          ...(timesChanged ? { plannedStart, plannedEnd } : {}),
        });
      }
      return sessionsApi.create({ groupId: v.groupId, title: v.title, plannedStart, plannedEnd, timezone: v.timezone });
    },
    invalidate: [["sessions"], ["schedules"], ["reports"]],
    success: session ? "Session updated" : "Ad-hoc session created",
    onSuccess: (s) => {
      onOpenChange(false);
      onSaved?.(s);
    },
  });

  const e = form.formState.errors;
  const tz = form.watch("timezone") ?? "Africa/Lagos";

  return (
    <ActionDialog
      open={open}
      onOpenChange={(o) => {
        if (!o) mutation.reset();
        onOpenChange(o);
      }}
      title={session ? "Edit or reschedule session" : "New ad-hoc session"}
      description={
        session
          ? "Only scheduled sessions without any attendance can be moved. The original date is recorded in the audit log."
          : "For a meeting outside the recurring schedule. It still needs to be opened or confirmed held to count."
      }
      confirmLabel={session ? "Save changes" : "Create session"}
      pending={mutation.isPending}
      error={mutation.error}
      onSubmit={form.handleSubmit((v) => mutation.mutate(v))}
      size="lg"
    >
      <FormGrid>
        {session ? (
          <Field label="CDS group" className="sm:col-span-2">
            <Input value={groupName(session.groupId)} disabled readOnly />
          </Field>
        ) : (
          <Field label="CDS group" error={e.groupId?.message} required className="sm:col-span-2">
            <NativeSelect {...form.register("groupId")}>
              <option value="">Choose a group…</option>
              {activeGroups.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name}
                </option>
              ))}
            </NativeSelect>
          </Field>
        )}
        <Field label="Title" error={e.title?.message} required className="sm:col-span-2">
          <Input {...form.register("title")} />
        </Field>
        <Field label="Date" error={e.date?.message} required>
          <Input type="date" {...form.register("date")} />
        </Field>
        <Field label="Timezone" required>
          <NativeSelect {...form.register("timezone")} disabled={!!session}>
            {(session && !COMMON_TIMEZONES.includes(session.timezone) ? [session.timezone, ...COMMON_TIMEZONES] : COMMON_TIMEZONES).map((z) => (
              <option key={z} value={z}>
                {z}
              </option>
            ))}
          </NativeSelect>
        </Field>
        <Field label={`Start (${zoneAbbreviation(tz)})`} error={e.start?.message} required>
          <Input type="time" {...form.register("start")} />
        </Field>
        <Field label={`End (${zoneAbbreviation(tz)})`} error={e.end?.message} required>
          <Input type="time" {...form.register("end")} />
        </Field>
      </FormGrid>
      {!session && <Consequence tone="info">Sessions of one group cannot overlap. The server rejects a time that clashes with another session.</Consequence>}
    </ActionDialog>
  );
}
