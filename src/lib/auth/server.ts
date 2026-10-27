import "server-only";

import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import {
  ACCESS_COOKIE,
  REFRESH_COOKIE,
  createRefreshCoordinator,
  isAccessTokenUsable,
  type TokenPair,
} from "./tokens";

export function apiBaseUrl(): string {
  return (process.env.API_BASE_URL ?? "http://localhost:5000/api/v1").replace(/\/+$/, "");
}

function cookieSecure(): boolean {
  if (process.env.COOKIE_SECURE !== undefined) return process.env.COOKIE_SECURE === "true";
  return process.env.NODE_ENV === "production";
}

export class AuthUpstreamError extends Error {
  constructor(
    readonly status: number,
    readonly body: unknown,
  ) {
    super(`Auth upstream responded ${status}`);
  }
}

async function callRefresh(refreshToken: string): Promise<TokenPair> {
  const res = await fetch(`${apiBaseUrl()}/auth/refresh`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ refreshToken }),
    cache: "no-store",
    signal: AbortSignal.timeout(15_000),
  });
  const body = await res.json().catch(() => null);
  if (!res.ok) throw new AuthUpstreamError(res.status, body);
  return (body as { data: TokenPair }).data;
}

const refreshOnce = createRefreshCoordinator(callRefresh);

export function setAuthCookies(res: NextResponse, pair: TokenPair): void {
  const secure = cookieSecure();
  res.cookies.set(ACCESS_COOKIE, pair.accessToken, {
    httpOnly: true,
    secure,
    sameSite: "lax",
    path: "/",
    maxAge: pair.accessTokenExpiresIn,
  });
  res.cookies.set(REFRESH_COOKIE, pair.refreshToken, {
    httpOnly: true,
    secure,
    sameSite: "lax",
    path: "/",
    expires: new Date(pair.refreshTokenExpiresAt),
  });
}

export function clearAuthCookies(res: NextResponse): void {
  for (const name of [ACCESS_COOKIE, REFRESH_COOKIE]) {
    res.cookies.set(name, "", { httpOnly: true, secure: cookieSecure(), sameSite: "lax", path: "/", maxAge: 0 });
  }
}

export function errorJson(status: number, code: string, message: string): NextResponse {
  return NextResponse.json({ error: { code, message } }, { status, headers: { "cache-control": "no-store" } });
}

/**
 * Rejects cross-site state-changing requests. Auth cookies are SameSite=Lax already; requiring a
 * custom header (which a cross-origin page cannot send without a CORS preflight we never answer)
 * and a same-origin Origin header adds defence in depth.
 */
export function assertSameOriginMutation(req: NextRequest): NextResponse | null {
  if (req.method === "GET" || req.method === "HEAD") return null;
  if (req.headers.get("x-dla-client") !== "dashboard") {
    return errorJson(403, "CSRF_REJECTED", "Missing client header");
  }
  const origin = req.headers.get("origin");
  if (origin) {
    const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host");
    try {
      if (new URL(origin).host !== host) return errorJson(403, "CSRF_REJECTED", "Cross-origin request rejected");
    } catch {
      return errorJson(403, "CSRF_REJECTED", "Invalid origin");
    }
  }
  return null;
}

export interface AuthedCallResult {
  upstream: Response | null;
  /** Set when the tokens were rotated during this call; the caller must write them as cookies. */
  rotated: TokenPair | null;
  /** True when the session can no longer be renewed (cookies must be cleared). */
  sessionExpired: boolean;
}

/**
 * Calls the backend with the user's access token, refreshing it (once, shared across concurrent
 * requests) when it is missing, about to expire, or rejected with 401.
 */
export async function callBackendAuthed(
  req: NextRequest,
  send: (accessToken: string) => Promise<Response>,
): Promise<AuthedCallResult> {
  let accessToken = req.cookies.get(ACCESS_COOKIE)?.value;
  const refreshToken = req.cookies.get(REFRESH_COOKIE)?.value;
  let rotated: TokenPair | null = null;

  const tryRefresh = async (): Promise<boolean> => {
    if (!refreshToken) return false;
    try {
      rotated = await refreshOnce(refreshToken);
      accessToken = rotated.accessToken;
      return true;
    } catch (e) {
      if (e instanceof AuthUpstreamError && e.status < 500) return false;
      throw e;
    }
  };

  if (!isAccessTokenUsable(accessToken)) {
    if (!(await tryRefresh())) return { upstream: null, rotated: null, sessionExpired: true };
  }

  let upstream = await readTokenRejection(await send(accessToken!));
  if (upstream.tokenRejected && !rotated) {
    if (await tryRefresh()) {
      upstream = await readTokenRejection(await send(accessToken!));
    } else {
      return { upstream: upstream.response, rotated: null, sessionExpired: true };
    }
  }
  return { upstream: upstream.response, rotated, sessionExpired: upstream.tokenRejected };
}

/**
 * A 401 only means "the session is gone" when the code is UNAUTHENTICATED. Other 401 codes are
 * ordinary answers, e.g. INVALID_CREDENTIALS for a wrong current password on change-password.
 * The body is buffered so it can be inspected and still returned to the browser.
 */
async function readTokenRejection(res: Response): Promise<{ response: Response; tokenRejected: boolean }> {
  if (res.status !== 401) return { response: res, tokenRejected: false };
  const text = await res.text();
  let code: string | undefined;
  try {
    code = (JSON.parse(text) as { error?: { code?: string } }).error?.code;
  } catch {
    code = undefined;
  }
  const response = new Response(text, { status: res.status, statusText: res.statusText, headers: res.headers });
  return { response, tokenRejected: code === undefined || code === "UNAUTHENTICATED" };
}
