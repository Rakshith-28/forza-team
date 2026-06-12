import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { prisma } from "@/db/client";
import { deleteTeam, removeCoach } from "@/modules/clubs/service";
import { getCoachProfile } from "@/modules/coaches/service";

import { INTEGRATION, adminCtx, uid } from "./helpers";

/**
 * Coach assignment history + profile against an isolated DB (gated on
 * TEST_DATABASE_URL): un-assignment preserves an ENDED row; the profile shows
 * current vs past teams; a team-deleted past assignment is reconstructed from the
 * team-deletion audit snapshot's `affectedCoaches`.
 */

const run = INTEGRATION ? describe : describe.skip;

const ids = {
  club: uid(),
  teamLive: uid(),
  teamToDelete: uid(),
  coach: uid(),
};

run("coach profile + assignment history", () => {
  beforeAll(async () => {
    await prisma.club.create({ data: { id: ids.club, name: "ITCoachProfile", shortCode: `ITCP-${ids.club.slice(0, 8)}` } });
    await prisma.team.createMany({
      data: [
        { id: ids.teamLive, clubId: ids.club, name: "Live", teamCode: `LV-${ids.teamLive.slice(0, 6)}` },
        { id: ids.teamToDelete, clubId: ids.club, name: "Doomed", teamCode: `DM-${ids.teamToDelete.slice(0, 6)}` },
      ],
    });
    await prisma.user.create({ data: { id: ids.coach, email: `coach-${ids.coach}@it.test`, firstName: "Pat", lastName: "Coach" } });
    const coachRole = await prisma.role.findUnique({ where: { code: "COACH" }, select: { id: true } });
    await prisma.userRoleAssignment.create({ data: { userId: ids.coach, roleId: coachRole!.id, clubId: ids.club, status: "ACTIVE" } });
    await prisma.teamCoach.createMany({
      data: [
        { clubId: ids.club, teamId: ids.teamLive, userId: ids.coach, roleType: "HEAD_COACH", status: "ACTIVE" },
        { clubId: ids.club, teamId: ids.teamToDelete, userId: ids.coach, roleType: "ASSISTANT_COACH", status: "ACTIVE" },
      ],
    });
  });

  afterAll(async () => {
    await prisma.teamCoach.deleteMany({ where: { clubId: ids.club } });
    await prisma.userRoleAssignment.deleteMany({ where: { clubId: ids.club } });
    await prisma.auditLog.deleteMany({ where: { clubId: ids.club } });
    await prisma.team.deleteMany({ where: { clubId: ids.club } });
    await prisma.club.deleteMany({ where: { id: ids.club } });
    await prisma.session.deleteMany({ where: { userId: ids.coach } });
    await prisma.user.deleteMany({ where: { id: ids.coach } });
    await prisma.$disconnect();
  });

  it("un-assignment preserves an ENDED row (not deleted) with endedAt", async () => {
    await removeCoach(adminCtx(ids.club), ids.teamLive, ids.coach);
    const row = await prisma.teamCoach.findUnique({
      where: { teamId_userId: { teamId: ids.teamLive, userId: ids.coach } },
    });
    expect(row).toBeTruthy(); // not deleted
    expect(row!.status).toBe("ENDED");
    expect(row!.endedAt).not.toBeNull();
  });

  it("profile shows current (still ACTIVE) vs past (ENDED, live team)", async () => {
    const profile = (await getCoachProfile(adminCtx(ids.club), ids.coach))!;
    expect(profile.currentTeams.map((t) => t.teamId)).toEqual([ids.teamToDelete]);
    const live = profile.pastTeams.find((t) => t.teamId === ids.teamLive);
    expect(live).toMatchObject({ teamDeleted: false });
    expect(live!.endedAt).not.toBeNull();
  });

  it("deleting a team records the coach in the audit snapshot's affectedCoaches", async () => {
    await deleteTeam(adminCtx(ids.club), ids.teamToDelete);
    const audit = await prisma.auditLog.findFirst({ where: { clubId: ids.club, action: "team.delete", resourceId: ids.teamToDelete } });
    const affected = (audit!.metadataJson as { snapshot?: { affectedCoaches?: { userId: string }[] } } | null)?.snapshot
      ?.affectedCoaches;
    expect(affected?.some((c) => c.userId === ids.coach)).toBe(true);
  });

  it("profile reconstructs the deleted team as a past assignment", async () => {
    const profile = (await getCoachProfile(adminCtx(ids.club), ids.coach))!;
    expect(profile.currentTeams).toHaveLength(0); // one ended, one deleted
    const deleted = profile.pastTeams.find((t) => t.teamName === "Doomed");
    expect(deleted).toMatchObject({ teamDeleted: true });
    // The live-team ENDED assignment is still listed too.
    expect(profile.pastTeams.some((t) => t.teamId === ids.teamLive && !t.teamDeleted)).toBe(true);
  });
});
