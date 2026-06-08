import "server-only";

import { readActiveIdentity } from "@/lib/active-identity";

/**
 * Which linked child the parent portal is focused on. This is no longer a
 * separate cookie: the focused child is carried by the active **identity**
 * (a "Parent · <child>" entry in the top-bar switcher / login popup), so picking
 * a child IS switching identity. Returns null when the active identity isn't a
 * parent identity.
 */
export async function readActiveChildId(): Promise<string | null> {
  const identity = await readActiveIdentity();
  return identity?.role === "PARENT" ? identity.playerId : null;
}

/**
 * Resolve which linked child the parent portal should focus on: the active
 * identity's child when it's one of the caller's children, else the first.
 * Purely a presentational selection — a parent always has access to ALL linked
 * children.
 */
export function resolveActiveChild<T extends { id: string }>(children: T[], cookieId: string | null): T {
  return children.find((c) => c.id === cookieId) ?? children[0];
}
