"use server";

import { requireRoleOrThrow } from "@/lib/auth-guards";
import { getRadarComparison, type RadarComparison } from "@/modules/evaluations/comparison-service";

/** Load a radar comparison for the selected players (caller's active club). */
export async function loadRadarComparisonAction(playerIds: string[]): Promise<RadarComparison> {
  const ctx = await requireRoleOrThrow("COACH", "CLUB_ADMIN", "MASTER_ADMIN");
  if (!ctx.activeClubId) return { axes: [], maxValue: 10, series: [] };
  return getRadarComparison(ctx, ctx.activeClubId, playerIds);
}
