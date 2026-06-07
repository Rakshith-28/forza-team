import "server-only";

import { cookies } from "next/headers";

/** Cookie holding the child a multi-child parent has focused the portal on. */
export const ACTIVE_CHILD_COOKIE = "active_child";

/** The focused child id from the cookie (validated against the caller's children by the reader). */
export async function readActiveChildId(): Promise<string | null> {
  return (await cookies()).get(ACTIVE_CHILD_COOKIE)?.value ?? null;
}

/**
 * Resolve which linked child the parent portal should focus on: the cookie's
 * choice when it's one of the caller's children, else the first. Purely a
 * presentational selection — a parent always has access to ALL linked children.
 */
export function resolveActiveChild<T extends { id: string }>(children: T[], cookieId: string | null): T {
  return children.find((c) => c.id === cookieId) ?? children[0];
}
