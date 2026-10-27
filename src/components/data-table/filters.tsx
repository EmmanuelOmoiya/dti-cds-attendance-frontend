"use client";

import { Search, X } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/common/form";
import { useGroups } from "@/lib/group-context";
import { cn } from "@/lib/utils";

export function FilterBar({ children, onReset, canReset }: { children: React.ReactNode; onReset?: () => void; canReset?: boolean }) {
  return (
    <div className="flex flex-col gap-2 border-b px-4 py-3 sm:flex-row sm:flex-wrap sm:items-end">
      {children}
      {onReset && canReset && (
        <Button variant="ghost" size="sm" onClick={onReset} className="self-start sm:self-auto">
          <X /> Clear filters
        </Button>
      )}
    </div>
  );
}

function FilterLabel({ label, children, className }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <label className={cn("grid gap-1 text-xs font-medium text-muted-foreground", className)}>
      <span>{label}</span>
      {children}
    </label>
  );
}

/** Search box that only updates the filter after the user pauses typing. */
export function SearchFilter({
  value,
  onChange,
  placeholder = "Search",
  label = "Search",
  className,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  label?: string;
  className?: string;
}) {
  const [draft, setDraft] = useState(value);
  // Follow external changes (e.g. "Clear filters") without an effect.
  const [synced, setSynced] = useState(value);
  if (value !== synced) {
    setSynced(value);
    setDraft(value);
  }
  useEffect(() => {
    if (draft === value) return;
    const t = setTimeout(() => onChange(draft.trim()), 350);
    return () => clearTimeout(t);
  }, [draft, value, onChange]);
  return (
    <FilterLabel label={label} className={cn("sm:w-64", className)}>
      <div className="relative">
        <Search className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
        <Input
          type="search"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && onChange(draft.trim())}
          placeholder={placeholder}
          className="pl-8"
        />
      </div>
    </FilterLabel>
  );
}

export function SelectFilter<V extends string>({
  label,
  value,
  onChange,
  options,
  allLabel = "All",
  className,
}: {
  label: string;
  value: V | "";
  onChange: (value: V | "") => void;
  options: { value: V; label: string }[];
  allLabel?: string;
  className?: string;
}) {
  return (
    <FilterLabel label={label} className={cn("sm:w-44", className)}>
      <NativeSelect value={value} onChange={(e) => onChange(e.target.value as V | "")}>
        <option value="">{allLabel}</option>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </NativeSelect>
    </FilterLabel>
  );
}

/** CDS group filter limited to the groups the user can access (the backend enforces the same scope). */
export function GroupFilter({
  value,
  onChange,
  allLabel = "All my groups",
  className,
}: {
  value: string;
  onChange: (value: string) => void;
  allLabel?: string;
  className?: string;
}) {
  const { groups } = useGroups();
  if (groups.length <= 1) return null;
  return (
    <FilterLabel label="CDS group" className={cn("sm:w-56", className)}>
      <NativeSelect value={value} onChange={(e) => onChange(e.target.value)}>
        <option value="">{allLabel}</option>
        {groups.map((g) => (
          <option key={g.id} value={g.id}>
            {g.name}
            {g.status === "INACTIVE" ? " (inactive)" : ""}
          </option>
        ))}
      </NativeSelect>
    </FilterLabel>
  );
}

/** Inclusive local calendar-date range (YYYY-MM-DD), matching the API's `from`/`to` semantics. */
export function DateRangeFilter({
  from,
  to,
  onChange,
  label = "Date range",
}: {
  from: string;
  to: string;
  onChange: (range: { from: string; to: string }) => void;
  label?: string;
}) {
  const invalid = !!from && !!to && to < from;
  return (
    <fieldset className="grid gap-1">
      <legend className="mb-1 text-xs font-medium text-muted-foreground">{label}</legend>
      <div className="flex items-center gap-1.5">
        <Input type="date" aria-label="From date" value={from} max={to || undefined} onChange={(e) => onChange({ from: e.target.value, to })} className="w-[9.5rem]" />
        <span className="text-xs text-muted-foreground">to</span>
        <Input
          type="date"
          aria-label="To date"
          value={to}
          min={from || undefined}
          aria-invalid={invalid || undefined}
          onChange={(e) => onChange({ from, to: e.target.value })}
          className="w-[9.5rem]"
        />
      </div>
      {invalid && <span className="text-xs text-destructive">End date is before start date</span>}
    </fieldset>
  );
}
