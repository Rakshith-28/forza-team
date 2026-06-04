"use server";

import { revalidatePath } from "next/cache";

import { requireRoleOrThrow } from "@/lib/auth-guards";
import { ForbiddenError } from "@/lib/rbac";
import type { FormState } from "@/modules/clubs/action-state";
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

/** Suspend or re-activate a club (audited). Used by the Clubs page row action. */
export async function setClubStatusAction(_prev: FormState, fd: FormData): Promise<FormState> {
  const ctx = await requireRoleOrThrow("MASTER_ADMIN");
  const clubId = typeof fd.get("clubId") === "string" ? (fd.get("clubId") as string) : "";
  const status = fd.get("status") === "SUSPENDED" ? "SUSPENDED" : "ACTIVE";
  try {
    await setClubStatus(ctx, clubId, status);
  } catch (e) {
    if (e instanceof ForbiddenError) return { ok: false, error: "You don't have access to do that." };
    throw e;
  }
  revalidatePath("/clubs");
  revalidatePath("/dashboard/admin");
  return { ok: true, error: null };
}
