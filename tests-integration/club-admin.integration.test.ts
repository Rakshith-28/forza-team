import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { prisma } from "@/db/client";
import type { AuthContext } from "@/lib/rbac";
import { createClub } from "@/modules/clubs/service";
import {
  ConflictError,
  getClubAdmins,
  getMasterClubs,
  inviteClubAdmin,
  resendClubAdminInvite,
  revokeClubAdminInvite,
} from "@/modules/master/service";

import { INTEGRATION, uid } from "./helpers";

/**
 * Club Admin invitation on club creation + management (gated on
 * TEST_DATABASE_URL). Covers: atomic create-club-with-admin (1 club + 1 pending
 * CLUB_ADMIN invite), the orphan adminState transitions (none → pending → ok),
 * dedupe of duplicate invites, resend (token rotation), revoke, and that an
 * accepted admin (simulated assignment) clears the orphan flag.
 *
 * Full acceptInvitation runs Better Auth signUpEmail (needs a request context),
 * so the post-accept ROLE ASSIGNMENT — the part this feature relies on — is
 * exercised directly here; the pure grant plan is unit-tested separately.
 */

function masterCtx(): AuthContext {
  return {
    userId: ids.master,
    role: "MASTER_ADMIN",
    activeClubId: null,
    coachTeamIds: [],
    coachTeamPlayerIds: [],
    linkedPlayerIds: [],
    childTeamIds: [],
  };
}

const ids = { master: uid() };
const clubIds: string[] = [];
const userIds: string[] = [];
const codes = {
  withAdmin: `CAW-${uid().slice(0, 6)}`,
  noAdmin: `CAN-${uid().slice(0, 6)}`,
  accepted: `CAA-${uid().slice(0, 6)}`,
};
const invitedEmail = `invited-${uid()}@it.test`;
const acceptedEmail = `accepted-${uid()}@it.test`;

const run = INTEGRATION ? describe : describe.skip;

run("club admin invitation", () => {
  let adminRoleId = "";
  let withAdminClubId = "";
  let invitationId = "";

  beforeAll(async () => {
    adminRoleId = (await prisma.role.findUnique({ where: { code: "CLUB_ADMIN" }, select: { id: true } }))!.id;
  });

  afterAll(async () => {
    await prisma.invitation.deleteMany({ where: { clubId: { in: clubIds } } });
    await prisma.userRoleAssignment.deleteMany({ where: { clubId: { in: clubIds } } });
    await prisma.clubSetting.deleteMany({ where: { clubId: { in: clubIds } } });
    await prisma.club.deleteMany({ where: { id: { in: clubIds } } });
    if (userIds.length) await prisma.user.deleteMany({ where: { id: { in: userIds } } });
    await prisma.$disconnect();
  });

  it("create-club-with-admin makes exactly one club + one pending CLUB_ADMIN invite", async () => {
    const { club, invite } = await createClub(masterCtx(), {
      name: "CA With Admin",
      shortCode: codes.withAdmin,
      admin: { email: invitedEmail, firstName: "Ada", lastName: "Min" },
    });
    clubIds.push(club.id);
    withAdminClubId = club.id;
    expect(invite).not.toBeNull();
    invitationId = invite!.id;

    const invites = await prisma.invitation.findMany({ where: { clubId: club.id } });
    expect(invites).toHaveLength(1);
    expect(invites[0].roleCode).toBe("CLUB_ADMIN");
    expect(invites[0].status).toBe("PENDING");
    expect(invites[0].teamId).toBeNull();
    expect(invites[0].email).toBe(invitedEmail);
  });

  it("flags the club as 'pending' (orphan indicator) while the invite is unaccepted", async () => {
    const list = await getMasterClubs(masterCtx(), { search: codes.withAdmin });
    const row = list.rows.find((c) => c.id === withAdminClubId);
    expect(row?.adminState).toBe("pending");

    const admins = await getClubAdmins(masterCtx(), withAdminClubId);
    expect(admins).toHaveLength(1);
    expect(admins[0].kind).toBe("INVITE");
    expect(admins[0].status).toBe("PENDING");
    expect(admins[0].name).toBe("Ada Min"); // carried in link metadata
  });

  it("creating a club WITHOUT an admin flags it as an orphan ('none')", async () => {
    const { club, invite } = await createClub(masterCtx(), { name: "CA No Admin", shortCode: codes.noAdmin });
    clubIds.push(club.id);
    expect(invite).toBeNull();

    const list = await getMasterClubs(masterCtx(), { search: codes.noAdmin });
    expect(list.rows.find((c) => c.id === club.id)?.adminState).toBe("none");
    expect(await getClubAdmins(masterCtx(), club.id)).toHaveLength(0);
  });

  it("rejects a duplicate pending invite for the same email", async () => {
    await expect(inviteClubAdmin(masterCtx(), withAdminClubId, { email: invitedEmail })).rejects.toBeInstanceOf(
      ConflictError,
    );
  });

  it("resend rotates the token but keeps the invite pending", async () => {
    const before = await prisma.invitation.findUnique({ where: { id: invitationId }, select: { tokenHash: true } });
    const res = await resendClubAdminInvite(masterCtx(), invitationId);
    expect(res.acceptUrl).toContain(invitationId);
    const after = await prisma.invitation.findUnique({ where: { id: invitationId }, select: { tokenHash: true, status: true } });
    expect(after?.status).toBe("PENDING");
    expect(after?.tokenHash).not.toBe(before?.tokenHash);
  });

  it("revoke disables the invite (status REVOKED) and clears the admin list", async () => {
    await revokeClubAdminInvite(masterCtx(), invitationId);
    const inv = await prisma.invitation.findUnique({ where: { id: invitationId }, select: { status: true } });
    expect(inv?.status).toBe("REVOKED");
    expect(await getClubAdmins(masterCtx(), withAdminClubId)).toHaveLength(0);
  });

  it("an accepted admin (role assignment) clears the orphan flag and blocks re-invite", async () => {
    const { club } = await createClub(masterCtx(), { name: "CA Accepted", shortCode: codes.accepted });
    clubIds.push(club.id);

    // Simulate acceptInvitation's post-signup outcome: a CLUB_ADMIN assignment.
    const user = await prisma.user.create({
      data: { email: acceptedEmail, firstName: "Acc", lastName: "Epted" },
    });
    userIds.push(user.id);
    await prisma.userRoleAssignment.create({
      data: { userId: user.id, roleId: adminRoleId, clubId: club.id, isPrimary: true, status: "ACTIVE" },
    });

    const admins = await getClubAdmins(masterCtx(), club.id);
    expect(admins.some((a) => a.kind === "USER" && a.status === "ACTIVE" && a.email === acceptedEmail)).toBe(true);

    const list = await getMasterClubs(masterCtx(), { search: codes.accepted });
    expect(list.rows.find((c) => c.id === club.id)?.adminState).toBe("ok");

    // Re-inviting an already-active admin is rejected.
    await expect(inviteClubAdmin(masterCtx(), club.id, { email: acceptedEmail })).rejects.toBeInstanceOf(ConflictError);
  });
});
