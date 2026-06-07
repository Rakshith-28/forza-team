import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { prisma } from "@/db/client";
import { ForbiddenError } from "@/lib/rbac";
import {
  listParentSchedule,
  recordAttendance,
  submitRsvp,
} from "@/modules/events/service";
import { savePlayerEvaluation } from "@/modules/evaluations/service";
import { listSafeTeamRoster } from "@/modules/roster/service";
import { getOwnChildEvaluationSummary } from "@/modules/evaluations/service";

import { INTEGRATION, adminCtx, coachCtx, parentCtx, uid } from "./helpers";

/**
 * DB-backed behaviors previously verified only by the Phase-6 Step-0 script,
 * now real integration tests against an isolated DB (gated on TEST_DATABASE_URL).
 * Covers: RSVP/attendance/evaluation upsert uniqueness, parent multi-child
 * aggregation + cross-club scoping, parent-safe roster, and the evaluation
 * gating flag.
 */

// Created-id registry for teardown (FK-safe order applied in afterAll).
const ids = {
  clubA: uid(),
  clubB: uid(),
  teamA1: uid(),
  teamA2: uid(),
  player1: uid(),
  player2: uid(),
  parentUser: uid(),
  parentId: uid(),
  eventTeamA1: uid(),
  eventClubWideA: uid(),
  eventClubWideB: uid(),
  template: uid(),
  cycle: uid(),
};

const run = INTEGRATION ? describe : describe.skip;

run("DB integration", () => {
  beforeAll(async () => {
    // Clubs + settings (evaluations sharing OFF initially to test the gate).
    await prisma.club.createMany({
      data: [
        { id: ids.clubA, name: "ITClub A", shortCode: `ITA-${ids.clubA.slice(0, 8)}` },
        { id: ids.clubB, name: "ITClub B", shortCode: `ITB-${ids.clubB.slice(0, 8)}` },
      ],
    });
    await prisma.clubSetting.create({
      data: { clubId: ids.clubA, showPlayerPhotosToParents: false, allowParentChildEvaluationView: false },
    });

    await prisma.team.createMany({
      data: [
        { id: ids.teamA1, clubId: ids.clubA, name: "A1", teamCode: `A1-${ids.teamA1.slice(0, 6)}` },
        { id: ids.teamA2, clubId: ids.clubA, name: "A2", teamCode: `A2-${ids.teamA2.slice(0, 6)}` },
      ],
    });

    await prisma.player.createMany({
      data: [
        {
          id: ids.player1,
          clubId: ids.clubA,
          firstName: "Kid",
          lastName: "One",
          medicalNotes: "SECRET-MED",
          emergencyContactPhone: "555-SECRET",
          primaryPosition: "MID",
        },
        { id: ids.player2, clubId: ids.clubA, firstName: "Kid", lastName: "Two", primaryPosition: "FWD" },
      ],
    });
    // player1 → teamA1, player2 → teamA2 (parent has both children on two teams).
    await prisma.playerTeamMembership.createMany({
      data: [
        { clubId: ids.clubA, playerId: ids.player1, teamId: ids.teamA1 },
        { clubId: ids.clubA, playerId: ids.player2, teamId: ids.teamA2 },
      ],
    });

    await prisma.user.create({
      data: { id: ids.parentUser, email: `parent-${ids.parentUser}@it.test`, firstName: "Pat", lastName: "Parent" },
    });
    await prisma.parent.create({
      data: { id: ids.parentId, clubId: ids.clubA, userId: ids.parentUser, firstName: "Pat", lastName: "Parent", email: `parent-${ids.parentUser}@it.test` },
    });
    await prisma.playerParentLink.createMany({
      data: [
        { clubId: ids.clubA, playerId: ids.player1, parentId: ids.parentId, relationshipType: "GUARDIAN" },
        { clubId: ids.clubA, playerId: ids.player2, parentId: ids.parentId, relationshipType: "GUARDIAN" },
      ],
    });

    const soon = new Date(Date.now() + 86_400_000);
    const later = new Date(Date.now() + 90_000_000);
    await prisma.event.createMany({
      data: [
        { id: ids.eventTeamA1, clubId: ids.clubA, audienceScope: "TEAMS", eventType: "PRACTICE", title: "A1 Practice", startAt: soon, endAt: later, timezone: "America/New_York" },
        { id: ids.eventClubWideA, clubId: ids.clubA, audienceScope: "CLUB_WIDE", eventType: "CLUB_EVENT", title: "Club A Picnic", startAt: soon, endAt: later, timezone: "America/New_York" },
        { id: ids.eventClubWideB, clubId: ids.clubB, audienceScope: "CLUB_WIDE", eventType: "CLUB_EVENT", title: "Club B Gala", startAt: soon, endAt: later, timezone: "America/New_York" },
      ],
    });
    // Canonical audience: the team event targets team A1 via event_teams.
    await prisma.eventTeam.create({ data: { clubId: ids.clubA, eventId: ids.eventTeamA1, teamId: ids.teamA1 } });

    await prisma.evaluationTemplate.create({ data: { id: ids.template, clubId: ids.clubA, name: "IT Template" } });
    await prisma.evaluationCriterion.createMany({
      data: [
        { templateId: ids.template, code: "WORK_RATE", label: "Work Rate", sortOrder: 0, minScore: 0, maxScore: 10 },
        { templateId: ids.template, code: "PASSING", label: "Passing", sortOrder: 1, minScore: 0, maxScore: 10 },
      ],
    });
    await prisma.evaluationCycle.create({
      data: { id: ids.cycle, clubId: ids.clubA, teamId: ids.teamA1, name: "IT Cycle", cycleType: "MIDSEASON", startsAt: new Date(Date.now() - 1000), endsAt: new Date(Date.now() + 1_000_000) },
    });
  });

  afterAll(async () => {
    await prisma.playerEvaluationScore.deleteMany({ where: { playerEvaluation: { clubId: { in: [ids.clubA, ids.clubB] } } } });
    await prisma.playerEvaluation.deleteMany({ where: { clubId: { in: [ids.clubA, ids.clubB] } } });
    await prisma.evaluationCriterion.deleteMany({ where: { templateId: ids.template } });
    await prisma.evaluationCycle.deleteMany({ where: { clubId: { in: [ids.clubA, ids.clubB] } } });
    await prisma.evaluationTemplate.deleteMany({ where: { clubId: { in: [ids.clubA, ids.clubB] } } });
    await prisma.eventRsvp.deleteMany({ where: { clubId: { in: [ids.clubA, ids.clubB] } } });
    await prisma.attendanceRecord.deleteMany({ where: { clubId: { in: [ids.clubA, ids.clubB] } } });
    await prisma.eventTeam.deleteMany({ where: { clubId: { in: [ids.clubA, ids.clubB] } } });
    await prisma.event.deleteMany({ where: { clubId: { in: [ids.clubA, ids.clubB] } } });
    await prisma.playerParentLink.deleteMany({ where: { clubId: { in: [ids.clubA, ids.clubB] } } });
    await prisma.playerTeamMembership.deleteMany({ where: { clubId: { in: [ids.clubA, ids.clubB] } } });
    await prisma.parent.deleteMany({ where: { clubId: { in: [ids.clubA, ids.clubB] } } });
    await prisma.player.deleteMany({ where: { clubId: { in: [ids.clubA, ids.clubB] } } });
    await prisma.user.deleteMany({ where: { id: ids.parentUser } });
    await prisma.team.deleteMany({ where: { clubId: { in: [ids.clubA, ids.clubB] } } });
    await prisma.clubSetting.deleteMany({ where: { clubId: { in: [ids.clubA, ids.clubB] } } });
    await prisma.club.deleteMany({ where: { id: { in: [ids.clubA, ids.clubB] } } });
    await prisma.$disconnect();
  });

  it("RSVP is an upsert keyed on (event, player) — repeated submits update, never duplicate", async () => {
    const ctx = parentCtx(ids.clubA, [ids.player1, ids.player2], [ids.teamA1, ids.teamA2]);
    await submitRsvp(ctx, ids.eventTeamA1, { playerId: ids.player1, responseStatus: "GOING", comment: undefined });
    await submitRsvp(ctx, ids.eventTeamA1, { playerId: ids.player1, responseStatus: "NOT_GOING", comment: undefined });
    const rows = await prisma.eventRsvp.findMany({ where: { eventId: ids.eventTeamA1, playerId: ids.player1 } });
    expect(rows).toHaveLength(1);
    expect(rows[0].responseStatus).toBe("NOT_GOING");
  });

  it("attendance is an upsert keyed on (event, player)", async () => {
    const ctx = adminCtx(ids.clubA);
    await recordAttendance(ctx, ids.eventTeamA1, { entries: [{ playerId: ids.player1, attendanceStatus: "PRESENT", notes: undefined }] });
    await recordAttendance(ctx, ids.eventTeamA1, { entries: [{ playerId: ids.player1, attendanceStatus: "LATE", notes: undefined }] });
    const rows = await prisma.attendanceRecord.findMany({ where: { eventId: ids.eventTeamA1, playerId: ids.player1 } });
    expect(rows).toHaveLength(1);
    expect(rows[0].attendanceStatus).toBe("LATE");
  });

  it("evaluation is an upsert per (player, cycle, template)", async () => {
    const ctx = coachCtx(ids.clubA, [ids.teamA1], [ids.player1]);
    const criteria = await prisma.evaluationCriterion.findMany({ where: { templateId: ids.template } });
    const scores = criteria.map((c, i) => ({ criterionId: c.id, rawScore: i === 0 ? 6 : 8 }));
    const base = {
      playerId: ids.player1,
      teamId: ids.teamA1,
      evaluationCycleId: ids.cycle,
      templateId: ids.template,
      scores,
      summaryComment: undefined,
      coachOnlyNotes: undefined,
      parentVisibleNotes: undefined,
    };
    await savePlayerEvaluation(ctx, base);
    await savePlayerEvaluation(ctx, { ...base, scores: criteria.map((c) => ({ criterionId: c.id, rawScore: 10 })) });
    const rows = await prisma.playerEvaluation.findMany({ where: { playerId: ids.player1, evaluationCycleId: ids.cycle, templateId: ids.template } });
    expect(rows).toHaveLength(1);
    expect(Number(rows[0].overallScore)).toBe(10); // unweighted mean of [10,10]
    // weighted_score == raw_score (no weighting applied)
    const evScores = await prisma.playerEvaluationScore.findMany({ where: { playerEvaluationId: rows[0].id } });
    for (const s of evScores) expect(Number(s.weightedScore)).toBe(Number(s.rawScore));
  });

  it("parent multi-child schedule aggregates both children + club-wide, scoped to the club", async () => {
    const ctx = parentCtx(ids.clubA, [ids.player1, ids.player2], [ids.teamA1, ids.teamA2]);
    const schedule = await listParentSchedule(ctx);
    const eventIds = schedule.map((s) => s.event.id);
    expect(eventIds).toContain(ids.eventTeamA1);
    expect(eventIds).toContain(ids.eventClubWideA);
    // Cross-club isolation: club B's club-wide event must NOT appear.
    expect(eventIds).not.toContain(ids.eventClubWideB);
    // De-dup: each event appears once.
    expect(new Set(eventIds).size).toBe(eventIds.length);
    // The club-wide event lists both linked children.
    const clubWide = schedule.find((s) => s.event.id === ids.eventClubWideA);
    expect(clubWide?.children.map((c) => c.playerId).sort()).toEqual([ids.player1, ids.player2].sort());
  });

  it("parent-safe roster strips restricted PII and respects the photo setting", async () => {
    const ctx = parentCtx(ids.clubA, [ids.player1, ids.player2], [ids.teamA1, ids.teamA2]);
    const roster = await listSafeTeamRoster(ctx, ids.teamA1);
    const serialized = JSON.stringify(roster);
    expect(serialized).not.toContain("SECRET-MED");
    expect(serialized).not.toContain("555-SECRET");
    expect(roster[0]?.photoUrl ?? null).toBeNull(); // showPlayerPhotosToParents = false
  });

  it("parent evaluation summary is gated by allow_parent_child_evaluation_view", async () => {
    const ctx = parentCtx(ids.clubA, [ids.player1, ids.player2], [ids.teamA1, ids.teamA2]);
    // Gate OFF → rejected.
    await expect(getOwnChildEvaluationSummary(ctx, ids.player1)).rejects.toBeInstanceOf(ForbiddenError);
    // Flip the flag ON → allowed, and coach-only notes never leak.
    await prisma.clubSetting.update({ where: { clubId: ids.clubA }, data: { allowParentChildEvaluationView: true } });
    const summaries = await getOwnChildEvaluationSummary(ctx, ids.player1);
    expect(summaries.length).toBeGreaterThan(0);
    const serialized = JSON.stringify(summaries);
    expect(serialized).not.toContain("coachOnlyNotes");
  });
});
