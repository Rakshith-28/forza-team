import "server-only";

import { prisma } from "@/db/client";
import { Prisma } from "@/db/generated/client";
import { recordAudit } from "@/lib/audit";
import { assertCan, assertClubScope, ForbiddenError, type AuthContext } from "@/lib/rbac";
import {
  DEFAULT_CRITERIA,
  DEFAULT_MAX_SCORE,
  DEFAULT_MIN_SCORE,
  unweightedOverall,
  type CreateCriterionInput,
  type CreateCycleInput,
  type CreateTemplateInput,
  type SavePlayerEvaluationInput,
  type UpdateCriterionInput,
  type UpdateCycleInput,
  type UpdateTemplateInput,
} from "@/modules/evaluations/schemas";
import { playerEvaluationSummary, type PlayerEvaluationSummary } from "@/modules/evaluations/projections";

/**
 * Evaluations module service layer — AUTHORITATIVE for authorization, tenant/
 * team/child scoping, UNWEIGHTED scoring, the player serializer projection, and
 * audit (BUILD_PLAN §2, RBAC matrix §6.18).
 *
 * MVP scope: simple unweighted aggregate; NO position weighting, ranking, or
 * buckets. `weighted_score` is set equal to `raw_score` (the column is NOT NULL
 * but no weighting is applied); `rank_in_scope`/`bucket_label` stay NULL.
 */

export class ConflictError extends Error {
  readonly code = "CONFLICT";
  constructor(message: string) {
    super(message);
    this.name = "ConflictError";
  }
}

// ===========================================================================
// Templates + criteria
// ===========================================================================

export async function listTemplates(ctx: AuthContext, clubId: string) {
  assertCan(ctx, "evaluations.view_config", { clubId });
  return prisma.evaluationTemplate.findMany({
    where: { clubId, status: { not: "ARCHIVED" } },
    orderBy: { name: "asc" },
    include: { criteria: { orderBy: { sortOrder: "asc" } }, _count: { select: { playerEvaluations: true } } },
  });
}

export async function getTemplate(ctx: AuthContext, templateId: string) {
  const template = await prisma.evaluationTemplate.findUnique({
    where: { id: templateId },
    include: { criteria: { orderBy: { sortOrder: "asc" } } },
  });
  if (!template) return null;
  assertClubScope(ctx, template.clubId);
  assertCan(ctx, "evaluations.view_config", { clubId: template.clubId });
  return template;
}

export async function createTemplate(ctx: AuthContext, clubId: string, input: CreateTemplateInput) {
  assertCan(ctx, "evaluations.manage_templates", { clubId });
  return prisma.$transaction(async (tx) => {
    const template = await tx.evaluationTemplate.create({
      data: { clubId, name: input.name, description: input.description ?? null, createdBy: ctx.userId },
    });
    // Seed the MVP default criteria.
    await tx.evaluationCriterion.createMany({
      data: DEFAULT_CRITERIA.map((c, i) => ({
        templateId: template.id,
        code: c.code,
        label: c.label,
        sortOrder: i,
        minScore: DEFAULT_MIN_SCORE,
        maxScore: DEFAULT_MAX_SCORE,
      })),
    });
    await recordAudit(tx, {
      action: "evaluation_template.create",
      resourceType: "evaluation_template",
      resourceId: template.id,
      clubId,
      actorUserId: ctx.userId,
      metadata: { name: template.name },
    });
    return template;
  });
}

export async function updateTemplate(ctx: AuthContext, templateId: string, input: UpdateTemplateInput) {
  const template = await prisma.evaluationTemplate.findUnique({ where: { id: templateId }, select: { clubId: true } });
  if (!template) throw new ForbiddenError("Template not found");
  assertCan(ctx, "evaluations.manage_templates", { clubId: template.clubId });
  return prisma.evaluationTemplate.update({
    where: { id: templateId },
    data: { name: input.name, description: input.description ?? null, updatedAt: new Date(), updatedBy: ctx.userId },
  });
}

export async function createCriterion(ctx: AuthContext, templateId: string, input: CreateCriterionInput) {
  const template = await prisma.evaluationTemplate.findUnique({
    where: { id: templateId },
    select: { clubId: true, _count: { select: { criteria: true } } },
  });
  if (!template) throw new ForbiddenError("Template not found");
  assertCan(ctx, "evaluations.manage_templates", { clubId: template.clubId });
  try {
    return await prisma.evaluationCriterion.create({
      data: {
        templateId,
        code: input.code,
        label: input.label,
        sortOrder: template._count.criteria,
        minScore: input.minScore,
        maxScore: input.maxScore,
      },
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      throw new ConflictError("A criterion with that code already exists in this template");
    }
    throw error;
  }
}

export async function updateCriterion(ctx: AuthContext, criterionId: string, input: UpdateCriterionInput) {
  const criterion = await prisma.evaluationCriterion.findUnique({
    where: { id: criterionId },
    select: { template: { select: { clubId: true } } },
  });
  if (!criterion) throw new ForbiddenError("Criterion not found");
  assertCan(ctx, "evaluations.manage_templates", { clubId: criterion.template.clubId });
  return prisma.evaluationCriterion.update({
    where: { id: criterionId },
    data: { label: input.label, minScore: input.minScore, maxScore: input.maxScore, isActive: input.isActive },
  });
}

// ===========================================================================
// Cycles
// ===========================================================================

export async function listCycles(ctx: AuthContext, clubId: string) {
  assertCan(ctx, "evaluations.view_config", { clubId });
  const where: Prisma.EvaluationCycleWhereInput = { clubId };
  // Coaches see club-wide cycles + cycles scoped to their assigned teams.
  if (ctx.role === "COACH") where.OR = [{ teamId: null }, { teamId: { in: ctx.coachTeamIds } }];
  return prisma.evaluationCycle.findMany({
    where,
    orderBy: { startsAt: "desc" },
    include: { team: { select: { id: true, name: true } } },
  });
}

export async function getCycle(ctx: AuthContext, cycleId: string) {
  const cycle = await prisma.evaluationCycle.findUnique({
    where: { id: cycleId },
    include: { team: { select: { id: true, name: true } } },
  });
  if (!cycle) return null;
  assertCan(ctx, "evaluations.view_config", { clubId: cycle.clubId });
  return cycle;
}

async function assertTeamInClub(teamId: string, clubId: string): Promise<void> {
  const team = await prisma.team.findFirst({ where: { id: teamId, clubId, deletedAt: null }, select: { id: true } });
  if (!team) throw new ForbiddenError("Team does not belong to this club");
}

export async function createCycle(ctx: AuthContext, clubId: string, input: CreateCycleInput) {
  // Cycle management is admin-only in MVP (no club setting enables coach creation).
  assertCan(ctx, "evaluations.manage_templates", { clubId });
  if (input.teamId) await assertTeamInClub(input.teamId, clubId);
  return prisma.$transaction(async (tx) => {
    const cycle = await tx.evaluationCycle.create({
      data: {
        clubId,
        teamId: input.teamId ?? null,
        seasonId: input.seasonId ?? null,
        name: input.name,
        cycleType: input.cycleType,
        startsAt: input.startsAt,
        endsAt: input.endsAt,
        createdBy: ctx.userId,
      },
    });
    await recordAudit(tx, {
      action: "evaluation_cycle.create",
      resourceType: "evaluation_cycle",
      resourceId: cycle.id,
      clubId,
      actorUserId: ctx.userId,
      metadata: { name: cycle.name, teamId: cycle.teamId },
    });
    return cycle;
  });
}

export async function updateCycle(ctx: AuthContext, cycleId: string, input: UpdateCycleInput) {
  const cycle = await prisma.evaluationCycle.findUnique({ where: { id: cycleId }, select: { clubId: true } });
  if (!cycle) throw new ForbiddenError("Cycle not found");
  assertCan(ctx, "evaluations.manage_templates", { clubId: cycle.clubId });
  if (input.teamId) await assertTeamInClub(input.teamId, cycle.clubId);
  return prisma.evaluationCycle.update({
    where: { id: cycleId },
    data: {
      name: input.name,
      cycleType: input.cycleType,
      teamId: input.teamId ?? null,
      seasonId: input.seasonId ?? null,
      startsAt: input.startsAt,
      endsAt: input.endsAt,
      status: input.status,
      updatedAt: new Date(),
      updatedBy: ctx.userId,
    },
  });
}

// ===========================================================================
// Player evaluations (unweighted scoring + upsert)
// ===========================================================================

export async function savePlayerEvaluation(ctx: AuthContext, input: SavePlayerEvaluationInput) {
  const player = await prisma.player.findFirst({
    where: { id: input.playerId, deletedAt: null },
    select: { clubId: true, primaryPosition: true },
  });
  if (!player) throw new ForbiddenError("Player not found");
  // Coach: assigned-team players only; admin: club-wide. Scope-checked here.
  assertCan(ctx, "evaluations.score_players", {
    clubId: player.clubId,
    teamId: input.teamId,
    playerId: input.playerId,
  });
  await assertTeamInClub(input.teamId, player.clubId);

  // The player must actually be on the evaluating team.
  const membership = await prisma.playerTeamMembership.findFirst({
    where: { playerId: input.playerId, teamId: input.teamId, status: "ACTIVE" },
    select: { id: true },
  });
  if (!membership) throw new ForbiddenError("Player is not on that team");

  // Validate the cycle + template belong to the club, and load criterion bounds.
  const [cycle, template] = await Promise.all([
    prisma.evaluationCycle.findFirst({ where: { id: input.evaluationCycleId, clubId: player.clubId }, select: { id: true } }),
    prisma.evaluationTemplate.findFirst({
      where: { id: input.templateId, clubId: player.clubId },
      select: { id: true, criteria: { where: { isActive: true }, select: { id: true, minScore: true, maxScore: true } } },
    }),
  ]);
  if (!cycle) throw new ForbiddenError("Cycle does not belong to this club");
  if (!template) throw new ForbiddenError("Template does not belong to this club");

  const bounds = new Map(template.criteria.map((c) => [c.id, { min: Number(c.minScore), max: Number(c.maxScore) }]));
  for (const s of input.scores) {
    const b = bounds.get(s.criterionId);
    if (!b) throw new ForbiddenError("Score references a criterion outside this template");
    if (s.rawScore < b.min || s.rawScore > b.max) {
      throw new ConflictError(`Score for a criterion must be between ${b.min} and ${b.max}`);
    }
  }

  // UNWEIGHTED overall = simple mean of raw scores (no position weighting).
  const overall = unweightedOverall(input.scores.map((s) => s.rawScore));
  const positionCode = player.primaryPosition ?? "UNKNOWN";

  return prisma.$transaction(async (tx) => {
    const evaluation = await tx.playerEvaluation.upsert({
      where: {
        uq_player_evaluations: {
          playerId: input.playerId,
          evaluationCycleId: input.evaluationCycleId,
          templateId: input.templateId,
        },
      },
      create: {
        clubId: player.clubId,
        teamId: input.teamId,
        playerId: input.playerId,
        evaluationCycleId: input.evaluationCycleId,
        templateId: input.templateId,
        positionCode,
        overallScore: overall,
        summaryComment: input.summaryComment ?? null,
        coachOnlyNotes: input.coachOnlyNotes ?? null,
        playerVisibleNotes: input.playerVisibleNotes ?? null,
        createdBy: ctx.userId,
        // rankInScope / bucketLabel intentionally left NULL (no ranking in MVP).
      },
      update: {
        teamId: input.teamId,
        positionCode,
        overallScore: overall,
        summaryComment: input.summaryComment ?? null,
        coachOnlyNotes: input.coachOnlyNotes ?? null,
        playerVisibleNotes: input.playerVisibleNotes ?? null,
        updatedAt: new Date(),
        updatedBy: ctx.userId,
      },
    });

    // Replace the criterion scores. weighted_score := raw_score (no weighting).
    await tx.playerEvaluationScore.deleteMany({ where: { playerEvaluationId: evaluation.id } });
    await tx.playerEvaluationScore.createMany({
      data: input.scores.map((s) => ({
        playerEvaluationId: evaluation.id,
        criterionId: s.criterionId,
        rawScore: s.rawScore,
        weightedScore: s.rawScore,
      })),
    });

    await recordAudit(tx, {
      action: "player_evaluation.save",
      resourceType: "player_evaluation",
      resourceId: evaluation.id,
      clubId: player.clubId,
      actorUserId: ctx.userId,
      metadata: { playerId: input.playerId, cycleId: input.evaluationCycleId, overall },
    });
    return evaluation;
  });
}

/** Full evaluation (staff): includes coach-only notes + per-criterion scores. */
export async function getPlayerEvaluation(ctx: AuthContext, evaluationId: string) {
  const evaluation = await prisma.playerEvaluation.findUnique({
    where: { id: evaluationId },
    include: {
      player: { select: { id: true, firstName: true, lastName: true } },
      template: { select: { id: true, name: true, criteria: { orderBy: { sortOrder: "asc" } } } },
      evaluationCycle: { select: { id: true, name: true } },
      scores: true,
    },
  });
  if (!evaluation) return null;
  assertCan(ctx, "evaluations.view_team", {
    clubId: evaluation.clubId,
    teamId: evaluation.teamId,
    playerId: evaluation.playerId,
  });
  return evaluation;
}

/** Staff list of evaluations, scoped (coach → assigned teams). */
export async function listPlayerEvaluations(
  ctx: AuthContext,
  clubId: string,
  opts: { cycleId?: string; teamId?: string; playerId?: string } = {},
) {
  assertCan(ctx, "evaluations.view_team", { clubId });
  if (ctx.role === "PLAYER") throw new ForbiddenError("Player accounts use the own-child summary");
  const where: Prisma.PlayerEvaluationWhereInput = { clubId };
  if (opts.cycleId) where.evaluationCycleId = opts.cycleId;
  if (opts.playerId) where.playerId = opts.playerId;
  if (opts.teamId) where.teamId = opts.teamId;
  if (ctx.role === "COACH") where.teamId = opts.teamId ? opts.teamId : { in: ctx.coachTeamIds };
  if (ctx.role === "COACH" && opts.teamId && !ctx.coachTeamIds.includes(opts.teamId)) {
    throw new ForbiddenError("Team is outside your scope");
  }
  return prisma.playerEvaluation.findMany({
    where,
    orderBy: { createdAt: "desc" },
    include: {
      player: { select: { id: true, firstName: true, lastName: true } },
      evaluationCycle: { select: { id: true, name: true } },
    },
  });
}

// ===========================================================================
// Player-account-facing summary (gated + serializer projection)
// ===========================================================================

/**
 * Own-child evaluation summaries for a player account. Gated by the club setting
 * `allow_player_evaluation_view`; runs through the player serializer so
 * coach-only notes and per-criterion scores never leave the server.
 */
export async function getOwnChildEvaluationSummary(
  ctx: AuthContext,
  playerId: string,
): Promise<Array<PlayerEvaluationSummary & { cycleName: string; templateName: string }>> {
  const player = await prisma.player.findFirst({ where: { id: playerId, deletedAt: null }, select: { clubId: true } });
  if (!player) throw new ForbiddenError("Player not found");
  // Own-child only.
  assertCan(ctx, "evaluations.view_own_child_summary", { clubId: player.clubId, playerId });

  // Club gate — evaluation visibility for player accounts is opt-in per club.
  const setting = await prisma.clubSetting.findUnique({
    where: { clubId: player.clubId },
    select: { allowPlayerEvaluationView: true },
  });
  if (!setting?.allowPlayerEvaluationView) {
    throw new ForbiddenError("Evaluation sharing is not enabled for this club");
  }

  const evaluations = await prisma.playerEvaluation.findMany({
    where: { playerId },
    orderBy: { createdAt: "desc" },
    include: {
      evaluationCycle: { select: { name: true } },
      template: { select: { name: true } },
    },
  });
  // Serializer projection strips coach_only_notes / criterion scores / ranking.
  return evaluations.map((e) => ({
    ...playerEvaluationSummary(e),
    cycleName: e.evaluationCycle.name,
    templateName: e.template.name,
  }));
}

/** Whether the club exposes evaluation summaries to player accounts (dashboard gate). */
export async function playerEvaluationViewEnabled(clubId: string): Promise<boolean> {
  const setting = await prisma.clubSetting.findUnique({
    where: { clubId },
    select: { allowPlayerEvaluationView: true },
  });
  return setting?.allowPlayerEvaluationView ?? false;
}

// ===========================================================================
// Dashboard feed
// ===========================================================================

/** Count of assigned-team players not yet evaluated in an ACTIVE cycle (coach). */
export async function countEvaluationsToComplete(ctx: AuthContext, clubId: string): Promise<number> {
  assertCan(ctx, "evaluations.view_team", { clubId });

  const activeCycles = await prisma.evaluationCycle.findMany({
    where: {
      clubId,
      status: "ACTIVE",
      ...(ctx.role === "COACH" ? { OR: [{ teamId: null }, { teamId: { in: ctx.coachTeamIds } }] } : {}),
    },
    select: { id: true },
  });
  if (activeCycles.length === 0) return 0;
  const cycleIds = activeCycles.map((c) => c.id);

  const teamIds = ctx.role === "COACH" ? ctx.coachTeamIds : undefined;
  if (ctx.role === "COACH" && (!teamIds || teamIds.length === 0)) return 0;

  // Players on the relevant teams.
  const memberships = await prisma.playerTeamMembership.findMany({
    where: { clubId, status: "ACTIVE", ...(teamIds ? { teamId: { in: teamIds } } : {}) },
    select: { playerId: true },
  });
  const playerIds = [...new Set(memberships.map((m) => m.playerId))];
  if (playerIds.length === 0) return 0;

  const evaluated = await prisma.playerEvaluation.findMany({
    where: { clubId, evaluationCycleId: { in: cycleIds }, playerId: { in: playerIds } },
    select: { playerId: true },
  });
  const done = new Set(evaluated.map((e) => e.playerId));
  return playerIds.filter((p) => !done.has(p)).length;
}
