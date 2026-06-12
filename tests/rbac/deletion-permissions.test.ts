import { describe, expect, it } from "vitest";

import { can, type AuthContext } from "@/lib/rbac";
import { grantedScope, roleHasPermission } from "@/lib/rbac/permissions";

/**
 * Authorization boundary for the HARD deletions (deletion-spec). The matrix is
 * the single source of truth: `player.delete` / `coach.delete` / `team.delete`
 * are CLUB_ADMIN-only and deliberately have NO MASTER_ADMIN grant, so Master has
 * no delete capability by construction. Proven purely via `can()` — no DB.
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
const masterAdmin = ctx({ role: "MASTER_ADMIN", activeClubId: null });
const coachA = ctx({ role: "COACH", activeClubId: CLUB_A, coachTeamIds: ["t1"], coachTeamPlayerIds: ["p1"] });
const playerA = ctx({ role: "PLAYER", activeClubId: CLUB_A, linkedPlayerIds: ["kid"], childTeamIds: ["t1"] });

const DELETE_PERMS = ["player.delete", "coach.delete", "team.delete"] as const;

describe("delete permissions — Club Admin only, Master excluded", () => {
  it("grants every delete to CLUB_ADMIN at CLUB scope only", () => {
    for (const perm of DELETE_PERMS) {
      expect(grantedScope("CLUB_ADMIN", perm)).toBe("CLUB");
    }
  });

  it("gives MASTER_ADMIN NO delete capability (absent from the matrix ⇒ null)", () => {
    for (const perm of DELETE_PERMS) {
      expect(grantedScope("MASTER_ADMIN", perm)).toBeNull();
      expect(can(masterAdmin, perm, { clubId: CLUB_A })).toBe(false);
    }
  });

  it("denies COACH and PLAYER every delete", () => {
    for (const perm of DELETE_PERMS) {
      expect(roleHasPermission("COACH", perm)).toBe(false);
      expect(roleHasPermission("PLAYER", perm)).toBe(false);
      expect(can(coachA, perm, { clubId: CLUB_A })).toBe(false);
      expect(can(playerA, perm, { clubId: CLUB_A })).toBe(false);
    }
  });

  it("lets a Club Admin delete only within their OWN club", () => {
    for (const perm of DELETE_PERMS) {
      expect(can(clubAdminA, perm, { clubId: CLUB_A })).toBe(true);
      expect(can(clubAdminA, perm, { clubId: CLUB_B })).toBe(false); // cross-club denied
    }
  });
});

describe("club audit log access", () => {
  it("is admins-only, club-scoped for Club Admin", () => {
    expect(grantedScope("MASTER_ADMIN", "audit.view")).toBe("SYSTEM");
    expect(grantedScope("CLUB_ADMIN", "audit.view")).toBe("CLUB");
    expect(roleHasPermission("COACH", "audit.view")).toBe(false);
    expect(roleHasPermission("PLAYER", "audit.view")).toBe(false);
  });

  it("never leaks another club's audit log to a Club Admin", () => {
    expect(can(clubAdminA, "audit.view", { clubId: CLUB_A })).toBe(true);
    expect(can(clubAdminA, "audit.view", { clubId: CLUB_B })).toBe(false);
    expect(can(coachA, "audit.view", { clubId: CLUB_A })).toBe(false);
    expect(can(playerA, "audit.view", { clubId: CLUB_A })).toBe(false);
  });
});
