import { describe, expect, it } from "vitest";

import { can, ForbiddenError, type AuthContext } from "@/lib/rbac";
import {
  createPlayer,
  listParents,
  listPlayers,
  updateOwnChild,
  updatePlayer,
} from "@/modules/roster/service";
import { parentSafePlayer, type PlayerLike } from "@/modules/roster/projections";
import { parentUpdatePlayerSchema } from "@/modules/roster/schemas";

/**
 * Phase 3 authorization boundaries (RBAC matrix §6.6–6.8). These exercise the
 * AUTHORITATIVE service-layer guards and the pure scope rules — every case here
 * rejects (or the projection strips data) BEFORE any database access, which is
 * exactly what makes the child-safety boundary provable without a DB.
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
// A parent with TWO linked children on two different teams.
const parentMulti = ctx({
  role: "PARENT",
  activeClubId: CLUB_A,
  linkedPlayerIds: ["kid-1", "kid-2"],
  childTeamIds: ["t1", "t2"],
});

// ---------------------------------------------------------------------------
// 1 — Parent cannot edit another child's profile
// ---------------------------------------------------------------------------
describe("parent cannot edit a child they aren't linked to", () => {
  it("rejects updateOwnChild for a non-linked player (before any DB access)", async () => {
    await expect(
      updateOwnChild(parentMulti, "someone-elses-kid", { preferredName: "x" } as never),
    ).rejects.toBeInstanceOf(ForbiddenError);
  });

  it("permits child scope only for the parent's own linked children", () => {
    expect(can(parentMulti, "players.edit_limited_own_child", { clubId: CLUB_A, playerId: "kid-1" })).toBe(true);
    expect(can(parentMulti, "players.edit_limited_own_child", { clubId: CLUB_A, playerId: "kid-2" })).toBe(true);
    expect(can(parentMulti, "players.edit_limited_own_child", { clubId: CLUB_A, playerId: "kid-other" })).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// 2 + 8 — Parent-safe roster strips restricted fields; photo gated by setting
// ---------------------------------------------------------------------------
describe("parent-safe roster projection", () => {
  const full: PlayerLike = {
    id: "p1",
    firstName: "Alex",
    lastName: "Rivera",
    preferredName: "Lex",
    jerseyNumber: "10",
    primaryPosition: "FWD",
    photoUrl: "https://cdn/p1.jpg",
    dateOfBirth: "2012-04-01",
    medicalNotes: "asthma",
    allergyNotes: "peanuts",
    emergencyContactName: "Sam Rivera",
    emergencyContactPhone: "+1-555-0100",
  };

  it("never includes restricted PII in the payload", () => {
    const safe = parentSafePlayer(full, { showPhotos: true });
    const serialized = JSON.stringify(safe);
    for (const secret of ["2012-04-01", "asthma", "peanuts", "Sam Rivera", "+1-555-0100"]) {
      expect(serialized).not.toContain(secret);
    }
    const asRecord = safe as unknown as Record<string, unknown>;
    for (const key of ["dateOfBirth", "medicalNotes", "allergyNotes", "emergencyContactName", "emergencyContactPhone"]) {
      expect(asRecord).not.toHaveProperty(key);
    }
  });

  it("hides photos when show_player_photos_to_parents is false", () => {
    expect(parentSafePlayer(full, { showPhotos: false }).photoUrl).toBeNull();
    expect(parentSafePlayer(full).photoUrl).toBeNull(); // default = hidden
    expect(parentSafePlayer(full, { showPhotos: true }).photoUrl).toBe("https://cdn/p1.jpg");
  });
});

// ---------------------------------------------------------------------------
// 3 — Coach cannot access roster for an unassigned team
// ---------------------------------------------------------------------------
describe("coach roster scope", () => {
  it("rejects listing an unassigned team's roster", async () => {
    await expect(listPlayers(coachA, CLUB_A, { teamId: "t-unassigned" })).rejects.toBeInstanceOf(ForbiddenError);
  });

  it("permits roster.view_full only for assigned teams", () => {
    expect(can(coachA, "roster.view_full", { clubId: CLUB_A, teamId: "t1" })).toBe(true);
    expect(can(coachA, "roster.view_full", { clubId: CLUB_A, teamId: "t-unassigned" })).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// 4 — Club Admin cannot reach another club's players / parents
// ---------------------------------------------------------------------------
describe("club admin tenant isolation", () => {
  it("rejects listing another club's players", async () => {
    await expect(listPlayers(clubAdminA, CLUB_B)).rejects.toBeInstanceOf(ForbiddenError);
  });

  it("rejects listing another club's parents", async () => {
    await expect(listParents(clubAdminA, CLUB_B)).rejects.toBeInstanceOf(ForbiddenError);
  });

  it("allows the admin's own club", () => {
    expect(can(clubAdminA, "roster.view_full", { clubId: CLUB_A })).toBe(true);
    expect(can(clubAdminA, "parents.manage", { clubId: CLUB_A })).toBe(true);
    expect(can(clubAdminA, "roster.view_full", { clubId: CLUB_B })).toBe(false);
    expect(can(clubAdminA, "parents.manage", { clubId: CLUB_B })).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// 5 — Multi-child parent: one login resolves all linked children, scoped
// ---------------------------------------------------------------------------
describe("multi-child parent scope", () => {
  it("each linked child is reachable; unrelated children are not", async () => {
    // Own children: linkage guard passes (would proceed to DB) — assert it does
    // NOT throw the scope error for a linked child.
    for (const kid of ["kid-1", "kid-2"]) {
      expect(can(parentMulti, "players.edit_limited_own_child", { clubId: CLUB_A, playerId: kid })).toBe(true);
    }
    // A child of another family is rejected at the service layer.
    await expect(
      updateOwnChild(parentMulti, "kid-of-another-family", { preferredName: "x" } as never),
    ).rejects.toBeInstanceOf(ForbiddenError);
  });
});

// ---------------------------------------------------------------------------
// 6 — Parent edit accepts whitelisted fields, rejects everything else
// ---------------------------------------------------------------------------
describe("parent edit whitelist (approved fields only)", () => {
  it("accepts the approved guardian fields", () => {
    const result = parentUpdatePlayerSchema.safeParse({
      preferredName: "Lex",
      emergencyContactName: "Sam",
      medicalNotes: "asthma",
    });
    expect(result.success).toBe(true);
  });

  it("rejects coach/admin-owned fields (jersey number, status, position)", () => {
    expect(parentUpdatePlayerSchema.safeParse({ jerseyNumber: "99" }).success).toBe(false);
    expect(parentUpdatePlayerSchema.safeParse({ status: "ARCHIVED" }).success).toBe(false);
    expect(parentUpdatePlayerSchema.safeParse({ primaryPosition: "GK" }).success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// 7 — Coach can create/edit a player only on an assigned team
// ---------------------------------------------------------------------------
describe("coach player creation scope", () => {
  it("rejects creating a player with no team placement", async () => {
    await expect(createPlayer(coachA, CLUB_A, { firstName: "A", lastName: "B" } as never)).rejects.toBeInstanceOf(
      ForbiddenError,
    );
  });

  it("rejects creating a player on an unassigned team", async () => {
    await expect(
      createPlayer(coachA, CLUB_A, { firstName: "A", lastName: "B", initialTeamId: "t-unassigned" } as never),
    ).rejects.toBeInstanceOf(ForbiddenError);
  });

  it("permits players.create / edit_full only within assigned-team scope", () => {
    expect(can(coachA, "players.create", { clubId: CLUB_A, teamId: "t1" })).toBe(true);
    expect(can(coachA, "players.create", { clubId: CLUB_A, teamId: "t-unassigned" })).toBe(false);
    expect(can(coachA, "players.edit_full", { clubId: CLUB_A, playerId: "p-on-t1" })).toBe(true);
    expect(can(coachA, "players.edit_full", { clubId: CLUB_A, playerId: "p-elsewhere" })).toBe(false);
  });
});

// updatePlayer is referenced so a future DB-backed test has the import wired;
// here we assert the pure permission rule it relies on for a Club Admin.
describe("club admin can edit any player in own club", () => {
  it("grants players.edit_full at club scope", () => {
    expect(can(clubAdminA, "players.edit_full", { clubId: CLUB_A, playerId: "any" })).toBe(true);
    expect(typeof updatePlayer).toBe("function");
  });
});
