import "server-only";

import { cache } from "react";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { auth } from "@/lib/auth";
import { readActiveIdentity, readActiveIdentityKey } from "@/lib/active-identity";
import { ForbiddenError, type AuthContext } from "@/lib/rbac/scope";
import { ROLE_HOME, type Role } from "@/lib/rbac/roles";
import { loadAuthContext, resolveActiveClubId } from "@/modules/identity/context";
import {
  listUserIdentities,
  resolveIdentity,
  type Identity,
} from "@/modules/identity/identities";

/**
 * Resolve the active club + role for a request from the active-identity cookie
 * (set by the login popup / top-bar switcher). The parsed club/role are only
 * hints — `loadAuthContext` re-validates them against the user's real
 * assignments, so a stale or forged cookie degrades to no-access, never
 * escalates. Falls back to the user's default club when no identity is chosen.
 */
async function resolveActiveScope(userId: string): Promise<{ activeClubId: string | null; preferredRole: Role | null }> {
  const identity = await readActiveIdentity();
  if (identity?.role === "MASTER_ADMIN") {
    return { activeClubId: null, preferredRole: "MASTER_ADMIN" };
  }
  const activeClubId = identity?.clubId ?? (await resolveActiveClubId(userId));
  return { activeClubId, preferredRole: identity?.role ?? null };
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
  const { activeClubId, preferredRole } = await resolveActiveScope(session.user.id);
  const ctx = await loadAuthContext(session.user.id, activeClubId, preferredRole);
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
  const { activeClubId, preferredRole } = await resolveActiveScope(session.user.id);
  return loadAuthContext(session.user.id, activeClubId, preferredRole);
}

/**
 * The identity switcher's data for the authenticated shell: every identity the
 * caller can act as plus the one currently active. `cache()`-deduped per request.
 */
export const loadIdentitySwitcher = cache(
  async (userId: string): Promise<{ identities: Identity[]; current: Identity | null }> => {
    const identities = await listUserIdentities(userId);
    const current = resolveIdentity(identities, await readActiveIdentityKey());
    return { identities, current };
  },
);

/** For server actions / route handlers: returns 403-style error instead of redirect. */
export async function requireRoleOrThrow(...roles: Role[]): Promise<AuthContext> {
  const ctx = await requireAuthContext();
  if (!roles.includes(ctx.role)) {
    throw new ForbiddenError(`Requires one of: ${roles.join(", ")}`);
  }
  return ctx;
}
