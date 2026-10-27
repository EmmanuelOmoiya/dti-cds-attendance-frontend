/** Error thrown for any non-2xx API response (or a network failure), carrying the backend's code. */
export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly details?: unknown,
    readonly requestId?: string,
  ) {
    super(message);
    this.name = "ApiError";
  }

  get isNetwork(): boolean {
    return this.status === 0 || this.code === "BACKEND_UNAVAILABLE";
  }
}

export function isApiError(e: unknown): e is ApiError {
  return e instanceof ApiError;
}

/** Field-level validation issues from a 400 VALIDATION_FAILED response. */
export function fieldErrors(e: unknown): Record<string, string> {
  if (!isApiError(e) || e.code !== "VALIDATION_FAILED" || !Array.isArray(e.details)) return {};
  const out: Record<string, string> = {};
  for (const item of e.details as { field?: unknown; issues?: unknown }[]) {
    if (typeof item?.field === "string" && Array.isArray(item.issues) && item.issues.length) {
      out[item.field] = String(item.issues[0]);
    }
  }
  return out;
}

/**
 * Friendlier wording for codes where the backend message is technical. Anything not listed falls
 * back to the backend's own message, which is already written for administrators.
 */
const FRIENDLY: Record<string, string> = {
  BACKEND_UNAVAILABLE: "The attendance service is unreachable. Check your connection and try again.",
  SESSION_EXPIRED: "Your session has expired. Please sign in again.",
  FORBIDDEN: "You do not have permission to perform this action.",
  RATE_LIMITED: "Too many requests. Wait a moment and try again.",
  INTERNAL_ERROR: "The server hit an unexpected error. Try again, and contact support if it persists.",
  CONFLICT: "This record was changed by someone else. Reload and try again.",
  INVALID_CREDENTIALS: "Incorrect email or password.",
};

export function errorMessage(e: unknown, fallback = "Something went wrong."): string {
  if (isApiError(e)) {
    const base = FRIENDLY[e.code] ?? (e.message || fallback);
    return base;
  }
  if (e instanceof Error && e.message) return e.message;
  return fallback;
}
