"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ActionDialog } from "@/components/common/action-dialog";
import { Field } from "@/components/common/form";
import { groupsApi } from "@/lib/api/endpoints";
import type { Group } from "@/lib/api/types";
import { useApiMutation } from "@/lib/use-api-mutation";

const schema = z.object({
  name: z.string().trim().min(2, "At least 2 characters").max(120),
  description: z.string().trim().max(1000).optional(),
});
type Values = z.infer<typeof schema>;

export function GroupFormDialog({
  open,
  onOpenChange,
  group,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  group?: Group;
  onSaved?: (g: Group) => void;
}) {
  const form = useForm<Values>({ resolver: zodResolver(schema), defaultValues: { name: "", description: "" } });
  useEffect(() => {
    if (open) form.reset({ name: group?.name ?? "", description: group?.description ?? "" });
  }, [open, group, form]);

  const mutation = useApiMutation({
    mutationFn: (v: Values) =>
      group ? groupsApi.update(group.id, { name: v.name, description: v.description ?? "" }) : groupsApi.create({ name: v.name, description: v.description || undefined }),
    invalidate: [["groups"]],
    success: group ? "Group updated" : "Group created",
    onSuccess: (g) => {
      onOpenChange(false);
      onSaved?.(g);
    },
  });

  return (
    <ActionDialog
      open={open}
      onOpenChange={(o) => {
        if (!o) mutation.reset();
        onOpenChange(o);
      }}
      title={group ? "Edit CDS group" : "New CDS group"}
      description={group ? undefined : "Group names must be unique (case-insensitive)."}
      confirmLabel={group ? "Save changes" : "Create group"}
      pending={mutation.isPending}
      error={mutation.error}
      onSubmit={form.handleSubmit((v) => mutation.mutate(v))}
    >
      <Field label="Name" error={form.formState.errors.name?.message} required>
        <Input {...form.register("name")} placeholder="e.g. CDS Ikeja" />
      </Field>
      <Field label="Description" error={form.formState.errors.description?.message}>
        <Textarea rows={3} {...form.register("description")} />
      </Field>
    </ActionDialog>
  );
}
