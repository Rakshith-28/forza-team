"use server";

import { revalidatePath } from "next/cache";

import { requireRoleOrThrow } from "@/lib/auth-guards";
import { ForbiddenError } from "@/lib/rbac";
import type { FormState } from "@/modules/clubs/action-state";
import { updateSystemSettingsSchema } from "@/modules/master/schemas";
import {
  getMasterClubDetail,
  getMasterCoachDetail,
  getMasterUserDetail,
  setClubStatus,
  updateSystemSettings,
  type MasterClubDetail,
  type MasterUserDetail,
} from "@/modules/master/service";

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
