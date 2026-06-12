import { describe, expect, it } from "vitest";

import { can, type AuthContext } from "@/lib/rbac";
import { roleHasPermission } from "@/lib/rbac/permissions";
import { listMyChildRemarks } from "@/modules/remarks/service";

/**
 * Authorization boundaries for private coach remarks (one-way coach → player).
 * These exercise the pure scope rules + the "my children" listing guard, which
 * resolve BEFORE any database access — so the child-safety boundary is provable
 * without a DB (mirrors tests/roster/authz.test.ts).
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
const coachA = ctx({
  role: "COACH",
  activeClubId: CLUB_A,
  coachTeamIds: ["t1"],
  coachTeamPlayerIds: ["p-on-t1"],
});
const playerMulti = ctx({
  role: "PLAYER",
  activeClubId: CLUB_A,
  linkedPlayerIds: ["kid-1", "kid-2"],
  childTeamIds: ["t1", "t2"],
});

// ---------------------------------------------------------------------------
// 1 — Coach may manage remarks only for players on their assigned teams
// ---------------------------------------------------------------------------
describe("coach remark scope", () => {
  it("permits remarks.manage only for assigned-team players", () => {
    expect(can(coachA, "remarks.manage", { clubId: CLUB_A, playerId: "p-on-t1" })).toBe(true);
    expect(can(coachA, "remarks.manage", { clubId: CLUB_A, playerId: "p-elsewhere" })).toBe(false);
  });

  it("denies remarks.manage in another club", () => {
    expect(can(coachA, "remarks.manage", { clubId: CLUB_B, playerId: "p-on-t1" })).toBe(false);
  });

  it("does not grant a coach the player's own-child remark view", () => {
    expect(roleHasPermission("COACH", "remarks.view_own_child")).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// 2 — Player may view remarks only for their own linked children
// ---------------------------------------------------------------------------
describe("player remark scope", () => {
  it("permits remarks.view_own_child only for linked children", () => {
    expect(can(playerMulti, "remarks.view_own_child", { clubId: CLUB_A, playerId: "kid-1" })).toBe(true);
    expect(can(playerMulti, "remarks.view_own_child", { clubId: CLUB_A, playerId: "kid-2" })).toBe(true);
    expect(can(playerMulti, "remarks.view_own_child", { clubId: CLUB_A, playerId: "kid-other" })).toBe(false);
  });

  it("does not grant a player the staff manage permission", () => {
    expect(roleHasPermission("PLAYER", "remarks.manage")).toBe(false);
    expect(can(playerMulti, "remarks.manage", { clubId: CLUB_A, playerId: "kid-1" })).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// 3 — Club admin: club-wide remark management, blocked across tenants
// ---------------------------------------------------------------------------
describe("club admin remark scope", () => {
  it("manages any player in own club, none in another club", () => {
    expect(can(clubAdminA, "remarks.manage", { clubId: CLUB_A, playerId: "any" })).toBe(true);
    expect(can(clubAdminA, "remarks.manage", { clubId: CLUB_B, playerId: "any" })).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// 4 — "My children" listing is scoped purely to linkedPlayerIds (no DB hit)
// ---------------------------------------------------------------------------
describe("listMyChildRemarks own-child scoping", () => {
  it("returns empty without DB access when the caller has no linked children", async () => {
    await expect(listMyChildRemarks(coachA)).resolves.toEqual([]);
    await expect(listMyChildRemarks(clubAdminA)).resolves.toEqual([]);
  });
});
