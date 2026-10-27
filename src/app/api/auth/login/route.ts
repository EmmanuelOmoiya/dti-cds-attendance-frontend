import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { apiBaseUrl, assertSameOriginMutation, errorJson, setAuthCookies } from "@/lib/auth/server";
import type { TokenPair } from "@/lib/auth/tokens";

/** Exchanges email + password for tokens and stores them only in HttpOnly cookies. */
export async function POST(req: NextRequest) {
  const csrf = assertSameOriginMutation(req);
  if (csrf) return csrf;

  let credentials: { email?: unknown; password?: unknown };
  try {
    credentials = await req.json();
  } catch {
    return errorJson(400, "VALIDATION_FAILED", "Malformed request");
  }
  if (typeof credentials.email !== "string" || typeof credentials.password !== "string") {
    return errorJson(400, "VALIDATION_FAILED", "Email and password are required");
  }

  let login: Response;
  try {
    login = await fetch(`${apiBaseUrl()}/auth/login`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: credentials.email, password: credentials.password }),
      cache: "no-store",
      signal: AbortSignal.timeout(15_000),
    });
  } catch {
    return errorJson(502, "BACKEND_UNAVAILABLE", "The attendance service is unreachable.");
  }

  const body = await login.json().catch(() => null);
  if (!login.ok) {
    return NextResponse.json(body ?? { error: { code: "LOGIN_FAILED", message: "Sign-in failed" } }, { status: login.status });
  }
  const pair = (body as { data: TokenPair }).data;

  // Load the profile with the fresh token so the client can render immediately.
  const me = await fetch(`${apiBaseUrl()}/auth/me`, {
    headers: { authorization: `Bearer ${pair.accessToken}` },
    cache: "no-store",
  }).catch(() => null);
  const meBody = me && me.ok ? await me.json() : null;

  const res = NextResponse.json(meBody ?? { data: null }, { status: 200, headers: { "cache-control": "no-store" } });
  setAuthCookies(res, pair);
  return res;
}
