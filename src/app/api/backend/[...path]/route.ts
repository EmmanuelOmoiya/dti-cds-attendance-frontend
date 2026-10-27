import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import {
  apiBaseUrl,
  assertSameOriginMutation,
  callBackendAuthed,
  clearAuthCookies,
  errorJson,
  setAuthCookies,
} from "@/lib/auth/server";
import { isProxyablePath } from "@/lib/auth/tokens";

/**
 * Backend-for-frontend proxy. The browser calls /api/backend/<path>; this handler attaches the
 * user's access token from the HttpOnly cookie, refreshes it when needed, and streams the
 * backend response back unchanged (JSON envelopes, CSV downloads, error bodies).
 */

const FORWARDED_REQUEST_HEADERS = ["content-type", "accept", "if-none-match", "x-request-id"];
const FORWARDED_RESPONSE_HEADERS = ["content-type", "content-disposition", "etag", "x-request-id", "retry-after"];
const UPSTREAM_TIMEOUT_MS = 30_000;

async function handle(req: NextRequest, ctx: { params: Promise<{ path: string[] }> }): Promise<Response> {
  const { path } = await ctx.params;
  const joined = path.map(encodeURIComponent).join("/");
  if (!isProxyablePath(joined)) return errorJson(404, "NOT_FOUND", "Not found");

  const csrf = assertSameOriginMutation(req);
  if (csrf) return csrf;

  const target = `${apiBaseUrl()}/${joined}${req.nextUrl.search}`;
  const body = req.method === "GET" || req.method === "HEAD" ? undefined : await req.arrayBuffer();
  const headers = new Headers();
  for (const name of FORWARDED_REQUEST_HEADERS) {
    const v = req.headers.get(name);
    if (v) headers.set(name, v);
  }

  const send = (accessToken: string) => {
    const h = new Headers(headers);
    h.set("authorization", `Bearer ${accessToken}`);
    return fetch(target, {
      method: req.method,
      headers: h,
      body: body && body.byteLength > 0 ? body : undefined,
      cache: "no-store",
      redirect: "manual",
      signal: AbortSignal.any([req.signal, AbortSignal.timeout(UPSTREAM_TIMEOUT_MS)]),
    });
  };

  let result;
  try {
    result = await callBackendAuthed(req, send);
  } catch (e) {
    if (req.signal.aborted) return new Response(null, { status: 499 });
    const timedOut = e instanceof DOMException && e.name === "TimeoutError";
    return errorJson(
      timedOut ? 504 : 502,
      "BACKEND_UNAVAILABLE",
      timedOut ? "The attendance service did not respond in time." : "The attendance service is unreachable.",
    );
  }

  if (result.sessionExpired) {
    const res = errorJson(401, "SESSION_EXPIRED", "Your session has expired. Please sign in again.");
    clearAuthCookies(res);
    return res;
  }

  const upstream = result.upstream!;
  const outHeaders = new Headers({ "cache-control": "no-store" });
  for (const name of FORWARDED_RESPONSE_HEADERS) {
    const v = upstream.headers.get(name);
    if (v) outHeaders.set(name, v);
  }
  const nullBody = upstream.status === 204 || upstream.status === 304 || req.method === "HEAD";
  const res = new NextResponse(nullBody ? null : upstream.body, { status: upstream.status, headers: outHeaders });
  if (result.rotated) setAuthCookies(res, result.rotated);
  return res;
}

export const GET = handle;
export const POST = handle;
export const PUT = handle;
export const PATCH = handle;
export const DELETE = handle;
