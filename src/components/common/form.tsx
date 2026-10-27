import { forwardRef, useId } from "react";
import { cloneElement, isValidElement } from "react";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

/**
 * Label + control + help/error text, wired for accessibility: the control receives id,
 * aria-invalid and aria-describedby automatically.
 */
export function Field({
  label,
  htmlFor,
  error,
  description,
  required,
  children,
  className,
}: {
  label: React.ReactNode;
  htmlFor?: string;
  error?: string;
  description?: React.ReactNode;
  required?: boolean;
  children: React.ReactElement<Record<string, unknown>>;
  className?: string;
}) {
  const generated = useId();
  const id = htmlFor ?? generated;
  const descId = `${id}-desc`;
  const errId = `${id}-err`;
  const describedBy = [description ? descId : null, error ? errId : null].filter(Boolean).join(" ") || undefined;
  const control = isValidElement(children)
    ? cloneElement(children, {
        id,
        "aria-invalid": error ? true : undefined,
        "aria-describedby": describedBy,
        "aria-required": required || undefined,
      })
    : children;
  return (
    <div className={cn("grid gap-1.5", className)}>
      <Label htmlFor={id} className="text-sm font-medium">
        {label}
        {required && <span className="text-destructive" aria-hidden> *</span>}
      </Label>
      {control}
      {description && !error && (
        <p id={descId} className="text-xs text-muted-foreground">
          {description}
        </p>
      )}
      {error && (
        <p id={errId} className="text-xs font-medium text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}

const controlClass =
  "h-8 w-full min-w-0 rounded-lg border border-input bg-background px-2.5 text-sm shadow-xs outline-none transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/40 disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-destructive/20";

/** Styled native <select>: accessible, keyboard- and mobile-friendly, and works with RHF register(). */
export const NativeSelect = forwardRef<HTMLSelectElement, React.ComponentProps<"select">>(function NativeSelect(
  { className, children, ...props },
  ref,
) {
  return (
    <select ref={ref} className={cn(controlClass, "pr-8", className)} {...props}>
      {children}
    </select>
  );
});

export function FormGrid({ children, columns = 2, className }: { children: React.ReactNode; columns?: 1 | 2; className?: string }) {
  return <div className={cn("grid gap-4", columns === 2 && "sm:grid-cols-2", className)}>{children}</div>;
}
