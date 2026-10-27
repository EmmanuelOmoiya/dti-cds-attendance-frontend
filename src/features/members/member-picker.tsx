"use client";

import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Check, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { membersApi } from "@/lib/api/endpoints";
import type { Member } from "@/lib/api/types";
import { cn } from "@/lib/utils";

/** Searches members (name or state code) within the user's scope and lets one be chosen. */
export function MemberPicker({
  value,
  onChange,
  groupId,
  activeOnly = true,
  placeholder = "Search by name or state code",
}: {
  value: Member | null;
  onChange: (m: Member | null) => void;
  groupId?: string;
  activeOnly?: boolean;
  placeholder?: string;
}) {
  const [text, setText] = useState("");
  const [q, setQ] = useState("");
  useEffect(() => {
    const t = setTimeout(() => setQ(text.trim()), 300);
    return () => clearTimeout(t);
  }, [text]);

  const params = { q: q || undefined, groupId, status: activeOnly ? "ACTIVE" : undefined, pageSize: 8, sort: "fullName:asc" };
  const results = useQuery({
    queryKey: ["members", "picker", params],
    queryFn: ({ signal }) => membersApi.list(params, signal),
    enabled: q.length >= 2,
  });

  if (value) {
    return (
      <div className="flex items-center justify-between gap-2 rounded-lg border bg-muted/30 px-3 py-2 text-sm">
        <span className="min-w-0">
          <span className="font-medium">{value.fullName}</span> <span className="font-mono text-xs text-muted-foreground">{value.stateCode}</span>
          {value.currentGroup && <span className="block text-xs text-muted-foreground">{value.currentGroup.name}</span>}
        </span>
        <button type="button" className="text-xs text-muted-foreground underline hover:text-foreground" onClick={() => onChange(null)}>
          Change
        </button>
      </div>
    );
  }

  return (
    <div className="grid gap-1.5">
      <div className="relative">
        <Search className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
        <Input value={text} onChange={(e) => setText(e.target.value)} placeholder={placeholder} className="pl-8" role="combobox" aria-expanded={!!results.data} aria-autocomplete="list" />
      </div>
      {q.length >= 2 && (
        <ul role="listbox" className="max-h-56 overflow-y-auto rounded-lg border bg-popover text-sm">
          {results.isPending ? (
            <li className="px-3 py-2 text-muted-foreground">Searching…</li>
          ) : results.error ? (
            <li className="px-3 py-2 text-destructive">Search failed</li>
          ) : results.data!.data.length === 0 ? (
            <li className="px-3 py-2 text-muted-foreground">No matching members</li>
          ) : (
            results.data!.data.map((m) => (
              <li key={m.id} role="option" aria-selected={false}>
                <button
                  type="button"
                  onClick={() => onChange(m)}
                  className={cn("flex w-full items-center justify-between gap-2 px-3 py-2 text-left hover:bg-muted focus-visible:bg-muted")}
                >
                  <span className="min-w-0">
                    <span className="font-medium">{m.fullName}</span> <span className="font-mono text-xs text-muted-foreground">{m.stateCode}</span>
                    <span className="block text-xs text-muted-foreground">
                      {m.currentGroup?.name ?? "No current group"}
                      {m.activeCard ? " · has a card" : ""}
                    </span>
                  </span>
                  <Check className="size-4 opacity-0" />
                </button>
              </li>
            ))
          )}
        </ul>
      )}
      {q.length < 2 && <p className="text-xs text-muted-foreground">Type at least 2 characters.</p>}
    </div>
  );
}
