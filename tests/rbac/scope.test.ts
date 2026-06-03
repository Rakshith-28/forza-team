import { describe, expect, it } from "vitest";

import {
  assertChildScope,
  assertClubScope,
  assertTeamScope,
  can,
  ForbiddenError,
  type AuthContext,
} from "@/lib/rbac/scope";

// --- Fixtures: two clubs to prove tenant isolation -------------------------
const CLUB_A = "club-a";
const CLUB_B = "club-b";
const TEAM_A1 = "team-a1";
const TEAM_A2 = "team-a2";
const PLAYER_A1 = "player-a1"; // on TEAM_A1
const PLAYER_A2 = "player-a2"; // on TEAM_A2

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

const masterAdmin = ctx({ role: "MASTER_ADMIN", activeClubId: null });
const clubAdminA = ctx({ role: "CLUB_ADMIN", activeClubId: CLUB_A });
const coachA1 = ctx({
  role: "COACH",
  activeClubId: CLUB_A,
  coachTeamIds: [TEAM_A1],
  coachTeamPlayerIds: [PLAYER_A1],
});
const parentOfA1 = ctx({
  role: "PARENT",
  activeClubId: CLUB_A,
  linkedPlayerIds: [PLAYER_A1],
  childTeamIds: [TEAM_A1],
});

describe("assertClubScope — tenant isolation", () => {
  it("allows a club admin within their own club", () => {
    expect(() => assertClubScope(clubAdminA, CLUB_A)).not.toThrow();
  });

  // Matrix §13.4 — the cross-tenant exit-criteria test.
  it("BLOCKS a club admin from another club (cross-tenant)", () => {
    expect(() => assertClubScope(clubAdminA, CLUB_B)).toThrow(ForbiddenError);
  });

  it("lets a master admin cross tenants", () => {
    expect(() => assertClubScope(masterAdmin, CLUB_A)).not.toThrow();
    expect(() => assertClubScope(masterAdmin, CLUB_B)).not.toThrow();
  });
});

describe("assertTeamScope — coach team boundary", () => {
  it("allows a coach on their assigned team", () => {
    expect(() => assertTeamScope(coachA1, { clubId: CLUB_A, teamId: TEAM_A1 })).not.toThrow();
  });

  // Matrix §13.3
  it("BLOCKS a coach on an unassigned team", () => {
    expect(() => assertTeamScope(coachA1, { clubId: CLUB_A, teamId: TEAM_A2 })).toThrow(
      ForbiddenError,
    );
  });

  it("gives a club admin club-wide team authority", () => {
    expect(() => assertTeamScope(clubAdminA, { clubId: CLUB_A, teamId: TEAM_A2 })).not.toThrow();
  });

  it("BLOCKS team access across tenants even for the right team id shape", () => {
    expect(() => assertTeamScope(coachA1, { clubId: CLUB_B, teamId: TEAM_A1 })).toThrow(
      ForbiddenError,
    );
  });
});

describe("assertChildScope — parent/coach child boundary", () => {
  it("allows a parent to reach their linked child", () => {
    expect(() => assertChildScope(parentOfA1, { clubId: CLUB_A, playerId: PLAYER_A1 })).not.toThrow();
  });

  // Matrix §13.1 — parent cannot reach another child.
  it("BLOCKS a parent from another family's child", () => {
    expect(() => assertChildScope(parentOfA1, { clubId: CLUB_A, playerId: PLAYER_A2 })).toThrow(
      ForbiddenError,
    );
  });

  // Matrix §13.6 — coach reaches only assigned-team players.
  it("allows a coach to reach a player on their team but not others", () => {
    expect(() => assertChildScope(coachA1, { clubId: CLUB_A, playerId: PLAYER_A1 })).not.toThrow();
    expect(() => assertChildScope(coachA1, { clubId: CLUB_A, playerId: PLAYER_A2 })).toThrow(
      ForbiddenError,
    );
  });
});

describe("can() — matrix permission + scope combined", () => {
  // Matrix §13.7 — parent cannot access radar/team evaluations.
  it("denies a parent the team evaluation/radar view", () => {
    expect(can(parentOfA1, "evaluations.view_team", { clubId: CLUB_A, teamId: TEAM_A1 })).toBe(false);
  });

  it("allows a coach the team evaluation view for their team only", () => {
    expect(can(coachA1, "evaluations.view_team", { clubId: CLUB_A, teamId: TEAM_A1 })).toBe(true);
    expect(can(coachA1, "evaluations.view_team", { clubId: CLUB_A, teamId: TEAM_A2 })).toBe(false);
  });

  // Matrix §13.9 — coach has no billing access.
  it("denies a coach billing management", () => {
    expect(can(coachA1, "billing.manage", { clubId: CLUB_A })).toBe(false);
  });

  // Matrix §13.5 — parent only sees own family billing, and not cross-tenant.
  it("scopes parent billing to their own family/club", () => {
    expect(can(parentOfA1, "billing.view_own_family", { clubId: CLUB_A })).toBe(true);
    expect(can(parentOfA1, "billing.view_own_family", { clubId: CLUB_B })).toBe(false);
  });

  // Matrix §13.6 — coach can score players on assigned teams only.
  it("lets a coach score evaluations only for assigned-team players", () => {
    expect(can(coachA1, "evaluations.score_players", { clubId: CLUB_A, playerId: PLAYER_A1 })).toBe(true);
    expect(can(coachA1, "evaluations.score_players", { clubId: CLUB_A, playerId: PLAYER_A2 })).toBe(false);
  });

  it("gives a master admin system-wide reach", () => {
    expect(can(masterAdmin, "clubs.manage", { clubId: CLUB_B })).toBe(true);
    expect(can(masterAdmin, "audit.view", { clubId: CLUB_A })).toBe(true);
  });

  // Matrix §13.10 — parent RSVP only for linked child.
  it("lets a parent RSVP for their own child only", () => {
    expect(can(parentOfA1, "rsvp.respond_own_child", { clubId: CLUB_A, playerId: PLAYER_A1 })).toBe(true);
    expect(can(parentOfA1, "rsvp.respond_own_child", { clubId: CLUB_A, playerId: PLAYER_A2 })).toBe(false);
  });
});
