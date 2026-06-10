import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { prisma } from "@/db/client";
import { ForbiddenError } from "@/lib/rbac";
import { listPlayers } from "@/modules/roster/service";

import { INTEGRATION, coachCtx, uid } from "./helpers";

/**
 * Coach roster scoping (the active-team fix) against an isolated DB.
 *
 * One club, two teams the coach is assigned to (T1, T2), plus a third team the
 * coach is NOT assigned to. Players: P1 on T1 only, P2 on T2 only, P3 on BOTH.
 * The roster must reflect the coach's ACTIVE team only — never a union across
 * their teams — and a player on multiple teams must appear under each.
 */
const ids = {
  club: uid(),
  t1: uid(),
  t2: uid(),
  tOther: uid(), // a team the coach is NOT assigned to (tamper target)
  p1: uid(), // T1 only
  p2: uid(), // T2 only
  pBoth: uid(), // T1 + T2
};

const run = INTEGRATION ? describe : describe.skip;

run("coach roster scopes to the active team", () => {
  // Coach assigned to T1 + T2; coachTeamPlayerIds is the union (the auth scope),
  // independent of the active-team narrowing the roster applies.
  const assignedTeams = [ids.t1, ids.t2];
  const allCoachPlayers = [ids.p1, ids.p2, ids.pBoth];

  beforeAll(async () => {
    await prisma.club.create({ data: { id: ids.club, name: "ITRoster", shortCode: `ITR-${ids.club.slice(0, 8)}` } });
    await prisma.team.createMany({
      data: [
        { id: ids.t1, clubId: ids.club, name: "T1", teamCode: `T1-${ids.t1.slice(0, 6)}` },
        { id: ids.t2, clubId: ids.club, name: "T2", teamCode: `T2-${ids.t2.slice(0, 6)}` },
        { id: ids.tOther, clubId: ids.club, name: "TOther", teamCode: `TO-${ids.tOther.slice(0, 6)}` },
      ],
    });
    await prisma.player.createMany({
      data: [
        { id: ids.p1, clubId: ids.club, firstName: "Only", lastName: "One" },
        { id: ids.p2, clubId: ids.club, firstName: "Only", lastName: "Two" },
        { id: ids.pBoth, clubId: ids.club, firstName: "On", lastName: "Both" },
      ],
    });
    await prisma.playerTeamMembership.createMany({
      data: [
        { clubId: ids.club, playerId: ids.p1, teamId: ids.t1 },
        { clubId: ids.club, playerId: ids.p2, teamId: ids.t2 },
        { clubId: ids.club, playerId: ids.pBoth, teamId: ids.t1 },
        { clubId: ids.club, playerId: ids.pBoth, teamId: ids.t2 },
      ],
    });
  });

  afterAll(async () => {
    await prisma.playerTeamMembership.deleteMany({ where: { clubId: ids.club } });
    await prisma.player.deleteMany({ where: { clubId: ids.club } });
    await prisma.team.deleteMany({ where: { clubId: ids.club } });
    await prisma.club.deleteMany({ where: { id: ids.club } });
    await prisma.$disconnect();
  });

  it("active = T1 → only T1 members; the T2-only player is absent", async () => {
    const ctx = coachCtx(ids.club, assignedTeams, allCoachPlayers, ids.t1);
    const ids_ = (await listPlayers(ctx, ids.club)).map((p) => p.id);
    expect(ids_.sort()).toEqual([ids.p1, ids.pBoth].sort());
    expect(ids_).not.toContain(ids.p2);
  });

  it("active = T2 → only T2 members; the T1-only player is absent", async () => {
    const ctx = coachCtx(ids.club, assignedTeams, allCoachPlayers, ids.t2);
    const ids_ = (await listPlayers(ctx, ids.club)).map((p) => p.id);
    expect(ids_.sort()).toEqual([ids.p2, ids.pBoth].sort());
    expect(ids_).not.toContain(ids.p1);
  });

  it("a player on BOTH teams appears under each team's roster (not dropped)", async () => {
    const t1 = (await listPlayers(coachCtx(ids.club, assignedTeams, allCoachPlayers, ids.t1), ids.club)).map((p) => p.id);
    const t2 = (await listPlayers(coachCtx(ids.club, assignedTeams, allCoachPlayers, ids.t2), ids.club)).map((p) => p.id);
    expect(t1).toContain(ids.pBoth);
    expect(t2).toContain(ids.pBoth);
  });

  it("rejects a tampered active team the coach is NOT assigned to", async () => {
    // tOther exists in the club but isn't in coachTeamIds → assertTeamScope throws.
    const ctx = coachCtx(ids.club, assignedTeams, allCoachPlayers, ids.tOther);
    await expect(listPlayers(ctx, ids.club)).rejects.toBeInstanceOf(ForbiddenError);
  });

  it("no active team selected → EMPTY roster, never the union across teams", async () => {
    const ctx = coachCtx(ids.club, assignedTeams, allCoachPlayers, null);
    const players = await listPlayers(ctx, ids.club);
    expect(players).toHaveLength(0);
  });
});
