import "server-only";

import { prisma } from "@/db/client";
import { Prisma } from "@/db/generated/client";
import { recordAudit } from "@/lib/audit";
import { assertCan, ForbiddenError, type AuthContext } from "@/lib/rbac";
import type { AddGoalUpdateInput, CreateGoalInput } from "@/modules/evaluations/development-schemas";

/**
 * Development goals + progress updates. Coaches manage goals for players on their
 * teams (gated by the evaluations permissions: view_team to read, score_players
 * to write — both already TEAM-scoped for coaches). Club/Master admins see all
 * club goals. Goal create/updates are audited (they concern a minor's record).
 */

export interface DevelopmentGoalRow {
  id: string;
  playerId: string;
  playerName: string;
  teamId: string | null;
  title: string;
  category: string | null;
  status: string;
  visibility: string;
  targetDate: Date | null;
  updatesCount: number;
  latestUpdate: { progressStatus: string; notes: string | null; createdAt: Date } | null;
}

function playerName(p: { firstName: string; lastName: string; preferredName: string | null }): string {
  return `${p.preferredName ?? p.firstName} ${p.lastName}`.trim();
}

export async function listDevelopmentGoals(ctx: AuthContext, clubId: string): Promise<DevelopmentGoalRow[]> {
  assertCan(ctx, "evaluations.view_team", { clubId });

  const where: Prisma.DevelopmentGoalWhereInput = { clubId };
  if (ctx.role === "COACH") where.playerId = { in: ctx.coachTeamPlayerIds };

  const goals = await prisma.developmentGoal.findMany({
    where,
    orderBy: [{ status: "asc" }, { createdAt: "desc" }],
    select: {
      id: true,
      playerId: true,
      teamId: true,
      title: true,
      category: true,
      status: true,
      visibility: true,
      targetDate: true,
      player: { select: { firstName: true, lastName: true, preferredName: true } },
      updates: { orderBy: { createdAt: "desc" }, take: 1, select: { progressStatus: true, notes: true, createdAt: true } },
      _count: { select: { updates: true } },
    },
  });

  return goals.map((g) => ({
    id: g.id,
    playerId: g.playerId,
    playerName: playerName(g.player),
    teamId: g.teamId,
    title: g.title,
    category: g.category,
    status: g.status,
    visibility: g.visibility,
    targetDate: g.targetDate,
    updatesCount: g._count.updates,
    latestUpdate: g.updates[0] ?? null,
  }));
}

/** Players the caller may set goals for (coach: their team players; admin: all). */
export async function listGoalPlayerOptions(
  ctx: AuthContext,
  clubId: string,
): Promise<{ playerId: string; teamId: string | null; name: string }[]> {
  assertCan(ctx, "evaluations.view_team", { clubId });
  const where: Prisma.PlayerTeamMembershipWhereInput = { clubId, status: "ACTIVE" };
  if (ctx.role === "COACH") where.playerId = { in: ctx.coachTeamPlayerIds };

  const memberships = await prisma.playerTeamMembership.findMany({
    where,
    distinct: ["playerId"],
    select: { playerId: true, teamId: true, player: { select: { firstName: true, lastName: true, preferredName: true } } },
  });
  return memberships
    .map((m) => ({ playerId: m.playerId, teamId: m.teamId, name: playerName(m.player) }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

export async function createDevelopmentGoal(ctx: AuthContext, clubId: string, input: CreateGoalInput): Promise<string> {
  // Resolve the player's team for the scope assertion (coach must own that team).
  const membership = await prisma.playerTeamMembership.findFirst({
    where: { clubId, playerId: input.playerId, status: "ACTIVE" },
    select: { teamId: true },
  });
  const teamId = membership?.teamId ?? null;
  assertCan(ctx, "evaluations.score_players", { clubId, teamId, playerId: input.playerId });

  return prisma.$transaction(async (tx) => {
    const goal = await tx.developmentGoal.create({
      data: {
        clubId,
        playerId: input.playerId,
        teamId,
        title: input.title,
        category: input.category ?? null,
        visibility: input.visibility,
        targetDate: input.targetDate,
        status: "OPEN",
        createdBy: ctx.userId,
      },
      select: { id: true },
    });
    await recordAudit(tx, {
      action: "development_goal.create",
      resourceType: "development_goal",
      resourceId: goal.id,
      clubId,
      actorUserId: ctx.userId,
      metadata: { playerId: input.playerId, title: input.title },
    });
    return goal.id;
  });
}

export async function addDevelopmentGoalUpdate(ctx: AuthContext, goalId: string, input: AddGoalUpdateInput): Promise<void> {
  const goal = await prisma.developmentGoal.findUnique({
    where: { id: goalId },
    select: { clubId: true, teamId: true, playerId: true },
  });
  if (!goal) throw new ForbiddenError("Goal not found");
  assertCan(ctx, "evaluations.score_players", { clubId: goal.clubId, teamId: goal.teamId, playerId: goal.playerId });

  await prisma.$transaction(async (tx) => {
    await tx.developmentGoalUpdate.create({
      data: { goalId, progressStatus: input.progressStatus, notes: input.notes ?? null, createdBy: ctx.userId },
    });
    // Keep the goal's headline status in sync with its latest update.
    await tx.developmentGoal.update({
      where: { id: goalId },
      data: { status: input.progressStatus, updatedAt: new Date(), updatedBy: ctx.userId },
    });
    await recordAudit(tx, {
      action: "development_goal.update",
      resourceType: "development_goal",
      resourceId: goalId,
      clubId: goal.clubId,
      actorUserId: ctx.userId,
      metadata: { progressStatus: input.progressStatus },
    });
  });
}
