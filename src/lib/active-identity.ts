import "server-only";

import { cookies } from "next/headers";

import { parseIdentityKey } from "@/modules/identity/identities";

/**
 * Cookie holding the identity (role + club + team/child) a multi-identity user
 * is currently acting as — set by the post-login "Select Role" popup and the
 * top-bar identity switcher. It is the single source of truth for the active
 * club, the active role, and (for players) the focused child. httpOnly: the
 * value is only ever read/written server-side and re-validated against the
 * user's real assignments by {@link parseIdentityKey} + the context loader.
 */
export const ACTIVE_IDENTITY_COOKIE = "active_identity";

/** Raw identity key from the cookie, or null. */
export async function readActiveIdentityKey(): Promise<string | null> {
  return (await cookies()).get(ACTIVE_IDENTITY_COOKIE)?.value ?? null;
}

/**
 * Coordinates parsed from the active-identity cookie (cheap, no DB). The context
 * loader uses these to scope the request; an unheld club/role degrades to
 * no-access rather than escalating (see {@link parseIdentityKey}).
 */
export async function readActiveIdentity() {
  return parseIdentityKey(await readActiveIdentityKey());
}
