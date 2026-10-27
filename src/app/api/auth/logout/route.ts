import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { apiBaseUrl, assertSameOriginMutation, callBackendAuthed, clearAuthCookies } from "@/lib/auth/server";
import { REFRESH_COOKIE } from "@/lib/auth/tokens";

/**
 * Revokes the refresh-token family on the backend (best effort) and always clears the cookies,
 * so signing out works even when the backend is unreachable.
 */
export async function POST(req: NextRequest) {
  const csrf = assertSameOriginMutation(req);
  if (csrf) return csrf;

  const refreshToken = req.cookies.get(REFRESH_COOKIE)?.value;
  if (refreshToken) {
    try {
      await callBackendAuthed(req, (accessToken) =>
        fetch(`${apiBaseUrl()}/auth/logout`, {
          method: "POST",
          headers: { "content-type": "application/json", authorization: `Bearer ${accessToken}` },
          // If the call above rotated the token, the backend revokes the whole family anyway.
          body: JSON.stringify({ refreshToken }),
          cache: "no-store",
          signal: AbortSignal.timeout(10_000),
        }),
      );
    } catch {
      // Backend unavailable: cookies are still cleared below.
    }
  }
  const res = new NextResponse(null, { status: 204 });
  clearAuthCookies(res);
  return res;
}
