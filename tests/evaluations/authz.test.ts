import { describe, expect, it } from "vitest";

import { can, ForbiddenError, type AuthContext } from "@/lib/rbac";
import { createTemplate, listCycles, listTemplates } from "@/modules/evaluations/service";
import { parentEvaluationSummary, type PlayerEvaluationLike } from "@/modules/evaluations/projections";
import { unweightedOverall } from "@/modules/evaluations/schemas";

/**
 * Phase 6 authorization + behavior for evaluations (RBAC matrix §6.18). Pure
 * scope rules, service guards that reject before DB access, the parent
 * serializer projection, and the unweighted scoring rule.
 */

const CLUB_A = "club-a";
const CLUB_B = "club-b";

function ctx(overrides: Partial<AuthContext>): AuthContext {
  return {
    userId: "u",
    role: "CLUB_ADMIN",
    activeClubId: CLUB_A,
    coachTeamIds: [],
    coachTeamPlayerIds: [],
    linkedPlayerIds: [],
    childTeamIds: [],
    ...overrides,
  };
}

const clubAdminA = ctx({ role: "CLUB_ADMIN", activeClubId: CLUB_A });
const coachA = ctx({ role: "COACH", activeClubId: CLUB_A, coachTeamIds: ["t1"], coachTeamPlayerIds: ["p1"] });
const parentA = ctx({ role: "PARENT", activeClubId: CLUB_A, linkedPlayerIds: ["kid-1"], childTeamIds: ["t2"] });

// ---------------------------------------------------------------------------
// 1 — Parent has no evaluation config / scoring access
// ---------------------------------------------------------------------------
describe("parent evaluation permissions", () => {
  it("cannot view config or manage/score", () => {
    expect(can(parentA, "evaluations.view_config", { clubId: CLUB_A })).toBe(false);
    expect(can(parentA, "evaluations.manage_templates", { clubId: CLUB_A })).toBe(false);
    expect(can(parentA, "evaluations.score_players", { clubId: CLUB_A, teamId: "t2", playerId: "kid-1" })).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// 2 — Coach scores only assigned-team players
// ---------------------------------------------------------------------------
describe("coach scoring scope", () => {
  it("permits scoring for an assigned-team player only", () => {
    expect(can(coachA, "evaluations.score_players", { clubId: CLUB_A, teamId: "t1", playerId: "p1" })).toBe(true);
    expect(can(coachA, "evaluations.score_players", { clubId: CLUB_A, teamId: "t-unassigned", playerId: "p1" })).toBe(false);
    expect(can(coachA, "evaluations.score_players", { clubId: CLUB_A, playerId: "p-elsewhere" })).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// 3 — Coach is view-only on templates/criteria
// ---------------------------------------------------------------------------
describe("coach config access", () => {
  it("can view config but not manage", () => {
    expect(can(coachA, "evaluations.view_config", { clubId: CLUB_A })).toBe(true);
    expect(can(coachA, "evaluations.manage_templates", { clubId: CLUB_A })).toBe(false);
  });
  it("createTemplate rejects a coach before any DB access", async () => {
    await expect(createTemplate(coachA, CLUB_A, { name: "X", description: undefined })).rejects.toBeInstanceOf(
      ForbiddenError,
    );
  });
});

// ---------------------------------------------------------------------------
// 5 — coach_only_notes never in the parent payload (serializer)
// ---------------------------------------------------------------------------
describe("parent evaluation serializer", () => {
  const full: PlayerEvaluationLike = {
    id: "e1",
    overallScore: 7.5,
    summaryComment: "Great term",
    parentVisibleNotes: "Keep practicing passing",
    coachOnlyNotes: "SECRET: trial for select squad",
    rankInScope: 3,
    bucketLabel: "TOP",
  };
  const summary = parentEvaluationSummary(full);

  it("exposes only summary, parent-visible notes, and overall score", () => {
    expect(Object.keys(summary).sort()).toEqual(["id", "overallScore", "parentVisibleNotes", "summaryComment"].sort());
  });
  it("never leaks coach-only notes, rank, or bucket", () => {
    const serialized = JSON.stringify(summary);
    expect(serialized).not.toContain("SECRET");
    expect(serialized).not.toContain("TOP");
    const rec = summary as unknown as Record<string, unknown>;
    expect(rec).not.toHaveProperty("coachOnlyNotes");
    expect(rec).not.toHaveProperty("rankInScope");
    expect(rec).not.toHaveProperty("bucketLabel");
  });
});

// ---------------------------------------------------------------------------
// 6 — Parent cannot see another child's evaluation
// ---------------------------------------------------------------------------
describe("parent own-child evaluation scope", () => {
  it("only own linked child", () => {
    expect(can(parentA, "evaluations.view_own_child_summary", { clubId: CLUB_A, playerId: "kid-1" })).toBe(true);
    expect(can(parentA, "evaluations.view_own_child_summary", { clubId: CLUB_A, playerId: "other-kid" })).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// 7 — Unweighted overall score
// ---------------------------------------------------------------------------
describe("unweighted scoring", () => {
  it("overall is the simple mean of raw scores", () => {
    expect(unweightedOverall([5, 10])).toBe(7.5);
    expect(unweightedOverall([8, 8, 8])).toBe(8);
    expect(unweightedOverall([])).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// 8 — Cross-club isolation
// ---------------------------------------------------------------------------
describe("cross-club isolation", () => {
  it("rejects reading another club's templates/cycles", async () => {
    await expect(listTemplates(clubAdminA, CLUB_B)).rejects.toBeInstanceOf(ForbiddenError);
    await expect(listCycles(coachA, CLUB_B)).rejects.toBeInstanceOf(ForbiddenError);
  });
  it("rejects creating a template in another club", async () => {
    await expect(createTemplate(clubAdminA, CLUB_B, { name: "X", description: undefined })).rejects.toBeInstanceOf(
      ForbiddenError,
    );
  });
});

// ---------------------------------------------------------------------------
// 10 — Dashboard data scoped per role
// ---------------------------------------------------------------------------
describe("dashboard scope", () => {
  it("evaluation/attendance dashboard counts are staff-scoped", () => {
    expect(can(coachA, "evaluations.view_team", { clubId: CLUB_A })).toBe(true);
    expect(can(clubAdminA, "evaluations.view_team", { clubId: CLUB_A })).toBe(true);
    expect(can(parentA, "evaluations.view_team", { clubId: CLUB_A })).toBe(false);
    expect(can(parentA, "attendance.view_team", { clubId: CLUB_A })).toBe(false);
    // master/club summary is system/club scoped
    expect(can(clubAdminA, "clubs.view", { clubId: CLUB_A })).toBe(true);
    expect(can(clubAdminA, "clubs.view", { clubId: CLUB_B })).toBe(false);
  });
});
