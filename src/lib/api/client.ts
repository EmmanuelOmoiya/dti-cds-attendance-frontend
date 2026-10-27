import { ApiError } from "./errors";
import type { PageMeta, Paged } from "./types";

/** All browser requests go through the same-origin proxy; the backend URL is server-only. */
export const API_PREFIX = "/api/backend";

export type QueryValue = string | number | boolean | null | undefined;
export type Query = Record<string, QueryValue>;

export function buildQuery(query?: Query): string {
  if (!query) return "";
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value === undefined || value === null || value === "") continue;
    params.set(key, String(value));
  }
  const s = params.toString();
  return s ? `?${s}` : "";
}

type SessionExpiredListener = () => void;
const sessionExpiredListeners = new Set<SessionExpiredListener>();

/** The auth provider subscribes so any expired-session response sends the user to the login page. */
export function onSessionExpired(listener: SessionExpiredListener): () => void {
  sessionExpiredListeners.add(listener);
  return () => sessionExpiredListeners.delete(listener);
}

interface RequestOptions {
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  query?: Query;
  body?: unknown;
  signal?: AbortSignal;
}

async function rawRequest(path: string, opts: RequestOptions = {}): Promise<Response> {
  const method = opts.method ?? "GET";
  const headers: Record<string, string> = { accept: "application/json" };
  if (method !== "GET") headers["x-dla-client"] = "dashboard";
  if (opts.body !== undefined) headers["content-type"] = "application/json";

  let res: Response;
  try {
    res = await fetch(`${API_PREFIX}${path}${buildQuery(opts.query)}`, {
      method,
      headers,
      body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
      signal: opts.signal,
      credentials: "same-origin",
      cache: "no-store",
    });
  } catch (e) {
    if (e instanceof DOMException && e.name === "AbortError") throw e;
    throw new ApiError(0, "BACKEND_UNAVAILABLE", "Network error");
  }
  if (!res.ok) throw await toApiError(res);
  return res;
}

export async function toApiError(res: Response): Promise<ApiError> {
  const body = (await res.json().catch(() => null)) as {
    error?: { code?: string; message?: string; details?: unknown; requestId?: string };
  } | null;
  const err = body?.error;
  const apiError = new ApiError(
    res.status,
    err?.code ?? `HTTP_${res.status}`,
    err?.message ?? res.statusText ?? "Request failed",
    err?.details,
    err?.requestId ?? res.headers.get("x-request-id") ?? undefined,
  );
  if (res.status === 401 && (apiError.code === "SESSION_EXPIRED" || apiError.code === "UNAUTHENTICATED")) {
    sessionExpiredListeners.forEach((l) => l());
  }
  return apiError;
}

/** Single-resource call: unwraps `{ data }`. Resolves to `undefined` for 204 responses. */
export async function apiRequest<T>(path: string, opts?: RequestOptions): Promise<T> {
  const res = await rawRequest(path, opts);
  if (res.status === 204) return undefined as T;
  const body = (await res.json()) as { data: T };
  return body.data;
}

/** List call: keeps `{ data, meta }`. */
export async function apiList<T>(path: string, opts?: RequestOptions): Promise<Paged<T>> {
  const res = await rawRequest(path, opts);
  const body = (await res.json()) as { data: T[]; meta: PageMeta };
  return { data: body.data, meta: body.meta };
}

/**
 * Fetches every page of a list (bounded). Used only for small reference lists such as groups,
 * where a lookup table is needed and the total is known to be modest.
 */
export async function apiListAll<T>(path: string, query: Query = {}, signal?: AbortSignal, maxPages = 20): Promise<{ data: T[]; total: number; truncated: boolean }> {
  const out: T[] = [];
  let page = 1;
  let total = 0;
  let totalPages = 1;
  do {
    const r = await apiList<T>(path, { query: { ...query, page, pageSize: 100 }, signal });
    out.push(...r.data);
    total = r.meta.total;
    totalPages = r.meta.totalPages;
    page += 1;
  } while (page <= totalPages && page <= maxPages);
  return { data: out, total, truncated: out.length < total };
}

export function filenameFromDisposition(header: string | null, fallback: string): string {
  if (!header) return fallback;
  const star = /filename\*=UTF-8''([^;]+)/i.exec(header);
  if (star) return decodeURIComponent(star[1]);
  const plain = /filename="?([^";]+)"?/i.exec(header);
  return plain ? plain[1] : fallback;
}

/** Downloads a file produced by the backend (e.g. a CSV report) and saves it in the browser. */
export async function apiDownload(path: string, query: Query, fallbackName: string): Promise<string> {
  const res = await rawRequest(path, { query });
  const blob = await res.blob();
  const name = filenameFromDisposition(res.headers.get("content-disposition"), fallbackName);
  const url = URL.createObjectURL(blob);
  try {
    const a = document.createElement("a");
    a.href = url;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();
  } finally {
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  return name;
}
