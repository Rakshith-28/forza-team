import { describe, expect, it } from "vitest";

import { can, type AuthContext } from "@/lib/rbac";
import { inviteParentForPlayerSchema } from "@/modules/roster/schemas";

/**
 * Coach-side player & parent onboarding — guard-level RBAC + validation
 * (RBAC matrix §6.6–6.7). The coach guardian path is additionally gated by the
 * `allow_coach_invite_parents` club setting (DB-backed) and exercised in
 * tests-integration/coach-onboarding.integration.test.ts.
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
const parentA = ctx({ role: "PARENT", activeClubId: CLUB_A, linkedPlayerIds: ["kid"], childTeamIds: ["t1"] });

describe("coach add-player permission", () => {
  it("coach can create a player on an assigned team; not on an unassigned team", () => {
    expect(can(coachA, "players.create", { clubId: CLUB_A, teamId: "t1" })).toBe(true);
    expect(can(coachA, "players.create", { clubId: CLUB_A, teamId: "t-other" })).toBe(false);
    expect(can(coachA, "players.create", { clubId: CLUB_B, teamId: "t1" })).toBe(false);
  });
  it("admin can create club-wide; parent never", () => {
    expect(can(clubAdminA, "players.create", { clubId: CLUB_A })).toBe(true);
    expect(can(parentA, "players.create", { clubId: CLUB_A, teamId: "t1" })).toBe(false);
  });
});

describe("guardian-management base permissions", () => {
  it("admins hold parents.manage; coaches and parents do not", () => {
    expect(can(clubAdminA, "parents.manage", { clubId: CLUB_A })).toBe(true);
    expect(can(coachA, "parents.manage", { clubId: CLUB_A })).toBe(false);
    expect(can(parentA, "parents.manage", { clubId: CLUB_A })).toBe(false);
  });
});

describe("inviteParentForPlayer validation", () => {
  const playerId = "11111111-1111-4111-8111-111111111111";
  it("accepts email + player + relationship (no name fields)", () => {
    const r = inviteParentForPlayerSchema.safeParse({
      email: "Parent@Example.com",
      playerId,
      relationshipType: "MOTHER",
      canPickup: true,
    });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.email).toBe("parent@example.com");
  });
  it("rejects a bad email", () => {
    expect(inviteParentForPlayerSchema.safeParse({ email: "nope", playerId, relationshipType: "MOTHER" }).success).toBe(false);
  });
  it("rejects an unknown relationship type", () => {
    expect(inviteParentForPlayerSchema.safeParse({ email: "a@b.com", playerId, relationshipType: "UNCLE" }).success).toBe(false);
  });
  it("rejects a missing player id", () => {
    expect(inviteParentForPlayerSchema.safeParse({ email: "a@b.com", relationshipType: "MOTHER" }).success).toBe(false);
  });
});
