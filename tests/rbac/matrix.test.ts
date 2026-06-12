import { describe, expect, it } from "vitest";

import { can, roleHasPermission, type AuthContext, type Permission } from "@/lib/rbac";
import { playerSafePlayer, type PlayerLike } from "@/modules/roster/projections";

/**
 * RBAC / privacy regression pack — the allow/deny truth table from
 * soccer_club_rbac_matrix.md, asserted at the permission/scope layer that the
 * service layer enforces (not UI). Covers cross-tenant isolation, coach team
 * scope, player child scope, management denial for players, and the player-safe
 * projection. (DB-gated settings behavior is exercised in the integration suite.)
 */

const A = "club-a";
const B = "club-b";

function ctx(o: Partial<AuthContext>): AuthContext {
  return {
    userId: "u",
    role: "CLUB_ADMIN",
    activeClubId: A,
    coachTeamIds: [],
    coachTeamPlayerIds: [],
    linkedPlayerIds: [],
    childTeamIds: [],
    ...o,
  };
}

const master = ctx({ role: "MASTER_ADMIN", activeClubId: null });
const clubAdminA = ctx({ role: "CLUB_ADMIN", activeClubId: A });
const coachA = ctx({ role: "COACH", activeClubId: A, coachTeamIds: ["t1"], coachTeamPlayerIds: ["p1"] });
const playerA = ctx({ role: "PLAYER", activeClubId: A, linkedPlayerIds: ["kid1"], childTeamIds: ["t1"] });

const WRITE_PERMS: Permission[] = [
  "clubs.manage",
  "seasons.manage",
  "teams.manage",
  "players.create",
  "players.edit_full",
  "playerAccounts.manage",
  "events.manage",
  "attendance.record",
  "announcements.publish_club",
  "announcements.publish_team",
  "evaluations.manage_templates",
  "evaluations.score_players",
  "documents.manage_club",
  "documents.manage_team",
];

const VIEW_PERMS: Permission[] = [
  "clubs.view",
  "seasons.view",
  "teams.view",
  "roster.view_full",
  "events.view",
  "announcements.view",
  "chat.view_team",
  "documents.view",
  "evaluations.view_team",
  "attendance.view_team",
];

// ---------------------------------------------------------------------------
// Cross-tenant isolation: a club-A actor can never touch club B.
// ---------------------------------------------------------------------------
describe("cross-tenant isolation", () => {
  const target = { clubId: B, teamId: "t1", playerId: "p1" };
  for (const actor of [{ name: "Club Manager", c: clubAdminA }, { name: "Coach", c: coachA }, { name: "Player", c: playerA }]) {
    it(`${actor.name}: denied every write in club B`, () => {
      for (const perm of WRITE_PERMS) expect(can(actor.c, perm, target)).toBe(false);
    });
    it(`${actor.name}: denied every view in club B`, () => {
      for (const perm of VIEW_PERMS) expect(can(actor.c, perm, { clubId: B })).toBe(false);
    });
  }

  it("Master Admin (system scope) reaches club B for granted permissions", () => {
    for (const perm of [...WRITE_PERMS, ...VIEW_PERMS]) {
      if (roleHasPermission("MASTER_ADMIN", perm)) {
        expect(can(master, perm, target)).toBe(true);
      }
    }
  });
});

// ---------------------------------------------------------------------------
// Coach scope: assigned teams only.
// ---------------------------------------------------------------------------
describe("coach team scope", () => {
  it("acts on assigned team t1, denied on unassigned t2", () => {
    for (const perm of ["teams.view", "events.manage", "attendance.record", "announcements.publish_team", "evaluations.score_players", "chat.send_team"] as Permission[]) {
      expect(can(coachA, perm, { clubId: A, teamId: "t1" })).toBe(true);
      expect(can(coachA, perm, { clubId: A, teamId: "t2" })).toBe(false);
    }
  });
  it("edits only assigned-team players", () => {
    expect(can(coachA, "players.edit_full", { clubId: A, playerId: "p1" })).toBe(true);
    expect(can(coachA, "players.edit_full", { clubId: A, playerId: "pX" })).toBe(false);
  });
  it("cannot manage club-wide config", () => {
    for (const perm of ["clubs.manage", "seasons.manage", "teams.manage", "playerAccounts.manage", "evaluations.manage_templates", "documents.manage_club"] as Permission[]) {
      expect(can(coachA, perm, { clubId: A })).toBe(false);
    }
  });
});

// ---------------------------------------------------------------------------
// Player scope: own child only; no management.
// ---------------------------------------------------------------------------
describe("player scope", () => {
  it("holds no management/staff permissions", () => {
    for (const perm of [...WRITE_PERMS, "roster.view_full", "attendance.view_team", "evaluations.view_team"] as Permission[]) {
      expect(can(playerA, perm, { clubId: A, teamId: "t1", playerId: "kid1" })).toBe(false);
    }
  });
  it("edits/RSVPs/views only their own linked child", () => {
    for (const perm of ["players.edit_limited_own_child", "rsvp.respond_own_child", "attendance.view_own_child", "evaluations.view_own_child_summary"] as Permission[]) {
      expect(can(playerA, perm, { clubId: A, playerId: "kid1" })).toBe(true);
      expect(can(playerA, perm, { clubId: A, playerId: "other-kid" })).toBe(false);
    }
  });
  it("may post in their linked child's team chat only", () => {
    expect(can(playerA, "chat.send_team", { clubId: A, teamId: "t1" })).toBe(true);
    expect(can(playerA, "chat.send_team", { clubId: A, teamId: "t9" })).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Player-safe roster projection — restricted PII never leaves the server.
// ---------------------------------------------------------------------------
describe("player-safe roster projection", () => {
  const full: PlayerLike = {
    id: "p1",
    firstName: "Alex",
    lastName: "Rivera",
    preferredName: "Lex",
    jerseyNumber: "10",
    primaryPosition: "FWD",
    photoUrl: "/api/files/abc",
    dateOfBirth: "2012-04-01",
    medicalNotes: "asthma",
    allergyNotes: "peanuts",
    emergencyContactName: "Sam Rivera",
    emergencyContactPhone: "+1-555-0100",
  };

  it("exposes only the safe fields", () => {
    const safe = playerSafePlayer(full, { showPhotos: true });
    expect(Object.keys(safe).sort()).toEqual(
      ["displayName", "id", "jerseyNumber", "photoUrl", "preferredName", "primaryPosition"].sort(),
    );
  });

  it("never leaks DOB / medical / allergy / emergency contact", () => {
    const serialized = JSON.stringify(playerSafePlayer(full, { showPhotos: true }));
    for (const secret of ["2012-04-01", "asthma", "peanuts", "Sam Rivera", "+1-555-0100"]) {
      expect(serialized).not.toContain(secret);
    }
  });

  it("gates the photo behind show_player_photos_to_players (default hidden)", () => {
    expect(playerSafePlayer(full).photoUrl).toBeNull();
    expect(playerSafePlayer(full, { showPhotos: false }).photoUrl).toBeNull();
    expect(playerSafePlayer(full, { showPhotos: true }).photoUrl).toBe("/api/files/abc");
  });
});
