"use server";

import { revalidatePath } from "next/cache";

import { requireRoleOrThrow } from "@/lib/auth-guards";
import {
  getMasterClubDetail,
  getMasterCoachDetail,
  getMasterUserDetail,
  setClubStatus,
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
