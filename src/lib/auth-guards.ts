import "server-only";

import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { auth } from "@/lib/auth";
import { ForbiddenError, type AuthContext } from "@/lib/rbac/scope";
import { ROLE_HOME, type Role } from "@/lib/rbac/roles";
import { loadAuthContext, resolveActiveClubId } from "@/modules/identity/context";

/**
 * Layer 2 of the defense-in-depth model (BUILD_PLAN §2): route/action guards.
 * Layer 1 is the middleware session gate; Layer 3 is the authoritative
 * service-layer scope assertions in src/lib/rbac/scope.ts.
 */

export async function getSession() {
  return auth.api.getSession({ headers: await headers() });
}

/** Require an authenticated user; redirect anonymous callers to sign-in. */
export async function requireUser() {
  const session = await getSession();
  if (!session) redirect("/sign-in");
  return session;
}

/** Require an authenticated user WITH a resolved authorization context. */
export async function requireAuthContext(): Promise<AuthContext> {
  const session = await requireUser();
  const activeClubId =
    session.session.activeClubId ?? (await resolveActiveClubId(session.user.id));
  const ctx = await loadAuthContext(session.user.id, activeClubId);
  if (!ctx) redirect("/no-access");
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

/** For server actions / route handlers: returns 403-style error instead of redirect. */
export async function requireRoleOrThrow(...roles: Role[]): Promise<AuthContext> {
  const ctx = await requireAuthContext();
  if (!roles.includes(ctx.role)) {
    throw new ForbiddenError(`Requires one of: ${roles.join(", ")}`);
  }
  return ctx;
}
