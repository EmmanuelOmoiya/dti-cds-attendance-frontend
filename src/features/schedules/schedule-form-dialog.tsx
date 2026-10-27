"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { ActionDialog, Consequence } from "@/components/common/action-dialog";
import { Field, FormGrid, NativeSelect } from "@/components/common/form";
import { schedulesApi } from "@/lib/api/endpoints";
import { fieldErrors } from "@/lib/api/errors";
import type { Schedule } from "@/lib/api/types";
import { COMMON_TIMEZONES, todayInZone, WEEKDAYS } from "@/lib/datetime";
import { useGroups } from "@/lib/group-context";
import { useApiMutation } from "@/lib/use-api-mutation";

const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;
const DATE = /^\d{4}-\d{2}-\d{2}$/;

export const scheduleSchema = z
  .object({
    groupId: z.string().min(1, "Choose a group"),
    title: z.string().trim().min(2, "At least 2 characters").max(120),
    dayOfWeek: z.coerce.number().int().min(1).max(7),
    startLocalTime: z.string().regex(TIME, "Use HH:mm"),
    endLocalTime: z.string().regex(TIME, "Use HH:mm"),
    timezone: z.string().min(1),
    effectiveFrom: z.string().regex(DATE, "Choose a date"),
    effectiveUntil: z.union([z.literal(""), z.string().regex(DATE)]),
    backfillPast: z.boolean(),
  })
  .refine((v) => v.endLocalTime > v.startLocalTime, {
    path: ["endLocalTime"],
    message: "End must be after start (meetings cannot cross midnight)",
  })
  .refine((v) => !v.effectiveUntil || v.effectiveUntil >= v.effectiveFrom, {
    path: ["effectiveUntil"],
    message: "Must not be before the start date",
  });

type Values = z.input<typeof scheduleSchema>;
type Output = z.output<typeof scheduleSchema>;

export function ScheduleFormDialog({
  open,
  onOpenChange,
  defaults,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaults?: Partial<Schedule> & { groupId?: string };
  onCreated?: (s: Schedule) => void;
}) {
  const { groups, activeGroupId } = useGroups();
  const activeGroups = groups.filter((g) => g.status === "ACTIVE");
  const form = useForm<Values, unknown, Output>({ resolver: zodResolver(scheduleSchema) });

  useEffect(() => {
    if (!open) return;
    form.reset({
      groupId: defaults?.groupId ?? activeGroupId ?? (activeGroups.length === 1 ? activeGroups[0].id : ""),
      title: defaults?.title ?? "Weekly CDS meeting",
      dayOfWeek: defaults?.dayOfWeek ?? 5,
      startLocalTime: defaults?.startLocalTime ?? "10:00",
      endLocalTime: defaults?.endLocalTime ?? "13:00",
      timezone: defaults?.timezone ?? "Africa/Lagos",
      effectiveFrom: defaults?.effectiveFrom ?? todayInZone(defaults?.timezone ?? "Africa/Lagos"),
      effectiveUntil: "",
      backfillPast: false,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const mutation = useApiMutation({
    mutationFn: (v: Output) =>
      schedulesApi.create({
        groupId: v.groupId,
        title: v.title,
        dayOfWeek: v.dayOfWeek,
        startLocalTime: v.startLocalTime,
        endLocalTime: v.endLocalTime,
        timezone: v.timezone,
        effectiveFrom: v.effectiveFrom,
        effectiveUntil: v.effectiveUntil || undefined,
        backfillPast: v.backfillPast || undefined,
      }),
    invalidate: [["schedules"], ["sessions"], ["groups"]],
    success: (r) => `Schedule created · ${r.generation.created} expected session${r.generation.created === 1 ? "" : "s"} generated`,
    onSuccess: (r) => {
      onOpenChange(false);
      onCreated?.(r);
    },
  });

  useEffect(() => {
    const fe = fieldErrors(mutation.error);
    for (const [field, message] of Object.entries(fe)) form.setError(field as keyof Values, { message });
  }, [mutation.error, form]);

  const e = form.formState.errors;
  const backfill = form.watch("backfillPast");
  const tz = form.watch("timezone");

  return (
    <ActionDialog
      open={open}
      onOpenChange={(o) => {
        if (!o) mutation.reset();
        onOpenChange(o);
      }}
      title="New recurring schedule"
      description="Expected sessions are generated about six weeks ahead. An expected session is not a confirmed meeting: an administrator still opens it, confirms it was held, or cancels it."
      confirmLabel="Create schedule"
      pending={mutation.isPending}
      error={Object.keys(fieldErrors(mutation.error)).length ? null : mutation.error}
      onSubmit={form.handleSubmit((v) => mutation.mutate(v))}
      size="lg"
    >
      <FormGrid>
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
        <Field label="Title" error={e.title?.message} required className="sm:col-span-2">
          <Input {...form.register("title")} />
        </Field>
        <Field label="Day of week" error={e.dayOfWeek?.message} required>
          <NativeSelect {...form.register("dayOfWeek")}>
            {WEEKDAYS.map((d, i) => (
              <option key={d} value={i + 1}>
                {d}
              </option>
            ))}
          </NativeSelect>
        </Field>
        <Field label="Timezone" error={e.timezone?.message} required description="Meeting times are local to this zone.">
          <NativeSelect {...form.register("timezone")}>
            {COMMON_TIMEZONES.map((z) => (
              <option key={z} value={z}>
                {z}
              </option>
            ))}
          </NativeSelect>
        </Field>
        <Field label="Start time" error={e.startLocalTime?.message} required description={`Local time in ${tz}`}>
          <Input type="time" step={60} {...form.register("startLocalTime")} />
        </Field>
        <Field label="End time" error={e.endLocalTime?.message} required>
          <Input type="time" step={60} {...form.register("endLocalTime")} />
        </Field>
        <Field label="Effective from" error={e.effectiveFrom?.message} required>
          <Input type="date" {...form.register("effectiveFrom")} />
        </Field>
        <Field label="Effective until" error={e.effectiveUntil?.message} description="Optional, inclusive. Leave empty for open-ended.">
          <Input type="date" {...form.register("effectiveUntil")} />
        </Field>
      </FormGrid>
      <label className="flex items-start gap-2 text-sm">
        <Checkbox checked={!!backfill} onCheckedChange={(c) => form.setValue("backfillPast", c === true)} className="mt-0.5" />
        <span>
          Also create past occurrences since the start date
          <span className="block text-xs text-muted-foreground">Back-filled sessions start as Unresolved and must each be confirmed held or cancelled.</span>
        </span>
      </label>
      {backfill && (
        <Consequence>Back-filling never claims a past meeting happened. Each past session must be resolved by an administrator.</Consequence>
      )}
    </ActionDialog>
  );
}
