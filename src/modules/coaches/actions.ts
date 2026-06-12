"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requireUserAndContext } from "@/lib/auth-guards";
import { ForbiddenError } from "@/lib/rbac";
import type { FormState } from "@/modules/coaches/action-state";
import { ConflictError, deleteCoach, inviteCoach, resendCoachInvitation } from "@/modules/coaches/service";
import { inviteCoachSchema } from "@/modules/coaches/schemas";
// Assign / remove reuse the Phase 2 clubs service (already scoped + audited).
import { assignCoach, ConflictError as ClubsConflictError, removeCoach } from "@/modules/clubs/service";
import { assignCoachSchema } from "@/modules/clubs/schemas";

function failZod(error: z.ZodError): FormState {
  return { ok: false, error: error.issues[0]?.message ?? "Invalid input" };
}
function failService(error: unknown): FormState {
  if (error instanceof ForbiddenError) return { ok: false, error: "You don't have access to do that." };
  if (error instanceof ConflictError || error instanceof ClubsConflictError) return { ok: false, error: error.message };
  throw error;
}
function str(fd: FormData, key: string): string {
  const v = fd.get(key);
  return typeof v === "string" ? v : "";
}
function optStr(fd: FormData, key: string): string | undefined {
  const v = str(fd, key).trim();
  return v.length > 0 ? v : undefined;
}

export async function inviteCoachAction(_prev: FormState, fd: FormData): Promise<FormState> {
  const { ctx } = await requireUserAndContext();
  if (!ctx.activeClubId) return { ok: false, error: "No active club." };
  const parsed = inviteCoachSchema.safeParse({
    email: str(fd, "email"),
    teamId: optStr(fd, "teamId") ?? null,
    roleType: optStr(fd, "roleType"),
  });
  if (!parsed.success) return failZod(parsed.error);
  let emailDelivered = true;
  let acceptUrl: string;
  try {
    const result = await inviteCoach(ctx, ctx.activeClubId, parsed.data);
    emailDelivered = result.emailDelivered;
    acceptUrl = result.acceptUrl;
  } catch (e) {
    return failService(e);
  }
  revalidatePath("/coaches");
  return {
    ok: true,
    error: null,
    acceptUrl,
    notice: emailDelivered
      ? null
      : "Invitation created, but the email couldn't be sent. Share the invite link below.",
  };
}

export async function assignCoachAction(_prev: FormState, fd: FormData): Promise<FormState> {
  const { ctx } = await requireUserAndContext();
  const parsed = assignCoachSchema.safeParse({
    teamId: str(fd, "teamId"),
    userId: str(fd, "userId"),
    roleType: str(fd, "roleType"),
  });
  if (!parsed.success) return failZod(parsed.error);
  try {
    await assignCoach(ctx, parsed.data);
  } catch (e) {
    return failService(e);
  }
  revalidatePath("/coaches");
  return { ok: true, error: null };
}

export async function removeCoachAssignmentAction(fd: FormData): Promise<void> {
  const { ctx } = await requireUserAndContext();
  await removeCoach(ctx, str(fd, "teamId"), str(fd, "userId"));
  revalidatePath("/coaches");
}

/** HARD, permanent coach deletion for the active club (CLUB_ADMIN only). Typed-name gate is the UI control. */
export async function deleteCoachAction(fd: FormData): Promise<void> {
  const { ctx } = await requireUserAndContext();
  await deleteCoach(ctx, str(fd, "coachUserId"));
  revalidatePath("/coaches");
}

/** Regenerate + return the accept link for a pending coach invite (rotates the token). */
export async function copyCoachInviteLinkAction(
  invitationId: string,
): Promise<{ ok: boolean; error: string | null; acceptUrl?: string }> {
  const { ctx } = await requireUserAndContext();
  try {
    const res = await resendCoachInvitation(ctx, invitationId);
    if (!res) return { ok: false, error: "Invitation not found." };
    return { ok: true, error: null, acceptUrl: res.acceptUrl };
  } catch (e) {
    return { ok: false, error: failService(e).error };
  }
}
