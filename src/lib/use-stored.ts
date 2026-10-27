"use client";

import { useCallback, useEffect, useState, useSyncExternalStore } from "react";

/**
 * A per-browser convenience value in localStorage (sidebar state, chosen group). Reads are
 * hydration-safe (server snapshot is null) and every access tolerates unavailable storage.
 */
const EVENT = "dla-storage";
/** Fallback when localStorage is unavailable, so the value still works for this page session. */
const memory = new Map<string, string | null>();

function read(key: string): string | null {
  if (memory.has(key)) return memory.get(key) ?? null;
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function subscribe(callback: () => void) {
  window.addEventListener("storage", callback);
  window.addEventListener(EVENT, callback);
  return () => {
    window.removeEventListener("storage", callback);
    window.removeEventListener(EVENT, callback);
  };
}

export function useStoredString(key: string | null): [string | null, (value: string | null) => void] {
  const value = useSyncExternalStore(
    subscribe,
    () => (key ? read(key) : null),
    () => null,
  );
  const set = useCallback(
    (next: string | null) => {
      if (!key) return;
      memory.set(key, next);
      try {
        if (next === null) window.localStorage.removeItem(key);
        else window.localStorage.setItem(key, next);
      } catch {
        // Storage unavailable (private mode / blocked): the value is simply not remembered.
      }
      window.dispatchEvent(new Event(EVENT));
    },
    [key],
  );
  return [value, set];
}

/** Current time that re-renders on an interval, so components never call Date.now() in render. */
export function useNow(intervalMs = 60_000): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(t);
  }, [intervalMs]);
  return now;
}
