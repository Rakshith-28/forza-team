import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { prisma } from "@/db/client";
import { ForbiddenError } from "@/lib/rbac";
import { createPlayer } from "@/modules/roster/service";
import {
  ConflictError,
  inviteParentForPlayer,
  linkParentToPlayer,
  listPlayerGuardians,
  unlinkParentFromPlayer,
} from "@/modules/roster/service";

import { INTEGRATION, adminCtx, coachCtx, uid } from "./helpers";

/**
 * Coach-side player & parent onboarding against an isolated DB (gated on
 * TEST_DATABASE_URL): coach add-player scope, invite-parent (carry-through +
 * dedupe), link-existing (+ duplicate), off-team denial, and the
 * allow_coach_invite_parents settings gate.
 */

const ids = {
  club: uid(),
  teamAssigned: uid(),
  teamOther: uid(),
  player: uid(), // on the coach's assigned team
  parentUser: uid(),
  parent: uid(),
};

const run = INTEGRATION ? describe : describe.skip;

run("coach onboarding integration", () => {
  beforeAll(async () => {
    await prisma.club.create({ data: { id: ids.club, name: "ITCoachOnb", shortCode: `ITCO-${ids.club.slice(0, 8)}` } });
    await prisma.clubSetting.create({ data: { clubId: ids.club, allowCoachInviteParents: true } });
    await prisma.team.createMany({
      data: [
        { id: ids.teamAssigned, clubId: ids.club, name: "Assigned", teamCode: `AS-${ids.teamAssigned.slice(0, 6)}` },
        { id: ids.teamOther, clubId: ids.club, name: "Other", teamCode: `OT-${ids.teamOther.slice(0, 6)}` },
      ],
    });
    await prisma.player.create({ data: { id: ids.player, clubId: ids.club, firstName: "Sam", lastName: "Striker" } });
    await prisma.playerTeamMembership.create({
      data: { clubId: ids.club, playerId: ids.player, teamId: ids.teamAssigned, status: "ACTIVE" },
    });
    // An existing club parent (for link-existing + dedupe).
    await prisma.user.create({ data: { id: ids.parentUser, email: `existing-parent-${ids.parentUser}@it.test`, firstName: "Pre", lastName: "Existing" } });
    const parentRole = await prisma.role.findUnique({ where: { code: "PARENT" }, select: { id: true } });
    await prisma.userRoleAssignment.create({
      data: { userId: ids.parentUser, roleId: parentRole!.id, clubId: ids.club, status: "ACTIVE" },
    });
    await prisma.parent.create({
      data: { id: ids.parent, clubId: ids.club, userId: ids.parentUser, firstName: "Pre", lastName: "Existing", email: `existing-parent-${ids.parentUser}@it.test` },
    });
  });

  afterAll(async () => {
    await prisma.playerParentLink.deleteMany({ where: { clubId: ids.club } });
    await prisma.invitation.deleteMany({ where: { clubId: ids.club } });
    await prisma.playerTeamMembership.deleteMany({ where: { clubId: ids.club } });
    await prisma.parent.deleteMany({ where: { clubId: ids.club } });
    await prisma.userRoleAssignment.deleteMany({ where: { clubId: ids.club } });
    await prisma.user.deleteMany({ where: { id: ids.parentUser } });
    await prisma.player.deleteMany({ where: { clubId: ids.club } });
    await prisma.team.deleteMany({ where: { clubId: ids.club } });
    await prisma.clubSetting.deleteMany({ where: { clubId: ids.club } });
    await prisma.club.deleteMany({ where: { id: ids.club } });
    await prisma.$disconnect();
  });

  function coachOnAssigned() {
    return coachCtx(ids.club, [ids.teamAssigned], [ids.player]);
  }

  it("coach adds a player on an assigned team; rejected on an unassigned team", async () => {
    const ctx = coachOnAssigned();
    const created = await createPlayer(ctx, ids.club, {
      firstName: "New",
      lastName: "Kid",
      initialTeamId: ids.teamAssigned,
    } as never);
    expect(created.id).toBeTruthy();
    const membership = await prisma.playerTeamMembership.findFirst({ where: { playerId: created.id, teamId: ids.teamAssigned } });
    expect(membership).toBeTruthy();

    await expect(
      createPlayer(ctx, ids.club, { firstName: "No", lastName: "Way", initialTeamId: ids.teamOther } as never),
    ).rejects.toBeInstanceOf(ForbiddenError);
  });

  it("coach invites a parent for an assigned-team player (carries link metadata)", async () => {
    const ctx = coachOnAssigned();
    const inv = await inviteParentForPlayer(ctx, {
      email: "fresh-parent@it.test",
      playerId: ids.player,
      relationshipType: "MOTHER",
      canPickup: true,
      canPay: true,
    });
    const row = await prisma.invitation.findFirst({ where: { id: inv.id } });
    expect(row?.roleCode).toBe("PARENT");
    expect(row?.status).toBe("PENDING");
    const meta = row?.linkMetadata as { playerId: string; relationshipType: string; canPickup: boolean } | null;
    expect(meta?.playerId).toBe(ids.player);
    expect(meta?.relationshipType).toBe("MOTHER");
    expect(meta?.canPickup).toBe(true);
    // The pending invite shows on the player's guardians list.
    const guardians = await listPlayerGuardians(ctx, ids.player);
    expect(guardians.pendingInvites.some((p) => p.email === "fresh-parent@it.test")).toBe(true);
  });

  it("dedupes inviting an existing club member", async () => {
    const ctx = coachOnAssigned();
    const existing = await prisma.user.findUnique({ where: { id: ids.parentUser }, select: { email: true } });
    await expect(
      inviteParentForPlayer(ctx, { email: existing!.email, playerId: ids.player, relationshipType: "FATHER" }),
    ).rejects.toBeInstanceOf(ConflictError);
  });

  it("coach links an existing parent; duplicate link is a friendly conflict", async () => {
    const ctx = coachOnAssigned();
    await linkParentToPlayer(ctx, { playerId: ids.player, parentId: ids.parent, relationshipType: "FATHER" });
    const links = await prisma.playerParentLink.findMany({ where: { playerId: ids.player, parentId: ids.parent } });
    expect(links).toHaveLength(1);
    await expect(
      linkParentToPlayer(ctx, { playerId: ids.player, parentId: ids.parent, relationshipType: "FATHER" }),
    ).rejects.toBeInstanceOf(ConflictError);
  });

  it("coach cannot manage guardians for a player off their teams", async () => {
    const offTeamCoach = coachCtx(ids.club, [ids.teamOther], []); // not assigned to the player's team
    await expect(
      inviteParentForPlayer(offTeamCoach, { email: "x@it.test", playerId: ids.player, relationshipType: "MOTHER" }),
    ).rejects.toBeInstanceOf(ForbiddenError);
  });

  it("settings gate: allow_coach_invite_parents=false blocks coaches, not admins", async () => {
    await prisma.clubSetting.update({ where: { clubId: ids.club }, data: { allowCoachInviteParents: false } });
    const ctx = coachOnAssigned();
    await expect(
      inviteParentForPlayer(ctx, { email: "blocked@it.test", playerId: ids.player, relationshipType: "MOTHER" }),
    ).rejects.toBeInstanceOf(ForbiddenError);
    // Admin still works.
    const admin = adminCtx(ids.club);
    const inv = await inviteParentForPlayer(admin, { email: "admin-invite@it.test", playerId: ids.player, relationshipType: "MOTHER" });
    expect(inv.id).toBeTruthy();
    await prisma.clubSetting.update({ where: { clubId: ids.club }, data: { allowCoachInviteParents: true } });
  });

  it("removes a guardian link (INACTIVE), keeping the parent", async () => {
    const ctx = coachOnAssigned();
    const link = await prisma.playerParentLink.findFirst({ where: { playerId: ids.player, parentId: ids.parent } });
    await unlinkParentFromPlayer(ctx, link!.id);
    const after = await prisma.playerParentLink.findUnique({ where: { id: link!.id } });
    expect(after?.status).toBe("INACTIVE");
    expect(await prisma.parent.findUnique({ where: { id: ids.parent } })).toBeTruthy();
  });
});
