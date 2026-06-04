import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { prisma } from "@/db/client";
import type { AuthContext } from "@/lib/rbac";
import {
  getMasterAuditLogs,
  getMasterClubDetail,
  getMasterClubs,
  getMasterCoaches,
  getMasterUsers,
  getSystemSettings,
  updateSystemSettings,
} from "@/modules/master/service";

import { INTEGRATION, uid } from "./helpers";

/**
 * DB-backed coverage of the Master Admin list/aggregate services and their
 * filters (gated on TEST_DATABASE_URL). Verifies per-club counts respect
 * soft-delete, the coach/user/audit filters narrow correctly, and the system
 * settings singleton round-trips.
 */

function masterCtx(): AuthContext {
  return {
    userId: ids.adminUser,
    role: "MASTER_ADMIN",
    activeClubId: null,
    coachTeamIds: [],
    coachTeamPlayerIds: [],
    linkedPlayerIds: [],
    childTeamIds: [],
  };
}

const ids = {
  club: uid(),
  team1: uid(),
  team2: uid(),
  coachUser: uid(),
  parentUser: uid(),
  adminUser: uid(),
  player1: uid(),
  player2: uid(),
  deletedPlayer: uid(),
  shortCode: `MAS-${uid().slice(0, 6)}`,
  name: `Master IT Club ${uid().slice(0, 8)}`,
};

const run = INTEGRATION ? describe : describe.skip;

run("master admin integration", () => {
  beforeAll(async () => {
    const [coachRole, parentRole] = await Promise.all([
      prisma.role.findUnique({ where: { code: "COACH" }, select: { id: true } }),
      prisma.role.findUnique({ where: { code: "PARENT" }, select: { id: true } }),
    ]);

    await prisma.club.create({ data: { id: ids.club, name: ids.name, shortCode: ids.shortCode, status: "ACTIVE", city: "Austin", state: "TX" } });
    await prisma.team.createMany({
      data: [
        { id: ids.team1, clubId: ids.club, name: "Eagles", teamCode: `E-${ids.team1.slice(0, 6)}` },
        { id: ids.team2, clubId: ids.club, name: "Hawks", teamCode: `H-${ids.team2.slice(0, 6)}` },
      ],
    });
    await prisma.player.createMany({
      data: [
        { id: ids.player1, clubId: ids.club, firstName: "Ann", lastName: "One" },
        { id: ids.player2, clubId: ids.club, firstName: "Ben", lastName: "Two" },
        { id: ids.deletedPlayer, clubId: ids.club, firstName: "Gone", lastName: "Three", deletedAt: new Date() },
      ],
    });
    await prisma.user.createMany({
      data: [
        { id: ids.coachUser, email: `coach-${ids.coachUser}@it.test`, firstName: "Cory", lastName: "Coach" },
        { id: ids.parentUser, email: `parent-${ids.parentUser}@it.test`, firstName: "Pat", lastName: "Parent" },
      ],
    });
    await prisma.userRoleAssignment.createMany({
      data: [
        { userId: ids.coachUser, roleId: coachRole!.id, clubId: ids.club, status: "ACTIVE" },
        { userId: ids.parentUser, roleId: parentRole!.id, clubId: ids.club, status: "ACTIVE" },
      ],
    });
    await prisma.teamCoach.create({
      data: { clubId: ids.club, teamId: ids.team1, userId: ids.coachUser, roleType: "HEAD_COACH", status: "ACTIVE" },
    });
    await prisma.playerTeamMembership.create({
      data: { clubId: ids.club, teamId: ids.team1, playerId: ids.player1, status: "ACTIVE" },
    });
    await prisma.auditLog.create({
      data: { clubId: ids.club, actorUserId: ids.coachUser, action: "club.create", resourceType: "club", resourceId: ids.club },
    });
  });

  afterAll(async () => {
    await prisma.auditLog.deleteMany({ where: { clubId: ids.club } });
    await prisma.playerTeamMembership.deleteMany({ where: { clubId: ids.club } });
    await prisma.teamCoach.deleteMany({ where: { clubId: ids.club } });
    await prisma.userRoleAssignment.deleteMany({ where: { clubId: ids.club } });
    await prisma.player.deleteMany({ where: { clubId: ids.club } });
    await prisma.team.deleteMany({ where: { clubId: ids.club } });
    await prisma.user.deleteMany({ where: { id: { in: [ids.coachUser, ids.parentUser] } } });
    await prisma.clubSetting.deleteMany({ where: { clubId: ids.club } });
    await prisma.club.deleteMany({ where: { id: ids.club } });
    await prisma.$disconnect();
  });

  it("getMasterClubs returns soft-delete-aware counts and honors search/status filters", async () => {
    const ctx = masterCtx();
    const bySearch = await getMasterClubs(ctx, { search: ids.shortCode });
    const club = bySearch.rows.find((c) => c.id === ids.club);
    expect(club).toBeTruthy();
    expect(club!.teamCount).toBe(2);
    expect(club!.playerCount).toBe(2); // soft-deleted player excluded
    expect(club!.userCount).toBe(2); // coach + parent (distinct)

    // Status filter for SUSPENDED must not include our ACTIVE club.
    const suspended = await getMasterClubs(ctx, { search: ids.shortCode, status: "SUSPENDED" });
    expect(suspended.rows.some((c) => c.id === ids.club)).toBe(false);
  });

  it("getMasterClubDetail aggregates metrics and team head coach", async () => {
    const detail = await getMasterClubDetail(masterCtx(), ids.club);
    expect(detail).toBeTruthy();
    expect(detail!.metrics.teams).toBe(2);
    expect(detail!.metrics.players).toBe(2);
    expect(detail!.metrics.coaches).toBe(1);
    expect(detail!.metrics.parents).toBe(1);
    const eagles = detail!.teams.find((t) => t.id === ids.team1);
    expect(eagles?.headCoachName).toContain("Cory");
    expect(eagles?.playerCount).toBe(1);
  });

  it("getMasterCoaches finds the coach and honors the role-type filter", async () => {
    const ctx = masterCtx();
    const inClub = await getMasterCoaches(ctx, { clubId: ids.club });
    const coach = inClub.rows.find((c) => c.userId === ids.coachUser);
    expect(coach).toBeTruthy();
    expect(coach!.teams.some((t) => t.teamId === ids.team1 && t.roleType === "HEAD_COACH")).toBe(true);

    const head = await getMasterCoaches(ctx, { clubId: ids.club, roleType: "HEAD_COACH" });
    expect(head.rows.some((c) => c.userId === ids.coachUser)).toBe(true);
    const assistant = await getMasterCoaches(ctx, { clubId: ids.club, roleType: "ASSISTANT_COACH" });
    expect(assistant.rows.some((c) => c.userId === ids.coachUser)).toBe(false);
  });

  it("getMasterUsers honors the role filter", async () => {
    const ctx = masterCtx();
    const coaches = await getMasterUsers(ctx, { role: "COACH", clubId: ids.club });
    expect(coaches.rows.some((u) => u.userId === ids.coachUser)).toBe(true);
    expect(coaches.rows.some((u) => u.userId === ids.parentUser)).toBe(false);
  });

  it("getMasterAuditLogs returns club-scoped rows with names resolved", async () => {
    const logs = await getMasterAuditLogs(masterCtx(), { clubId: ids.club, action: "club.create" });
    const row = logs.rows.find((r) => r.resourceId === ids.club);
    expect(row).toBeTruthy();
    expect(row!.clubName).toBe(ids.name);
    expect(row!.actorName).toContain("Cory");
  });

  it("system settings round-trip via the singleton", async () => {
    const ctx = masterCtx();
    const before = await getSystemSettings(ctx);
    const updated = await updateSystemSettings(ctx, {
      aiFeaturesEnabled: !before.aiFeaturesEnabled,
      maintenanceMode: before.maintenanceMode,
      defaultCurrency: "EUR",
      defaultRegistrationEnabled: before.defaultRegistrationEnabled,
      defaultBillingEnabled: before.defaultBillingEnabled,
      defaultSmsNotifications: before.defaultSmsNotifications,
    });
    expect(updated.defaultCurrency).toBe("EUR");
    expect(updated.aiFeaturesEnabled).toBe(!before.aiFeaturesEnabled);
  });
});
