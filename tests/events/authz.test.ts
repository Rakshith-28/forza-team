import { describe, expect, it } from "vitest";

import { can, ForbiddenError, type AuthContext } from "@/lib/rbac";
import {
  createEvent,
  listEvents,
  listPlayerSchedule,
} from "@/modules/events/service";
import { createEventSchema } from "@/modules/events/schemas";

/**
 * Phase 5 authorization + behavior for events, RSVP, and attendance (RBAC matrix
 * §6.12–6.14). Pure scope rules + service guards that reject BEFORE any DB
 * access, plus schema validation — provable without a database.
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
const playerA = ctx({
  role: "PLAYER",
  activeClubId: CLUB_A,
  linkedPlayerIds: ["kid-1", "kid-2"],
  childTeamIds: ["t2", "t3"],
});

const validTimes = { startAt: "2026-07-01T18:00", endAt: "2026-07-01T19:30" };

// ---------------------------------------------------------------------------
// 1 — Event CRUD scope: coach cannot manage an unassigned team / club-wide
// ---------------------------------------------------------------------------
describe("event management scope", () => {
  it("rejects coach creating an event for an unassigned team", async () => {
    await expect(
      createEvent(coachA, CLUB_A, { title: "P", eventType: "PRACTICE", teamId: "t-unassigned", ...times() } as never),
    ).rejects.toBeInstanceOf(ForbiddenError);
  });
  it("rejects coach creating a club-wide event (admin-only)", async () => {
    await expect(
      createEvent(coachA, CLUB_A, { title: "P", eventType: "CLUB_EVENT", teamId: null, ...times() } as never),
    ).rejects.toBeInstanceOf(ForbiddenError);
  });
  it("permits events.manage only within scope", () => {
    expect(can(coachA, "events.manage", { clubId: CLUB_A, teamId: "t1" })).toBe(true);
    expect(can(coachA, "events.manage", { clubId: CLUB_A, teamId: "t-unassigned" })).toBe(false);
    expect(can(clubAdminA, "events.manage", { clubId: CLUB_A })).toBe(true);
    expect(can(playerA, "events.manage", { clubId: CLUB_A, teamId: "t2" })).toBe(false);
  });
});

function times() {
  return { startAt: new Date(validTimes.startAt), endAt: new Date(validTimes.endAt) };
}

// ---------------------------------------------------------------------------
// 2 — Player RSVP only for a linked child
// ---------------------------------------------------------------------------
describe("RSVP scope", () => {
  it("player may RSVP only for linked children", () => {
    expect(can(playerA, "rsvp.respond_own_child", { clubId: CLUB_A, playerId: "kid-1" })).toBe(true);
    expect(can(playerA, "rsvp.respond_own_child", { clubId: CLUB_A, playerId: "kid-2" })).toBe(true);
    expect(can(playerA, "rsvp.respond_own_child", { clubId: CLUB_A, playerId: "other" })).toBe(false);
  });
  it("coach/admin may override RSVP within scope", () => {
    expect(can(coachA, "rsvp.respond_own_child", { clubId: CLUB_A, playerId: "p1" })).toBe(true);
    expect(can(coachA, "rsvp.respond_own_child", { clubId: CLUB_A, playerId: "p-elsewhere" })).toBe(false);
    expect(can(clubAdminA, "rsvp.respond_own_child", { clubId: CLUB_A, playerId: "anyone" })).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// 3 + 4 — Attendance: player never; coach assigned-team only
// ---------------------------------------------------------------------------
describe("attendance recording scope", () => {
  it("players cannot record attendance", () => {
    expect(can(playerA, "attendance.record", { clubId: CLUB_A, teamId: "t2" })).toBe(false);
  });
  it("coach can record for assigned team only", () => {
    expect(can(coachA, "attendance.record", { clubId: CLUB_A, teamId: "t1" })).toBe(true);
    expect(can(coachA, "attendance.record", { clubId: CLUB_A, teamId: "t-unassigned" })).toBe(false);
  });
  it("admin can record club-wide", () => {
    expect(can(clubAdminA, "attendance.record", { clubId: CLUB_A, teamId: "any" })).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// 5 — Multi-child player schedule (guard + empty); aggregation is DB-backed
// ---------------------------------------------------------------------------
describe("player schedule aggregation guards", () => {
  it("is player-only", async () => {
    await expect(listPlayerSchedule(coachA)).rejects.toBeInstanceOf(ForbiddenError);
  });
  it("returns empty with no linked children (no DB access)", async () => {
    const noKids = ctx({ role: "PLAYER", activeClubId: CLUB_A, linkedPlayerIds: [], childTeamIds: [] });
    await expect(listPlayerSchedule(noKids)).resolves.toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// 6 — Cross-club isolation
// ---------------------------------------------------------------------------
describe("cross-club isolation", () => {
  it("rejects listing another club's events", async () => {
    await expect(listEvents(coachA, CLUB_B)).rejects.toBeInstanceOf(ForbiddenError);
    await expect(listEvents(playerA, CLUB_B)).rejects.toBeInstanceOf(ForbiddenError);
    await expect(listEvents(clubAdminA, CLUB_B)).rejects.toBeInstanceOf(ForbiddenError);
  });
  it("denies RSVP/attendance permissions in another club", () => {
    expect(can(coachA, "events.manage", { clubId: CLUB_B, teamId: "t1" })).toBe(false);
    expect(can(playerA, "rsvp.respond_own_child", { clubId: CLUB_B, playerId: "kid-1" })).toBe(false);
    expect(can(coachA, "attendance.record", { clubId: CLUB_B, teamId: "t1" })).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// 8 — end_at < start_at rejected
// ---------------------------------------------------------------------------
describe("event time validation", () => {
  it("rejects end before start", () => {
    const r = createEventSchema.safeParse({
      title: "Bad",
      eventType: "PRACTICE",
      teamId: null,
      startAt: "2026-07-01T19:00",
      endAt: "2026-07-01T18:00",
    });
    expect(r.success).toBe(false);
  });
  it("accepts end on/after start", () => {
    const r = createEventSchema.safeParse({
      title: "Good",
      eventType: "PRACTICE",
      teamId: null,
      startAt: "2026-07-01T18:00",
      endAt: "2026-07-01T19:30",
    });
    expect(r.success).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// 9 — Player attendance view: own child only
// ---------------------------------------------------------------------------
describe("attendance view scope", () => {
  it("player may view own child's attendance only", () => {
    expect(can(playerA, "attendance.view_own_child", { clubId: CLUB_A, playerId: "kid-1" })).toBe(true);
    expect(can(playerA, "attendance.view_own_child", { clubId: CLUB_A, playerId: "other" })).toBe(false);
  });
  it("player cannot use the team attendance view", () => {
    expect(can(playerA, "attendance.view_team", { clubId: CLUB_A, teamId: "t2" })).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// 10 — Team-document view scope reuses teams.view (FK migration regression)
// ---------------------------------------------------------------------------
describe("team-document visibility scope", () => {
  it("coach sees assigned-team docs; player sees child-team docs", () => {
    expect(can(coachA, "teams.view", { clubId: CLUB_A, teamId: "t1" })).toBe(true);
    expect(can(coachA, "teams.view", { clubId: CLUB_A, teamId: "t-unassigned" })).toBe(false);
    expect(can(playerA, "teams.view", { clubId: CLUB_A, teamId: "t2" })).toBe(true);
    expect(can(playerA, "teams.view", { clubId: CLUB_A, teamId: "t-other" })).toBe(false);
  });
});
