import { describe, expect, it } from "vitest";

import { can, ForbiddenError, type AuthContext } from "@/lib/rbac";
import { archiveClub, createClub } from "@/modules/clubs/service";

// Two clubs to prove tenant isolation for the Phase 2 features.
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

const master = ctx({ role: "MASTER_ADMIN", activeClubId: null });
const clubAdminA = ctx({ role: "CLUB_ADMIN", activeClubId: CLUB_A });
const coachA = ctx({ role: "COACH", activeClubId: CLUB_A, coachTeamIds: ["t1"] });
const parentA = ctx({ role: "PARENT", activeClubId: CLUB_A, linkedPlayerIds: ["p1"] });

describe("Phase 2 — tenant isolation (Club Admin cannot reach another club)", () => {
  for (const perm of ["clubs.manage", "seasons.manage", "teams.manage"] as const) {
    it(`${perm}: own club allowed, other club blocked`, () => {
      expect(can(clubAdminA, perm, { clubId: CLUB_A })).toBe(true);
      expect(can(clubAdminA, perm, { clubId: CLUB_B })).toBe(false);
    });
  }

  for (const perm of ["clubs.view", "seasons.view", "teams.view"] as const) {
    it(`${perm}: own club allowed, other club blocked`, () => {
      expect(can(clubAdminA, perm, { clubId: CLUB_A })).toBe(true);
      expect(can(clubAdminA, perm, { clubId: CLUB_B })).toBe(false);
    });
  }

  it("a Master Admin reaches any club (system scope)", () => {
    expect(can(master, "clubs.manage", { clubId: CLUB_B })).toBe(true);
    expect(can(master, "seasons.manage", { clubId: CLUB_B })).toBe(true);
    expect(can(master, "teams.manage", { clubId: CLUB_B })).toBe(true);
  });
});

describe("Phase 2 — role boundaries for create / edit / archive", () => {
  it("coaches cannot manage clubs, seasons, or teams", () => {
    expect(can(coachA, "clubs.manage", { clubId: CLUB_A })).toBe(false);
    expect(can(coachA, "seasons.manage", { clubId: CLUB_A })).toBe(false);
    expect(can(coachA, "teams.manage", { clubId: CLUB_A })).toBe(false);
  });

  it("parents cannot manage clubs, seasons, or teams", () => {
    expect(can(parentA, "clubs.manage", { clubId: CLUB_A })).toBe(false);
    expect(can(parentA, "seasons.manage", { clubId: CLUB_A })).toBe(false);
    expect(can(parentA, "teams.manage", { clubId: CLUB_A })).toBe(false);
  });

  it("coaches may VIEW their assigned teams but not club-wide manage", () => {
    expect(can(coachA, "teams.view", { clubId: CLUB_A, teamId: "t1" })).toBe(true);
    expect(can(coachA, "teams.view", { clubId: CLUB_A, teamId: "t2" })).toBe(false);
  });
});

describe("Phase 2 — club create/archive are Master-only (service boundary)", () => {
  // assertMasterAdmin runs before any DB access, so these reject without a DB.
  it("rejects club creation for a Club Admin", async () => {
    await expect(createClub(clubAdminA, { name: "X", shortCode: "X" })).rejects.toBeInstanceOf(
      ForbiddenError,
    );
  });

  it("rejects club archive for a Club Admin", async () => {
    await expect(archiveClub(clubAdminA, CLUB_A)).rejects.toBeInstanceOf(ForbiddenError);
  });

  it("rejects club creation for a Coach", async () => {
    await expect(createClub(coachA, { name: "X", shortCode: "X" })).rejects.toBeInstanceOf(
      ForbiddenError,
    );
  });
});
