import { describe, expect, it } from "vitest";

import { ForbiddenError, type AuthContext } from "@/lib/rbac";
import { deleteCoach, getCoachDeletionImpact } from "@/modules/coaches/service";
import { listTeamlessPlayers } from "@/modules/roster/service";

/**
 * Guard-level rejections that fire BEFORE any DB access (assertCan/assertClubScope
 * run first), so they're provable without a database — matching the established
 * authz test style. Behavioral correctness (cascades, 1→0, detach) lives in the
 * integration suite.
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

const coachA = ctx({ role: "COACH", activeClubId: CLUB_A, coachTeamIds: ["t1"] });
const playerA = ctx({ role: "PLAYER", activeClubId: CLUB_A, linkedPlayerIds: ["kid"] });
const clubAdminA = ctx({ role: "CLUB_ADMIN", activeClubId: CLUB_A });

describe("deleteCoach / getCoachDeletionImpact guards", () => {
  it("reject COACH and PLAYER before DB access", async () => {
    await expect(deleteCoach(coachA, "anyone")).rejects.toBeInstanceOf(ForbiddenError);
    await expect(deleteCoach(playerA, "anyone")).rejects.toBeInstanceOf(ForbiddenError);
    await expect(getCoachDeletionImpact(coachA, "anyone")).rejects.toBeInstanceOf(ForbiddenError);
    await expect(getCoachDeletionImpact(playerA, "anyone")).rejects.toBeInstanceOf(ForbiddenError);
  });
});

describe("listTeamlessPlayers guard", () => {
  it("rejects PLAYER (cannot enumerate the pool)", async () => {
    await expect(listTeamlessPlayers(playerA, CLUB_A)).rejects.toBeInstanceOf(ForbiddenError);
  });
  it("rejects a Club Admin reaching into another club", async () => {
    await expect(listTeamlessPlayers(clubAdminA, CLUB_B)).rejects.toBeInstanceOf(ForbiddenError);
  });
});
