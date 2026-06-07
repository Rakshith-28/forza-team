import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { prisma } from "@/db/client";
import { loadAuthContext } from "@/modules/identity/context";
import { listLinkedChildren, listPlayers } from "@/modules/roster/service";
import { listParentSchedule } from "@/modules/events/service";

import { INTEGRATION, uid } from "./helpers";

/**
 * Multi-tenant / multi-team / multi-child integrity against an isolated DB.
 * Two clubs; a coach on two teams; a parent with two children on different
 * teams; a player on two teams. Asserts scope derivation (the real
 * loadAuthContext), aggregation, cross-club isolation, and UNIQUE integrity.
 */
const ids = {
  clubA: uid(),
  clubB: uid(),
  a1: uid(),
  a2: uid(),
  b1: uid(),
  coachUser: uid(),
  parentUser: uid(),
  parent: uid(),
  childX: uid(),
  childY: uid(),
  pBoth: uid(),
  pB1: uid(),
  eventA1: uid(),
  eventClubWideA: uid(),
  eventB1: uid(),
};

const run = INTEGRATION ? describe : describe.skip;

run("multi-tenant integrity", () => {
  beforeAll(async () => {
    // Roles (self-contained — don't depend on a prior seed).
    for (const [code, name] of [["COACH", "Coach"], ["PARENT", "Parent / Guardian"]] as const) {
      await prisma.role.upsert({ where: { code }, create: { code, name }, update: {} });
    }
    const coachRole = (await prisma.role.findUnique({ where: { code: "COACH" }, select: { id: true } }))!.id;
    const parentRole = (await prisma.role.findUnique({ where: { code: "PARENT" }, select: { id: true } }))!.id;

    await prisma.club.createMany({
      data: [
        { id: ids.clubA, name: "ITMtA", shortCode: `ITMA-${ids.clubA.slice(0, 8)}` },
        { id: ids.clubB, name: "ITMtB", shortCode: `ITMB-${ids.clubB.slice(0, 8)}` },
      ],
    });
    await prisma.team.createMany({
      data: [
        { id: ids.a1, clubId: ids.clubA, name: "A1", teamCode: `A1-${ids.a1.slice(0, 6)}` },
        { id: ids.a2, clubId: ids.clubA, name: "A2", teamCode: `A2-${ids.a2.slice(0, 6)}` },
        { id: ids.b1, clubId: ids.clubB, name: "B1", teamCode: `B1-${ids.b1.slice(0, 6)}` },
      ],
    });
    await prisma.player.createMany({
      data: [
        { id: ids.childX, clubId: ids.clubA, firstName: "Child", lastName: "X" },
        { id: ids.childY, clubId: ids.clubA, firstName: "Child", lastName: "Y" },
        { id: ids.pBoth, clubId: ids.clubA, firstName: "Both", lastName: "Teams" },
        { id: ids.pB1, clubId: ids.clubB, firstName: "Other", lastName: "Club" },
      ],
    });
    await prisma.playerTeamMembership.createMany({
      data: [
        { clubId: ids.clubA, playerId: ids.childX, teamId: ids.a1 },
        { clubId: ids.clubA, playerId: ids.childY, teamId: ids.a2 },
        { clubId: ids.clubA, playerId: ids.pBoth, teamId: ids.a1 }, // player on two teams
        { clubId: ids.clubA, playerId: ids.pBoth, teamId: ids.a2 },
        { clubId: ids.clubB, playerId: ids.pB1, teamId: ids.b1 },
      ],
    });

    // Coach assigned to BOTH club-A teams.
    await prisma.user.create({ data: { id: ids.coachUser, email: `mt-coach-${ids.coachUser}@it.test`, firstName: "Mt", lastName: "Coach" } });
    await prisma.userRoleAssignment.create({ data: { userId: ids.coachUser, roleId: coachRole, clubId: ids.clubA, status: "ACTIVE" } });
    await prisma.teamCoach.createMany({
      data: [
        { clubId: ids.clubA, teamId: ids.a1, userId: ids.coachUser, roleType: "HEAD_COACH", status: "ACTIVE" },
        { clubId: ids.clubA, teamId: ids.a2, userId: ids.coachUser, roleType: "ASSISTANT_COACH", status: "ACTIVE" },
      ],
    });

    // Parent with two children on different teams (single login).
    await prisma.user.create({ data: { id: ids.parentUser, email: `mt-parent-${ids.parentUser}@it.test`, firstName: "Mt", lastName: "Parent" } });
    await prisma.userRoleAssignment.create({ data: { userId: ids.parentUser, roleId: parentRole, clubId: ids.clubA, status: "ACTIVE" } });
    await prisma.parent.create({ data: { id: ids.parent, clubId: ids.clubA, userId: ids.parentUser, firstName: "Mt", lastName: "Parent", email: `mt-parent-${ids.parentUser}@it.test` } });
    await prisma.playerParentLink.createMany({
      data: [
        { clubId: ids.clubA, playerId: ids.childX, parentId: ids.parent, relationshipType: "GUARDIAN" },
        { clubId: ids.clubA, playerId: ids.childY, parentId: ids.parent, relationshipType: "GUARDIAN" },
      ],
    });

    const soon = new Date(Date.now() + 86_400_000);
    const later = new Date(Date.now() + 90_000_000);
    await prisma.event.createMany({
      data: [
        { id: ids.eventA1, clubId: ids.clubA, audienceScope: "TEAMS", eventType: "PRACTICE", title: "A1", startAt: soon, endAt: later, timezone: "UTC" },
        { id: ids.eventClubWideA, clubId: ids.clubA, audienceScope: "CLUB_WIDE", eventType: "CLUB_EVENT", title: "Club A", startAt: soon, endAt: later, timezone: "UTC" },
        { id: ids.eventB1, clubId: ids.clubB, audienceScope: "TEAMS", eventType: "PRACTICE", title: "B1", startAt: soon, endAt: later, timezone: "UTC" },
      ],
    });
    // Canonical audience via event_teams: A1 → team a1 (club A), B1 → team b1 (club B).
    await prisma.eventTeam.createMany({
      data: [
        { clubId: ids.clubA, eventId: ids.eventA1, teamId: ids.a1 },
        { clubId: ids.clubB, eventId: ids.eventB1, teamId: ids.b1 },
      ],
    });
  });

  afterAll(async () => {
    const clubs = [ids.clubA, ids.clubB];
    await prisma.eventRsvp.deleteMany({ where: { clubId: { in: clubs } } });
    await prisma.eventTeam.deleteMany({ where: { clubId: { in: clubs } } });
    await prisma.event.deleteMany({ where: { clubId: { in: clubs } } });
    await prisma.playerParentLink.deleteMany({ where: { clubId: { in: clubs } } });
    await prisma.playerTeamMembership.deleteMany({ where: { clubId: { in: clubs } } });
    await prisma.parent.deleteMany({ where: { clubId: { in: clubs } } });
    await prisma.teamCoach.deleteMany({ where: { clubId: { in: clubs } } });
    await prisma.userRoleAssignment.deleteMany({ where: { clubId: { in: clubs } } });
    await prisma.user.deleteMany({ where: { id: { in: [ids.coachUser, ids.parentUser] } } });
    await prisma.player.deleteMany({ where: { clubId: { in: clubs } } });
    await prisma.team.deleteMany({ where: { clubId: { in: clubs } } });
    await prisma.club.deleteMany({ where: { id: { in: clubs } } });
    await prisma.$disconnect();
  });

  it("coach scope = aggregate of assigned teams only (no club B)", async () => {
    const ctx = await loadAuthContext(ids.coachUser, ids.clubA);
    expect(ctx).toBeTruthy();
    expect(ctx!.coachTeamIds.sort()).toEqual([ids.a1, ids.a2].sort());
    const players = await listPlayers(ctx!, ids.clubA);
    const playerIds = players.map((p) => p.id);
    expect(playerIds).toEqual(expect.arrayContaining([ids.childX, ids.childY, ids.pBoth]));
    expect(playerIds).not.toContain(ids.pB1); // no cross-club leakage
    // The two-team player appears once (de-duped), with both team memberships.
    expect(playerIds.filter((id) => id === ids.pBoth)).toHaveLength(1);
    const both = players.find((p) => p.id === ids.pBoth);
    expect(both?.teamMemberships.map((m) => m.teamId).sort()).toEqual([ids.a1, ids.a2].sort());
  });

  it("parent single login surfaces both children across teams; no cross-club leak", async () => {
    const ctx = await loadAuthContext(ids.parentUser, ids.clubA);
    expect(ctx!.linkedPlayerIds.sort()).toEqual([ids.childX, ids.childY].sort());
    expect(ctx!.childTeamIds.sort()).toEqual([ids.a1, ids.a2].sort());

    const kids = await listLinkedChildren(ctx!);
    expect(kids.map((k) => k.id).sort()).toEqual([ids.childX, ids.childY].sort());

    const schedule = await listParentSchedule(ctx!);
    const eventIds = schedule.map((s) => s.event.id);
    expect(eventIds).toEqual(expect.arrayContaining([ids.eventA1, ids.eventClubWideA]));
    expect(eventIds).not.toContain(ids.eventB1); // club B event never surfaces
    expect(new Set(eventIds).size).toBe(eventIds.length); // de-duped
  });

  it("enforces UNIQUE(team_id, user_id) and UNIQUE(player_id, parent_id)", async () => {
    await expect(
      prisma.teamCoach.create({ data: { clubId: ids.clubA, teamId: ids.a1, userId: ids.coachUser, roleType: "HEAD_COACH", status: "ACTIVE" } }),
    ).rejects.toMatchObject({ code: "P2002" });
    await expect(
      prisma.playerParentLink.create({ data: { clubId: ids.clubA, playerId: ids.childX, parentId: ids.parent, relationshipType: "GUARDIAN", status: "ACTIVE" } }),
    ).rejects.toMatchObject({ code: "P2002" });
  });
});
