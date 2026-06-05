import { describe, expect, it } from "vitest";

import { ForbiddenError, can, type AuthContext } from "@/lib/rbac";
import { getRadarComparison } from "@/modules/evaluations/comparison-service";
import { listDevelopmentGoals, listGoalPlayerOptions } from "@/modules/evaluations/development-service";
import { addGoalUpdateSchema, createGoalSchema } from "@/modules/evaluations/development-schemas";

/**
 * Development goals + radar comparison authorization. The read entry points
 * assert `evaluations.view_team` first (before any DB access), so a PARENT is
 * provably rejected without a database.
 */

function ctx(role: AuthContext["role"], overrides: Partial<AuthContext> = {}): AuthContext {
  return {
    userId: "u",
    role,
    activeClubId: "club-a",
    coachTeamIds: ["t1"],
    coachTeamPlayerIds: ["p1"],
    linkedPlayerIds: ["kid"],
    childTeamIds: ["t1"],
    ...overrides,
  };
}

const parent = ctx("PARENT");

describe("development reads reject parents before DB", () => {
  it("listDevelopmentGoals / listGoalPlayerOptions / getRadarComparison", async () => {
    await expect(listDevelopmentGoals(parent, "club-a")).rejects.toBeInstanceOf(ForbiddenError);
    await expect(listGoalPlayerOptions(parent, "club-a")).rejects.toBeInstanceOf(ForbiddenError);
    await expect(getRadarComparison(parent, "club-a", ["p1"])).rejects.toBeInstanceOf(ForbiddenError);
  });
});

describe("evaluation permissions", () => {
  it("coach has team-scoped view/score; parent does not", () => {
    const coach = ctx("COACH");
    expect(can(coach, "evaluations.view_team", { clubId: "club-a" })).toBe(true);
    expect(can(coach, "evaluations.score_players", { clubId: "club-a", teamId: "t1", playerId: "p1" })).toBe(true);
    expect(can(parent, "evaluations.view_team", { clubId: "club-a" })).toBe(false);
    expect(can(parent, "evaluations.score_players", { clubId: "club-a", teamId: "t1", playerId: "p1" })).toBe(false);
  });
});

describe("development goal validation", () => {
  it("requires a player and title", () => {
    expect(createGoalSchema.safeParse({ playerId: "", title: "x", visibility: "COACH_ONLY" }).success).toBe(false);
    expect(
      createGoalSchema.safeParse({ playerId: "11111111-1111-4111-8111-111111111111", title: "", visibility: "COACH_ONLY" }).success,
    ).toBe(false);
    expect(
      createGoalSchema.safeParse({ playerId: "11111111-1111-4111-8111-111111111111", title: "Pass better", visibility: "COACH_ONLY" })
        .success,
    ).toBe(true);
  });
  it("update requires a valid progress status", () => {
    expect(addGoalUpdateSchema.safeParse({ progressStatus: "NOPE" }).success).toBe(false);
    expect(addGoalUpdateSchema.safeParse({ progressStatus: "ACHIEVED", notes: "great" }).success).toBe(true);
  });
});
