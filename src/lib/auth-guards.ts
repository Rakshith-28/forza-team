import "server-only";

import { cache } from "react";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";

import { auth } from "@/lib/auth";
import { ForbiddenError, type AuthContext } from "@/lib/rbac/scope";
import { isRole, ROLE_HOME, type Role } from "@/lib/rbac/roles";
import { loadAuthContext, resolveActiveClubId } from "@/modules/identity/context";

/** Name of the cookie that records the role a multi-role user chose to act as. */
export const ACTIVE_ROLE_COOKIE = "active_role";

/**
 * The role a user explicitly switched to (account role switcher), or null.
 * `loadAuthContext` only honours it when the user actually holds that role in
 * their active club — a stale/forged value safely falls back to the default.
 */
async function readPreferredRole(): Promise<Role | null> {
  const value = (await cookies()).get(ACTIVE_ROLE_COOKIE)?.value;
  return isRole(value) ? value : null;
}

/**
 * Layer 2 of the defense-in-depth model (BUILD_PLAN §2): route/action guards.
 * Layer 1 is the middleware session gate; Layer 3 is the authoritative
 * service-layer scope assertions in src/lib/rbac/scope.ts.
 */

/**
 * Per-request memoized: the authenticated shell layout and the page's own
 * `requireRole` both resolve the session in a single render. `cache()` dedupes
 * that to ONE Better Auth lookup per request — it never caches across requests.
 */
export const getSession = cache(async () => {
  return auth.api.getSession({ headers: await headers() });
});

/** Require an authenticated user; redirect anonymous callers to sign-in. */
export async function requireUser() {
  const session = await getSession();
  if (!session) redirect("/sign-in");
  return session;
}

type SessionResult = NonNullable<Awaited<ReturnType<typeof getSession>>>;

/** Require an authenticated user AND their resolved authorization context. */
export async function requireUserAndContext(): Promise<{ session: SessionResult; ctx: AuthContext }> {
  const session = await requireUser();
  const activeClubId =
    session.session.activeClubId ?? (await resolveActiveClubId(session.user.id));
  const ctx = await loadAuthContext(session.user.id, activeClubId, await readPreferredRole());
  if (!ctx) redirect("/no-access");
  return { session, ctx };
}

/** Require an authenticated user WITH a resolved authorization context. */
export async function requireAuthContext(): Promise<AuthContext> {
  const { ctx } = await requireUserAndContext();
  return ctx;
}

/**
 * Require one of `roles`. On mismatch, send the user to their own role's home
 * rather than leaking the existence of the page.
 */
export async function requireRole(...roles: Role[]): Promise<AuthContext> {
  const ctx = await requireAuthContext();
  if (!roles.includes(ctx.role)) redirect(ROLE_HOME[ctx.role]);
  return ctx;
}

/**
 * Resolve the caller's AuthContext for a route handler WITHOUT redirecting —
 * returns null when there's no session or no usable context, so the handler can
 * answer with a proper HTTP status (used by /api JSON + file proxy endpoints).
 */
export async function getApiContext(): Promise<AuthContext | null> {
  const session = await getSession();
  if (!session) return null;
  const activeClubId =
    session.session.activeClubId ?? (await resolveActiveClubId(session.user.id));
  return loadAuthContext(session.user.id, activeClubId, await readPreferredRole());
}

/** For server actions / route handlers: returns 403-style error instead of redirect. */
export async function requireRoleOrThrow(...roles: Role[]): Promise<AuthContext> {
  const ctx = await requireAuthContext();
  if (!roles.includes(ctx.role)) {
    throw new ForbiddenError(`Requires one of: ${roles.join(", ")}`);
  }
  return ctx;
}
