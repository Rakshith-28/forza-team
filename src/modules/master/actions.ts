"use server";

import { revalidatePath } from "next/cache";

import { requireRoleOrThrow } from "@/lib/auth-guards";
import { getMasterClubDetail, setClubStatus, type MasterClubDetail } from "@/modules/master/service";

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

/** Suspend or re-activate a club (audited). Called from the Clubs page row menu. */
export async function toggleClubStatusAction(clubId: string, status: "ACTIVE" | "SUSPENDED"): Promise<void> {
  const ctx = await requireRoleOrThrow("MASTER_ADMIN");
  await setClubStatus(ctx, clubId, status);
  revalidatePath("/clubs");
  revalidatePath("/dashboard/admin");
}
