import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { REFRESH_COOKIE } from "@/lib/auth/tokens";

/**
 * Coarse gate for page routes: without a refresh-token cookie there is no session to restore, so
 * redirect to the login page before any dashboard code loads. The real authentication and
 * authorization happen on the backend for every API call.
 */
export function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const hasSession = request.cookies.has(REFRESH_COOKIE);

  if (pathname === "/login") return NextResponse.next();

  if (!hasSession) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.search = pathname === "/" ? "" : `?next=${encodeURIComponent(pathname + search)}`;
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:png|svg|ico|jpg|jpeg|webp|txt)$).*)"],
};
