import { NextResponse, type NextRequest } from "next/server";

const PUBLIC = ["/login", "/signup"];

/**
 * Optimistic auth check: redirect to /login when no session cookie exists.
 * Real verification happens in every page and server action (requireUser).
 */
export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const hasSession = request.cookies.has("mayfar_session");
  if (!hasSession && !PUBLIC.some((p) => pathname.startsWith(p))) {
    const url = new URL("/login", request.url);
    if (pathname !== "/") url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }
  const res = NextResponse.next();
  res.headers.set("X-Frame-Options", "DENY");
  res.headers.set("X-Content-Type-Options", "nosniff");
  res.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  return res;
}

export const config = {
  // Skip static assets and endpoints that authenticate themselves. Uploads must
  // bypass the proxy: it buffers request bodies only up to 10 MB.
  matcher: ["/((?!_next/static|_next/image|favicon.ico|icon.svg|api/cron|api/upload|api/files).*)"],
};
