"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { ACTIVE_IDENTITY_COOKIE } from "@/lib/active-identity";
import { requireUser } from "@/lib/auth-guards";
import { env } from "@/lib/env";
import { ROLE_HOME } from "@/lib/rbac/roles";
import { listUserIdentities } from "@/modules/identity/identities";

/**
 * Switch the caller to one of the identities they hold (a "Coach · <team>",
 * "Parent · <child>", etc. entry from the login popup / top-bar switcher).
 *
 * Authoritative guard: the chosen key must be present in the user's freshly
 * derived identity list. This can never escalate privileges — it only changes
 * which held identity is active. The choice is stored in an httpOnly cookie that
 * the context loader reads + re-validates on every request.
 */
export async function setActiveIdentityAction(formData: FormData): Promise<void> {
  const key = String(formData.get("identity") ?? "");
  const session = await requireUser();

  const identities = await listUserIdentities(session.user.id);
  const chosen = identities.find((i) => i.key === key);
  if (!chosen) return; // not an identity this user holds — ignore

  (await cookies()).set(ACTIVE_IDENTITY_COOKIE, key, {
    httpOnly: true,
    sameSite: "lax",
    secure: env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });

  // Land on the chosen role's home so the whole shell follows the new identity.
  redirect(ROLE_HOME[chosen.role]);
}

/**
 * Forget the active identity. Called on sign-out so the next login re-shows the
 * "Select Role" popup for multi-identity users (per product: every login).
 */
export async function clearActiveIdentityAction(): Promise<void> {
  (await cookies()).delete(ACTIVE_IDENTITY_COOKIE);
}
