import "server-only";

import { prisma } from "@/db/client";
import { assertCan, type AuthContext } from "@/lib/rbac";

/**
 * Multi-player evaluation comparison (radar). Uses each selected player's MOST
 * RECENT evaluation, aligning their per-criterion raw scores onto a shared set
 * of axes. Coach-scoped: a coach can only compare players on their teams.
 */

export interface RadarComparison {
  axes: string[];
  maxValue: number;
  series: { playerId: string; name: string; values: number[] }[];
}

function playerName(p: { firstName: string; lastName: string; preferredName: string | null }): string {
  return `${p.preferredName ?? p.firstName} ${p.lastName}`.trim();
}

export async function getRadarComparison(
  ctx: AuthContext,
  clubId: string,
  playerIds: string[],
): Promise<RadarComparison> {
  assertCan(ctx, "evaluations.view_team", { clubId });

  // Coaches may only compare players within their team scope.
  const ids = (ctx.role === "COACH" ? playerIds.filter((id) => ctx.coachTeamPlayerIds.includes(id)) : playerIds).slice(0, 4);
  if (ids.length === 0) return { axes: [], maxValue: 10, series: [] };

  const players = await prisma.player.findMany({
    where: { id: { in: ids }, clubId, deletedAt: null },
    select: { id: true, firstName: true, lastName: true, preferredName: true },
  });
  const nameById = new Map(players.map((p) => [p.id, playerName(p)]));

  const latestEvals = await Promise.all(
    ids.map((pid) =>
      prisma.playerEvaluation.findFirst({
        where: { clubId, playerId: pid },
        orderBy: { createdAt: "desc" },
        select: { playerId: true, scores: { select: { rawScore: true, criterion: { select: { id: true, label: true } } } } },
      }),
    ),
  );

  // Shared axes = union of criteria across the selected players' latest evals.
  const axisOrder: { id: string; name: string }[] = [];
  const seen = new Set<string>();
  for (const ev of latestEvals) {
    for (const s of ev?.scores ?? []) {
      if (!seen.has(s.criterion.id)) {
        seen.add(s.criterion.id);
        axisOrder.push({ id: s.criterion.id, name: s.criterion.label });
      }
    }
  }

  let maxValue = 0;
  const series = ids
    .map((pid) => {
      const ev = latestEvals.find((e) => e?.playerId === pid);
      const byCrit = new Map((ev?.scores ?? []).map((s) => [s.criterion.id, Number(s.rawScore)]));
      const values = axisOrder.map((a) => {
        const v = byCrit.get(a.id) ?? 0;
        if (v > maxValue) maxValue = v;
        return v;
      });
      return { playerId: pid, name: nameById.get(pid) ?? "Player", values };
    })
    // Drop players with no evaluation data (all-zero axes / no axes).
    .filter((s) => s.values.some((v) => v > 0));

  return { axes: axisOrder.map((a) => a.name), maxValue: Math.max(1, Math.ceil(maxValue)), series };
}
