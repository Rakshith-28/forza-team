"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { ACTIVE_ROLE_COOKIE, requireUserAndContext } from "@/lib/auth-guards";
import { env } from "@/lib/env";
import { isRole, ROLE_HOME } from "@/lib/rbac/roles";
import { getUserClubRoles } from "@/modules/identity/context";

/**
 * Switch the caller's active role to another role they ALREADY hold in their
 * active club (e.g. a coach who is also a parent). Authoritative guard: the
 * requested role must be in the user's granted roles for the club — this can
 * never escalate privileges, only change which held role is active. The choice
 * is stored in an httpOnly cookie that `loadAuthContext` reads + re-validates.
 */
export async function setActiveRoleAction(formData: FormData): Promise<void> {
  const requested = String(formData.get("role") ?? "");
  if (!isRole(requested)) return;

  const { ctx } = await requireUserAndContext();
  if (!ctx.activeClubId) return;

  const held = await getUserClubRoles(ctx.userId, ctx.activeClubId);
  if (!held.includes(requested)) return; // not a role this user holds — ignore

  (await cookies()).set(ACTIVE_ROLE_COOKIE, requested, {
    httpOnly: true,
    sameSite: "lax",
    secure: env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });

  redirect(ROLE_HOME[requested]);
}
