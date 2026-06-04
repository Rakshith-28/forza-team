import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { prisma } from "@/db/client";
import { applyInvitationGrants, type InvitationForGrants } from "@/modules/identity/invitations";

import { INTEGRATION, uid } from "./helpers";

/**
 * accept → link DB write (applyInvitationGrants) against an isolated DB. Asserts
 * the player_parent_link and team_coaches rows are created with the carried
 * fields, and that a link to a MISSING player is skipped gracefully (no orphan).
 * The pure planning logic is covered in tests/identity/invitation-grants.test.ts.
 */
const ids = {
  club: uid(),
  team: uid(),
  player: uid(),
  parentUser: uid(),
  parent: uid(),
  coachUser: uid(),
};

const run = INTEGRATION ? describe : describe.skip;

run("accept → grant application", () => {
  beforeAll(async () => {
    await prisma.club.create({ data: { id: ids.club, name: "ITAccept", shortCode: `ITAC-${ids.club.slice(0, 8)}` } });
    await prisma.team.create({ data: { id: ids.team, clubId: ids.club, name: "T", teamCode: `T-${ids.team.slice(0, 6)}` } });
    await prisma.player.create({ data: { id: ids.player, clubId: ids.club, firstName: "Kid", lastName: "X" } });
    // A parent profile (as acceptInvitation would have created post-signup).
    await prisma.user.create({ data: { id: ids.parentUser, email: `accept-parent-${ids.parentUser}@it.test`, firstName: "P", lastName: "A" } });
    await prisma.parent.create({
      data: { id: ids.parent, clubId: ids.club, userId: ids.parentUser, firstName: "P", lastName: "A", email: `accept-parent-${ids.parentUser}@it.test` },
    });
    await prisma.user.create({ data: { id: ids.coachUser, email: `accept-coach-${ids.coachUser}@it.test`, firstName: "C", lastName: "A" } });
  });

  afterAll(async () => {
    await prisma.playerParentLink.deleteMany({ where: { clubId: ids.club } });
    await prisma.teamCoach.deleteMany({ where: { clubId: ids.club } });
    await prisma.parent.deleteMany({ where: { clubId: ids.club } });
    await prisma.player.deleteMany({ where: { clubId: ids.club } });
    await prisma.team.deleteMany({ where: { clubId: ids.club } });
    await prisma.user.deleteMany({ where: { id: { in: [ids.parentUser, ids.coachUser] } } });
    await prisma.club.deleteMany({ where: { id: ids.club } });
    await prisma.$disconnect();
  });

  function inv(over: Partial<InvitationForGrants>): InvitationForGrants {
    return { roleCode: "PARENT", clubId: ids.club, teamId: null, teamRoleType: null, linkMetadata: null, createdBy: null, ...over };
  }

  it("creates a player_parent_link with the carried metadata", async () => {
    const result = await prisma.$transaction((tx) =>
      applyInvitationGrants(tx, {
        invitation: inv({
          roleCode: "PARENT",
          linkMetadata: { playerId: ids.player, relationshipType: "MOTHER", isPrimaryGuardian: true, canPickup: true, canPay: false },
        }),
        userId: ids.parentUser,
        parentId: ids.parent,
      }),
    );
    expect(result.parentLink).toBe(true);
    const link = await prisma.playerParentLink.findFirst({ where: { playerId: ids.player, parentId: ids.parent } });
    expect(link?.relationshipType).toBe("MOTHER");
    expect(link?.isPrimaryGuardian).toBe(true);
    expect(link?.canPickup).toBe(true);
    expect(link?.canPay).toBe(false);
  });

  it("creates a team_coaches row with the carried role type", async () => {
    const result = await prisma.$transaction((tx) =>
      applyInvitationGrants(tx, {
        invitation: inv({ roleCode: "COACH", teamId: ids.team, teamRoleType: "HEAD_COACH" }),
        userId: ids.coachUser,
      }),
    );
    expect(result.teamCoach).toBe(true);
    const tc = await prisma.teamCoach.findFirst({ where: { teamId: ids.team, userId: ids.coachUser } });
    expect(tc?.roleType).toBe("HEAD_COACH");
  });

  it("skips a link to a missing player gracefully (no orphan/partial write)", async () => {
    const before = await prisma.playerParentLink.count({ where: { parentId: ids.parent } });
    const result = await prisma.$transaction((tx) =>
      applyInvitationGrants(tx, {
        invitation: inv({ roleCode: "PARENT", linkMetadata: { playerId: uid(), relationshipType: "MOTHER" } }),
        userId: ids.parentUser,
        parentId: ids.parent,
      }),
    );
    expect(result.parentLink).toBe(false);
    const after = await prisma.playerParentLink.count({ where: { parentId: ids.parent } });
    expect(after).toBe(before); // no new link created
  });
});
