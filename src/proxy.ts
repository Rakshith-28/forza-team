import { getSessionCookie } from "better-auth/cookies";
import { NextResponse, type NextRequest } from "next/server";

/**
 * Layer 1 of the defense-in-depth model (BUILD_PLAN §2): an optimistic session
 * gate. It only checks for a session cookie's presence (no DB call, per Better
 * Auth's guidance) and redirects anonymous users away from app routes. The
 * authoritative checks happen later — route guards (Layer 2) and service-layer
 * scope assertions (Layer 3).
 *
 * Next 16 renamed the `middleware` convention to `proxy`.
 */
export default function proxy(request: NextRequest) {
  const sessionCookie = getSessionCookie(request);
  if (!sessionCookie) {
    const signInUrl = new URL("/sign-in", request.url);
    return NextResponse.redirect(signInUrl);
  }
  return NextResponse.next();
}

// Only guard the authenticated app surface. Public auth pages, /api/auth,
// the health check, and static assets are untouched.
export const config = {
  matcher: ["/dashboard/:path*"],
};
