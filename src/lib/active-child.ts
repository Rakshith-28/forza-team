import "server-only";

import { readActiveIdentity } from "@/lib/active-identity";

/**
 * Which linked child the player portal is focused on. This is no longer a
 * separate cookie: the focused child is carried by the active **identity**
 * (a "Player · <child>" entry in the top-bar switcher / login popup), so picking
 * a child IS switching identity. Returns null when the active identity isn't a
 * player identity.
 */
export async function readActiveChildId(): Promise<string | null> {
  const identity = await readActiveIdentity();
  return identity?.role === "PLAYER" ? identity.playerId : null;
}

/**
 * Resolve which linked child the player portal should focus on: the active
 * identity's child when it's one of the caller's children, else the first.
 * Purely a presentational selection — a player always has access to ALL linked
 * children.
 */
export function resolveActiveChild<T extends { id: string }>(children: T[], cookieId: string | null): T {
  return children.find((c) => c.id === cookieId) ?? children[0];
}
