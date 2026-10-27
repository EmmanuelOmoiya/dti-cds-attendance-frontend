"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useMemo } from "react";

/**
 * Filter/pagination state stored in the URL query string, so views are shareable, survive reload
 * and work with the back button. Values are strings; empty values are removed from the URL.
 */
export function useUrlState<K extends string>(defaults: Record<K, string>) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const values = useMemo(() => {
    const out = {} as Record<K, string>;
    for (const key of Object.keys(defaults) as K[]) {
      out[key] = searchParams.get(key) ?? defaults[key];
    }
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps -- defaults are static per call site
  }, [searchParams]);

  const setValues = useCallback(
    (patch: Partial<Record<K, string | number | null | undefined>>, opts: { resetPage?: boolean } = { resetPage: true }) => {
      const params = new URLSearchParams(searchParams.toString());
      for (const [key, raw] of Object.entries(patch) as [string, string | number | null | undefined][]) {
        const value = raw === null || raw === undefined ? "" : String(raw);
        const def = (defaults as Record<string, string>)[key] ?? "";
        if (value === "" || value === def) params.delete(key);
        else params.set(key, value);
      }
      if (opts.resetPage && !("page" in patch)) params.delete("page");
      const s = params.toString();
      router.replace(s ? `${pathname}?${s}` : pathname, { scroll: false });
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [router, pathname, searchParams],
  );

  return [values, setValues] as const;
}

export function toInt(value: string, fallback: number): number {
  const n = Number.parseInt(value, 10);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}
