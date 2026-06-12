import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { prisma } from "@/db/client";
import { applyInvitationGrants, type InvitationForGrants } from "@/modules/identity/invitations";

import { INTEGRATION, uid } from "./helpers";

/**
 * accept → link DB write (applyInvitationGrants) against an isolated DB. Asserts
 * the player_account_link and team_coaches rows are created with the carried
 * fields, and that a link to a MISSING player is skipped gracefully (no orphan).
 * The pure planning logic is covered in tests/identity/invitation-grants.test.ts.
 */
const ids = {
  club: uid(),
  team: uid(),
  player: uid(),
  playerUser: uid(),
  playerAccount: uid(),
  coachUser: uid(),
};

const run = INTEGRATION ? describe : describe.skip;

run("accept → grant application", () => {
  beforeAll(async () => {
    await prisma.club.create({ data: { id: ids.club, name: "ITAccept", shortCode: `ITAC-${ids.club.slice(0, 8)}` } });
    await prisma.team.create({ data: { id: ids.team, clubId: ids.club, name: "T", teamCode: `T-${ids.team.slice(0, 6)}` } });
    await prisma.player.create({ data: { id: ids.player, clubId: ids.club, firstName: "Kid", lastName: "X" } });
    // A player-account profile (as acceptInvitation would have created post-signup).
    await prisma.user.create({ data: { id: ids.playerUser, email: `accept-player-${ids.playerUser}@it.test`, firstName: "P", lastName: "A" } });
    await prisma.playerAccount.create({
      data: { id: ids.playerAccount, clubId: ids.club, userId: ids.playerUser, firstName: "P", lastName: "A", email: `accept-player-${ids.playerUser}@it.test` },
    });
    await prisma.user.create({ data: { id: ids.coachUser, email: `accept-coach-${ids.coachUser}@it.test`, firstName: "C", lastName: "A" } });
  });

  afterAll(async () => {
    await prisma.playerAccountLink.deleteMany({ where: { clubId: ids.club } });
    await prisma.teamCoach.deleteMany({ where: { clubId: ids.club } });
    await prisma.playerAccount.deleteMany({ where: { clubId: ids.club } });
    await prisma.player.deleteMany({ where: { clubId: ids.club } });
    await prisma.team.deleteMany({ where: { clubId: ids.club } });
    await prisma.user.deleteMany({ where: { id: { in: [ids.playerUser, ids.coachUser] } } });
    await prisma.club.deleteMany({ where: { id: ids.club } });
    await prisma.$disconnect();
  });

  function inv(over: Partial<InvitationForGrants>): InvitationForGrants {
    return { roleCode: "PLAYER", clubId: ids.club, teamId: null, teamRoleType: null, linkMetadata: null, createdBy: null, ...over };
  }

  it("creates a player_account_link with the carried metadata", async () => {
    const result = await prisma.$transaction((tx) =>
      applyInvitationGrants(tx, {
        invitation: inv({
          roleCode: "PLAYER",
          linkMetadata: { playerId: ids.player, relationshipType: "MOTHER", isPrimaryGuardian: true, canPickup: true, canPay: false },
        }),
        userId: ids.playerUser,
        playerAccountId: ids.playerAccount,
      }),
    );
    expect(result.playerLink).toBe(true);
    const link = await prisma.playerAccountLink.findFirst({ where: { playerId: ids.player, playerAccountId: ids.playerAccount } });
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

  it("re-applying an accepted invite's grants is idempotent (no duplicate link / team_coach)", async () => {
    // Mirrors a re-accept: acceptInvitation gates a used token via invitationState,
    // and the grant writes are upserts — applying twice must not duplicate rows.
    const playerInv = inv({
      roleCode: "PLAYER",
      linkMetadata: { playerId: ids.player, relationshipType: "MOTHER", isPrimaryGuardian: false, canPickup: true, canPay: true },
    });
    await prisma.$transaction((tx) => applyInvitationGrants(tx, { invitation: playerInv, userId: ids.playerUser, playerAccountId: ids.playerAccount }));
    await prisma.$transaction((tx) => applyInvitationGrants(tx, { invitation: playerInv, userId: ids.playerUser, playerAccountId: ids.playerAccount }));
    const links = await prisma.playerAccountLink.findMany({ where: { playerId: ids.player, playerAccountId: ids.playerAccount } });
    expect(links).toHaveLength(1);

    const coachInv = inv({ roleCode: "COACH", teamId: ids.team, teamRoleType: "ASSISTANT_COACH" });
    await prisma.$transaction((tx) => applyInvitationGrants(tx, { invitation: coachInv, userId: ids.coachUser }));
    await prisma.$transaction((tx) => applyInvitationGrants(tx, { invitation: coachInv, userId: ids.coachUser }));
    const tcs = await prisma.teamCoach.findMany({ where: { teamId: ids.team, userId: ids.coachUser } });
    expect(tcs).toHaveLength(1);
  });

  it("skips a link to a missing player gracefully (no orphan/partial write)", async () => {
    const before = await prisma.playerAccountLink.count({ where: { playerAccountId: ids.playerAccount } });
    const result = await prisma.$transaction((tx) =>
      applyInvitationGrants(tx, {
        invitation: inv({ roleCode: "PLAYER", linkMetadata: { playerId: uid(), relationshipType: "MOTHER" } }),
        userId: ids.playerUser,
        playerAccountId: ids.playerAccount,
      }),
    );
    expect(result.playerLink).toBe(false);
    const after = await prisma.playerAccountLink.count({ where: { playerAccountId: ids.playerAccount } });
    expect(after).toBe(before); // no new link created
  });
});
