"use server";

import { revalidatePath } from "next/cache";

import { requireRoleOrThrow } from "@/lib/auth-guards";
import { ForbiddenError } from "@/lib/rbac";
import type { FormState } from "@/modules/clubs/action-state";
import { clubAdminInviteSchema, updateSystemSettingsSchema } from "@/modules/master/schemas";
import {
  ConflictError,
  getClubAdmins,
  getMasterClubDetail,
  getMasterCoachDetail,
  getMasterUserDetail,
  inviteClubAdmin,
  resendClubAdminInvite,
  revokeClubAdminInvite,
  setClubStatus,
  updateSystemSettings,
  type ClubAdminRow,
  type MasterClubDetail,
  type MasterUserDetail,
} from "@/modules/master/service";

/** Result of an admin invite/resend — carries the accept URL for manual sharing. */
export interface ClubAdminActionResult {
  ok: boolean;
  error: string | null;
  acceptUrl?: string;
  emailDelivered?: boolean;
  email?: string;
}

function friendlyError(e: unknown): string {
  if (e instanceof ConflictError) return e.message;
  if (e instanceof ForbiddenError) return "You don't have access to do that.";
  throw e; // unexpected — let the error boundary handle it
}

/**
 * Server actions for the Master Admin portal. Reads (detail loaders) are exposed
 * as actions so client drawers can lazy-load on open with proper loading/error
 * states; every action re-authorizes via requireRoleOrThrow("MASTER_ADMIN").
 */

/** Lazy-load full club detail when a row/card opens its drawer. */
export async function loadClubDetailAction(clubId: string): Promise<MasterClubDetail | null> {
  const ctx = await requireRoleOrThrow("MASTER_ADMIN");
  return getMasterClubDetail(ctx, clubId);
}

/** Lazy-load a coach's player/evaluation counts when their drawer opens. */
export async function loadCoachDetailAction(userId: string): Promise<{ playersOnTeams: number; evaluationsAuthored: number }> {
  const ctx = await requireRoleOrThrow("MASTER_ADMIN");
  return getMasterCoachDetail(ctx, userId);
}

/** Lazy-load full user detail when their row opens its drawer. */
export async function loadUserDetailAction(userId: string): Promise<MasterUserDetail | null> {
  const ctx = await requireRoleOrThrow("MASTER_ADMIN");
  return getMasterUserDetail(ctx, userId);
}

/** Suspend or re-activate a club (audited). Called from the Clubs page row menu. */
export async function toggleClubStatusAction(clubId: string, status: "ACTIVE" | "SUSPENDED"): Promise<void> {
  const ctx = await requireRoleOrThrow("MASTER_ADMIN");
  await setClubStatus(ctx, clubId, status);
  revalidatePath("/clubs");
  revalidatePath("/dashboard/admin");
}

// --- Club admins (orphan-club remediation) ---------------------------------

/** Load a club's admins (active + pending) for the detail drawer. */
export async function loadClubAdminsAction(clubId: string): Promise<ClubAdminRow[]> {
  const ctx = await requireRoleOrThrow("MASTER_ADMIN");
  return getClubAdmins(ctx, clubId);
}

/** Invite an initial/additional CLUB_ADMIN from club detail. */
export async function inviteClubAdminAction(
  clubId: string,
  input: { email: string; firstName?: string; lastName?: string },
): Promise<ClubAdminActionResult> {
  const ctx = await requireRoleOrThrow("MASTER_ADMIN");
  const parsed = clubAdminInviteSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  try {
    const res = await inviteClubAdmin(ctx, clubId, parsed.data);
    revalidatePath("/clubs");
    revalidatePath("/dashboard/admin");
    return { ok: true, error: null, acceptUrl: res.acceptUrl, emailDelivered: res.emailDelivered, email: parsed.data.email };
  } catch (e) {
    return { ok: false, error: friendlyError(e) };
  }
}

/** Resend a pending CLUB_ADMIN invite (rotates its link). */
export async function resendClubAdminInviteAction(invitationId: string): Promise<ClubAdminActionResult> {
  const ctx = await requireRoleOrThrow("MASTER_ADMIN");
  try {
    const res = await resendClubAdminInvite(ctx, invitationId);
    return { ok: true, error: null, acceptUrl: res.acceptUrl, emailDelivered: res.emailDelivered };
  } catch (e) {
    return { ok: false, error: friendlyError(e) };
  }
}

/** Revoke a pending CLUB_ADMIN invite (its link stops working). */
export async function revokeClubAdminInviteAction(invitationId: string): Promise<ClubAdminActionResult> {
  const ctx = await requireRoleOrThrow("MASTER_ADMIN");
  try {
    await revokeClubAdminInvite(ctx, invitationId);
    revalidatePath("/clubs");
    revalidatePath("/dashboard/admin");
    return { ok: true, error: null };
  } catch (e) {
    return { ok: false, error: friendlyError(e) };
  }
}

/** Save global system settings (audited). */
export async function updateSystemSettingsAction(_prev: FormState, fd: FormData): Promise<FormState> {
  const ctx = await requireRoleOrThrow("MASTER_ADMIN");
  const parsed = updateSystemSettingsSchema.safeParse({
    aiFeaturesEnabled: fd.get("aiFeaturesEnabled") != null,
    maintenanceMode: fd.get("maintenanceMode") != null,
    defaultCurrency: fd.get("defaultCurrency"),
    defaultRegistrationEnabled: fd.get("defaultRegistrationEnabled") != null,
    defaultBillingEnabled: fd.get("defaultBillingEnabled") != null,
    defaultSmsNotifications: fd.get("defaultSmsNotifications") != null,
  });
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  try {
    await updateSystemSettings(ctx, parsed.data);
  } catch (e) {
    if (e instanceof ForbiddenError) return { ok: false, error: "You don't have access to do that." };
    throw e;
  }
  revalidatePath("/system-settings");
  return { ok: true, error: null };
}
