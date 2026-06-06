import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { prisma } from "@/db/client";
import { ForbiddenError } from "@/lib/rbac";
import { assignCoach, removeCoach } from "@/modules/clubs/service";
import { ConflictError, inviteCoach, listCoaches } from "@/modules/coaches/service";

import { INTEGRATION, adminCtx, uid } from "./helpers";

/**
 * DB-backed coverage of the coach onboarding paths (gated on TEST_DATABASE_URL):
 * invite (+ dedupe of an existing club member), assign/remove (UNIQUE upsert),
 * and the listCoaches union (active users ∪ pending invites).
 */

const ids = {
  club: uid(),
  team1: uid(),
  team2: uid(),
  coachUser: uid(),
  coachRoleId: "",
};

const run = INTEGRATION ? describe : describe.skip;

run("coaches integration", () => {
  beforeAll(async () => {
    await prisma.club.create({ data: { id: ids.club, name: "ITCoach Club", shortCode: `ITC-${ids.club.slice(0, 8)}` } });
    await prisma.team.createMany({
      data: [
        { id: ids.team1, clubId: ids.club, name: "T1", teamCode: `T1-${ids.team1.slice(0, 6)}` },
        { id: ids.team2, clubId: ids.club, name: "T2", teamCode: `T2-${ids.team2.slice(0, 6)}` },
      ],
    });
    // An already-accepted coach: user + active COACH role assignment.
    const role = await prisma.role.findUnique({ where: { code: "COACH" }, select: { id: true } });
    ids.coachRoleId = role!.id;
    await prisma.user.create({
      data: { id: ids.coachUser, email: `existing-coach-${ids.coachUser}@it.test`, firstName: "Cory", lastName: "Coach" },
    });
    await prisma.userRoleAssignment.create({
      data: { userId: ids.coachUser, roleId: ids.coachRoleId, clubId: ids.club, isPrimary: true, status: "ACTIVE" },
    });
  });

  afterAll(async () => {
    await prisma.teamCoach.deleteMany({ where: { clubId: ids.club } });
    await prisma.userRoleAssignment.deleteMany({ where: { clubId: ids.club } });
    await prisma.invitation.deleteMany({ where: { clubId: ids.club } });
    await prisma.user.deleteMany({ where: { id: ids.coachUser } });
    await prisma.team.deleteMany({ where: { clubId: ids.club } });
    await prisma.club.deleteMany({ where: { id: ids.club } });
    await prisma.$disconnect();
  });

  it("invites a coach (PENDING invitation with role COACH + initial team/role)", async () => {
    const ctx = adminCtx(ids.club);
    await inviteCoach(ctx, ids.club, { email: "fresh-coach@it.test", teamId: ids.team1, roleType: "HEAD_COACH" });
    const inv = await prisma.invitation.findFirst({ where: { clubId: ids.club, email: "fresh-coach@it.test" } });
    expect(inv?.status).toBe("PENDING");
    expect(inv?.roleCode).toBe("COACH");
    expect(inv?.teamId).toBe(ids.team1);
    expect(inv?.teamRoleType).toBe("HEAD_COACH");
  });

  it("refuses to duplicate an existing club member", async () => {
    const ctx = adminCtx(ids.club);
    const existing = await prisma.user.findUnique({ where: { id: ids.coachUser }, select: { email: true } });
    await expect(inviteCoach(ctx, ids.club, { email: existing!.email })).rejects.toBeInstanceOf(ConflictError);
  });

  it("rejects inviting a coach onto a team that belongs to another club (no invite created)", async () => {
    const ctx = adminCtx(ids.club);
    const otherClub = uid();
    const otherTeam = uid();
    await prisma.club.create({ data: { id: otherClub, name: "Foreign Club", shortCode: `FC-${otherClub.slice(0, 8)}` } });
    await prisma.team.create({ data: { id: otherTeam, clubId: otherClub, name: "Foreign", teamCode: `FN-${otherTeam.slice(0, 6)}` } });
    try {
      await expect(
        inviteCoach(ctx, ids.club, { email: "cross-club@it.test", teamId: otherTeam }),
      ).rejects.toBeInstanceOf(ForbiddenError);
      // The cross-club team is rejected before any invitation row is written.
      const inv = await prisma.invitation.findFirst({ where: { clubId: ids.club, email: "cross-club@it.test" } });
      expect(inv).toBeNull();
    } finally {
      await prisma.team.deleteMany({ where: { clubId: otherClub } });
      await prisma.club.deleteMany({ where: { id: otherClub } });
    }
  });

  it("assigns an existing coach to a team and re-assign is an idempotent upsert", async () => {
    const ctx = adminCtx(ids.club);
    await assignCoach(ctx, { teamId: ids.team1, userId: ids.coachUser, roleType: "ASSISTANT_COACH" });
    await assignCoach(ctx, { teamId: ids.team1, userId: ids.coachUser, roleType: "HEAD_COACH" }); // update, not dup
    const rows = await prisma.teamCoach.findMany({ where: { teamId: ids.team1, userId: ids.coachUser } });
    expect(rows).toHaveLength(1);
    expect(rows[0].roleType).toBe("HEAD_COACH");
  });

  it("lists active coaches (with teams) ∪ pending invites", async () => {
    const ctx = adminCtx(ids.club);
    const rows = await listCoaches(ctx, ids.club);
    const active = rows.find((r) => r.kind === "USER" && r.id === ids.coachUser);
    expect(active?.status).toBe("ACTIVE");
    expect(active?.teams.some((t) => t.teamId === ids.team1)).toBe(true);
    expect(rows.some((r) => r.kind === "INVITE" && r.status === "PENDING")).toBe(true);
    // Team filter narrows to coaches on that team.
    const onTeam2 = await listCoaches(ctx, ids.club, { team: ids.team2 });
    expect(onTeam2.some((r) => r.id === ids.coachUser)).toBe(false);
  });

  it("removes an assignment (INACTIVE) but keeps the user", async () => {
    const ctx = adminCtx(ids.club);
    await removeCoach(ctx, ids.team1, ids.coachUser);
    const tc = await prisma.teamCoach.findFirst({ where: { teamId: ids.team1, userId: ids.coachUser } });
    expect(tc?.status).toBe("INACTIVE");
    // User still listed as an (unassigned) active coach.
    const rows = await listCoaches(ctx, ids.club);
    const active = rows.find((r) => r.kind === "USER" && r.id === ids.coachUser);
    expect(active).toBeTruthy();
    expect(active?.teams).toHaveLength(0);
  });
});
