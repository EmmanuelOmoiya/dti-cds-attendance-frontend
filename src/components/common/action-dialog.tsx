"use client";

import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { InlineError } from "./states";
import { cn } from "@/lib/utils";

/**
 * Modal for consequential actions and small forms. The body is wrapped in a <form>, so Enter
 * submits; the confirm button is disabled while the request is pending, which prevents double
 * submission, and the dialog cannot be dismissed mid-request.
 */
export function ActionDialog({
  open,
  onOpenChange,
  title,
  description,
  children,
  confirmLabel,
  pendingLabel,
  destructive,
  pending,
  error,
  onSubmit,
  confirmDisabled,
  size = "md",
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: React.ReactNode;
  description?: React.ReactNode;
  children?: React.ReactNode;
  confirmLabel: string;
  pendingLabel?: string;
  destructive?: boolean;
  pending?: boolean;
  error?: unknown;
  onSubmit: (e: React.FormEvent<HTMLFormElement>) => void;
  confirmDisabled?: boolean;
  size?: "sm" | "md" | "lg";
}) {
  return (
    <Dialog open={open} onOpenChange={(next) => (!pending ? onOpenChange(next) : undefined)}>
      <DialogContent
        className={cn(size === "sm" ? "sm:max-w-sm" : size === "md" ? "sm:max-w-lg" : "sm:max-w-2xl", "max-h-[90vh] overflow-y-auto")}
        onInteractOutside={(e) => pending && e.preventDefault()}
        onEscapeKeyDown={(e) => pending && e.preventDefault()}
      >
        <form
          noValidate
          onSubmit={(e) => {
            e.preventDefault();
            if (pending) return;
            onSubmit(e);
          }}
          className="grid gap-4"
        >
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
            {description && <DialogDescription asChild><div className="text-sm text-muted-foreground">{description}</div></DialogDescription>}
          </DialogHeader>
          {children}
          {error ? <InlineError error={error} /> : null}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={pending}>
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={pending || confirmDisabled}
              className={cn(destructive && "bg-destructive text-white hover:bg-destructive/90")}
            >
              {pending && <Loader2 className="animate-spin" />}
              {pending ? (pendingLabel ?? "Working…") : confirmLabel}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/** Callout used inside dialogs to explain consequences. */
export function Consequence({ tone = "warning", children }: { tone?: "warning" | "danger" | "info"; children: React.ReactNode }) {
  return (
    <div
      className={cn(
        "rounded-md border px-3 py-2 text-sm",
        tone === "danger" && "border-destructive/25 bg-danger-soft text-destructive",
        tone === "warning" && "border-warning/30 bg-warning-soft text-[oklch(0.4_0.09_60)]",
        tone === "info" && "border-ring/25 bg-info-soft text-[oklch(0.38_0.08_245)]",
      )}
    >
      {children}
    </div>
  );
}
