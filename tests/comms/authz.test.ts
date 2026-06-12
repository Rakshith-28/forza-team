import { describe, expect, it } from "vitest";

import { can, ForbiddenError, type AuthContext } from "@/lib/rbac";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { canViewAnnouncement, createAnnouncement, listAnnouncements } from "@/modules/comms/service";

/**
 * Phase 4 authorization boundaries for announcements + team chat (RBAC matrix
 * §6.10–6.11). Pure scope rules and service guards that reject BEFORE any DB
 * access — provable without a database, matching the Phase 1–3 pattern.
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
const coachA = ctx({ role: "COACH", activeClubId: CLUB_A, coachTeamIds: ["t1"], childTeamIds: [] });
const playerA = ctx({ role: "PLAYER", activeClubId: CLUB_A, linkedPlayerIds: ["kid"], childTeamIds: ["t2"] });

// ---------------------------------------------------------------------------
// 1 — Player cannot create/edit/publish/archive announcements
// ---------------------------------------------------------------------------
describe("players cannot manage announcements", () => {
  it("rejects create for any audience", async () => {
    await expect(
      createAnnouncement(playerA, CLUB_A, { title: "Hi", body: "x", audienceType: "CLUB_ALL", teamId: null }),
    ).rejects.toBeInstanceOf(ForbiddenError);
    await expect(
      createAnnouncement(playerA, CLUB_A, { title: "Hi", body: "x", audienceType: "TEAM_ONLY", teamId: "t2" }),
    ).rejects.toBeInstanceOf(ForbiddenError);
  });

  it("holds no publish permission", () => {
    expect(can(playerA, "announcements.publish_club", { clubId: CLUB_A })).toBe(false);
    expect(can(playerA, "announcements.publish_team", { clubId: CLUB_A, teamId: "t2" })).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// 2 — Player feed excludes COACHES_ONLY + drafts; includes own-child/player/club
// ---------------------------------------------------------------------------
describe("player announcement visibility", () => {
  const draft = { status: "DRAFT", audienceType: "CLUB_ALL", teamId: null, createdBy: "someone" };
  it("excludes COACHES_ONLY and all drafts", () => {
    expect(canViewAnnouncement(playerA, { status: "PUBLISHED", audienceType: "COACHES_ONLY", teamId: null, createdBy: "x" })).toBe(false);
    expect(canViewAnnouncement(playerA, draft)).toBe(false);
  });
  it("includes club-wide, players-only, and own-child team announcements", () => {
    expect(canViewAnnouncement(playerA, { status: "PUBLISHED", audienceType: "CLUB_ALL", teamId: null, createdBy: "x" })).toBe(true);
    expect(canViewAnnouncement(playerA, { status: "PUBLISHED", audienceType: "PLAYERS_ONLY", teamId: null, createdBy: "x" })).toBe(true);
    expect(canViewAnnouncement(playerA, { status: "PUBLISHED", audienceType: "TEAM_ONLY", teamId: "t2", createdBy: "x" })).toBe(true);
    expect(canViewAnnouncement(playerA, { status: "PUBLISHED", audienceType: "TEAM_ONLY", teamId: "t-other", createdBy: "x" })).toBe(false);
  });
  it("coach sees coach/club + assigned team, and others' drafts are hidden", () => {
    expect(canViewAnnouncement(coachA, { status: "PUBLISHED", audienceType: "COACHES_ONLY", teamId: null, createdBy: "x" })).toBe(true);
    expect(canViewAnnouncement(coachA, { status: "PUBLISHED", audienceType: "TEAM_ONLY", teamId: "t1", createdBy: "x" })).toBe(true);
    expect(canViewAnnouncement(coachA, { status: "PUBLISHED", audienceType: "TEAM_ONLY", teamId: "t9", createdBy: "x" })).toBe(false);
    expect(canViewAnnouncement(coachA, { status: "DRAFT", audienceType: "CLUB_ALL", teamId: null, createdBy: "other" })).toBe(false);
    expect(canViewAnnouncement(coachA, { status: "DRAFT", audienceType: "CLUB_ALL", teamId: null, createdBy: "u" })).toBe(true);
  });
  it("admins see everything in their club, drafts included", () => {
    expect(canViewAnnouncement(clubAdminA, { status: "DRAFT", audienceType: "TEAM_ONLY", teamId: "t1", createdBy: "x" })).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// 3 — Coach can publish only for an assigned team
// ---------------------------------------------------------------------------
describe("coach announcement scope", () => {
  it("rejects creating a team announcement for an unassigned team", async () => {
    await expect(
      createAnnouncement(coachA, CLUB_A, { title: "X", body: "y", audienceType: "TEAM_ONLY", teamId: "t-unassigned" }),
    ).rejects.toBeInstanceOf(ForbiddenError);
  });
  it("rejects club-wide announcements (admin-only)", async () => {
    await expect(
      createAnnouncement(coachA, CLUB_A, { title: "X", body: "y", audienceType: "CLUB_ALL", teamId: null }),
    ).rejects.toBeInstanceOf(ForbiddenError);
  });
  it("permits publish_team only for assigned teams", () => {
    expect(can(coachA, "announcements.publish_team", { clubId: CLUB_A, teamId: "t1" })).toBe(true);
    expect(can(coachA, "announcements.publish_team", { clubId: CLUB_A, teamId: "t-unassigned" })).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// 4 + 5 — Team chat scope (coach assigned; player linked-child team only)
// ---------------------------------------------------------------------------
describe("team chat scope", () => {
  it("coach: read/post only for assigned teams", () => {
    expect(can(coachA, "chat.view_team", { clubId: CLUB_A, teamId: "t1" })).toBe(true);
    expect(can(coachA, "chat.send_team", { clubId: CLUB_A, teamId: "t1" })).toBe(true);
    expect(can(coachA, "chat.view_team", { clubId: CLUB_A, teamId: "t-unassigned" })).toBe(false);
    expect(can(coachA, "chat.send_team", { clubId: CLUB_A, teamId: "t-unassigned" })).toBe(false);
  });
  it("player: read/post only in a linked child's team", () => {
    expect(can(playerA, "chat.view_team", { clubId: CLUB_A, teamId: "t2" })).toBe(true);
    expect(can(playerA, "chat.send_team", { clubId: CLUB_A, teamId: "t2" })).toBe(true);
    expect(can(playerA, "chat.view_team", { clubId: CLUB_A, teamId: "t-other" })).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// 6 — No DM / player-to-player path exists
// ---------------------------------------------------------------------------
describe("no direct-message surface", () => {
  it("the permission catalog has no DM/direct/player-to-player permission", () => {
    const keys = Object.keys(PERMISSIONS);
    expect(keys.some((k) => /\bdm\b|direct|player_to_player|p2p/i.test(k))).toBe(false);
  });
  it("chat is team-scoped for every role (players only via CHILD scope)", () => {
    expect(PERMISSIONS["chat.send_team"].PLAYER).toBe("CHILD");
    expect(PERMISSIONS["chat.send_team"].COACH).toBe("TEAM");
  });
});

// ---------------------------------------------------------------------------
// 7 — Cross-club isolation for announcements
// ---------------------------------------------------------------------------
describe("announcement cross-club isolation", () => {
  it("rejects listing another club's announcements", async () => {
    await expect(listAnnouncements(coachA, CLUB_B)).rejects.toBeInstanceOf(ForbiddenError);
    await expect(listAnnouncements(playerA, CLUB_B)).rejects.toBeInstanceOf(ForbiddenError);
    await expect(listAnnouncements(clubAdminA, CLUB_B)).rejects.toBeInstanceOf(ForbiddenError);
  });
});
