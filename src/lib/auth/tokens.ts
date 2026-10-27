/**
 * Pure helpers shared by the server-side auth code (no Next.js imports, so they are unit-testable).
 */

export const ACCESS_COOKIE = "dla_at";
export const REFRESH_COOKIE = "dla_rt";

/** Refresh slightly before the access token actually expires, to absorb clock drift and latency. */
export const ACCESS_TOKEN_REFRESH_LEEWAY_MS = 30_000;

export interface TokenPair {
  accessToken: string;
  accessTokenExpiresIn: number;
  refreshToken: string;
  refreshTokenExpiresAt: string;
  tokenType: "Bearer";
}

/**
 * Reads the `exp` claim of a JWT without verifying it. Only used to decide *when* to refresh;
 * the backend verifies every token on every request.
 */
export function jwtExpiresAtMs(token: string): number | null {
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  try {
    const json = Buffer.from(parts[1].replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf8");
    const payload = JSON.parse(json) as { exp?: unknown };
    return typeof payload.exp === "number" ? payload.exp * 1000 : null;
  } catch {
    return null;
  }
}

export function isAccessTokenUsable(token: string | undefined, now = Date.now()): token is string {
  if (!token) return false;
  const exp = jwtExpiresAtMs(token);
  return exp !== null && exp - ACCESS_TOKEN_REFRESH_LEEWAY_MS > now;
}

/**
 * Refresh tokens are single-use with reuse detection on the backend: presenting an already-rotated
 * token revokes the whole session. When the browser fires several requests at once with the same
 * expired access token, they must therefore share ONE refresh call. This keeps the in-flight
 * promise (and its result for a short grace period) keyed by the refresh token being rotated.
 *
 * The map is per server process; see docs/FRONTEND.md for the multi-instance caveat.
 */
export function createRefreshCoordinator(
  doRefresh: (refreshToken: string) => Promise<TokenPair>,
  graceMs = 60_000,
) {
  const inflight = new Map<string, { promise: Promise<TokenPair>; settledAt?: number }>();

  function sweep(now: number) {
    for (const [key, entry] of inflight) {
      if (entry.settledAt !== undefined && now - entry.settledAt > graceMs) inflight.delete(key);
    }
  }

  return function refresh(refreshToken: string): Promise<TokenPair> {
    const now = Date.now();
    sweep(now);
    const existing = inflight.get(refreshToken);
    if (existing) return existing.promise;

    const entry: { promise: Promise<TokenPair>; settledAt?: number } = {
      promise: doRefresh(refreshToken),
    };
    entry.promise.then(
      () => {
        entry.settledAt = Date.now();
      },
      () => {
        // Do not cache failures beyond the in-flight window: a later call should get a fresh answer.
        inflight.delete(refreshToken);
      },
    );
    inflight.set(refreshToken, entry);
    return entry.promise;
  };
}

/** Paths under the backend API that the browser may reach through the proxy. */
export function isProxyablePath(path: string): boolean {
  const p = `/${path.replace(/^\/+/, "")}`;
  if (p.includes("..")) return false;
  // Device sync API: device credentials only, never from a browser session.
  if (p === "/sync" || p.startsWith("/sync/")) return false;
  // Token lifecycle is handled by the dedicated /api/auth/* route handlers.
  if (p === "/auth/login" || p === "/auth/refresh" || p === "/auth/logout") return false;
  return true;
}
