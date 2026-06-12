import { afterAll, describe, expect, it } from "vitest";

import { prisma } from "@/db/client";
import { ForbiddenError } from "@/lib/rbac";
import { deletePlayer, listTeamlessPlayers, removePlayerFromTeam } from "@/modules/roster/service";
import { deleteCoach, getCoachDeletionImpact } from "@/modules/coaches/service";
import { deleteTeam } from "@/modules/clubs/service";

import { INTEGRATION, adminCtx, coachCtx, uid } from "./helpers";

/**
 * HARD deletion behavior against an isolated DB (gated on TEST_DATABASE_URL):
 * player/coach/team cascades, the 1→0 login-deactivation rule, detach-only team
 * deletion, the teamless pool, and audit snapshots. Each test builds its own
 * entities; afterAll wipes every club it created.
 */

const run = INTEGRATION ? describe : describe.skip;

const createdClubs: string[] = [];
const createdUsers: string[] = [];

async function roleId(code: string): Promise<string> {
  const r = await prisma.role.findUnique({ where: { code }, select: { id: true } });
  if (!r) throw new Error(`role ${code} not seeded in test DB`);
  return r.id;
}

async function makeClub(): Promise<string> {
  const id = uid();
  await prisma.club.create({ data: { id, name: `ITDel-${id.slice(0, 6)}`, shortCode: `ITD-${id.slice(0, 8)}` } });
  createdClubs.push(id);
  return id;
}

async function makeTeam(clubId: string, name = "Team"): Promise<string> {
  const id = uid();
  await prisma.team.create({ data: { id, clubId, name, teamCode: `${name.slice(0, 3)}-${id.slice(0, 6)}` } });
  return id;
}

async function makePlayer(clubId: string, teamId?: string): Promise<string> {
  const id = uid();
  await prisma.player.create({ data: { id, clubId, firstName: "Test", lastName: `Player-${id.slice(0, 4)}` } });
  if (teamId) {
    await prisma.playerTeamMembership.create({ data: { clubId, playerId: id, teamId, status: "ACTIVE" } });
  }
  return id;
}

/** A player login: User + PLAYER role assignment + PlayerAccount + a live session. */
async function makePlayerLogin(clubId: string): Promise<{ userId: string; accountId: string }> {
  const userId = uid();
  const accountId = uid();
  await prisma.user.create({ data: { id: userId, email: `pl-${userId}@it.test`, firstName: "Log", lastName: "In" } });
  createdUsers.push(userId);
  await prisma.userRoleAssignment.create({
    data: { userId, roleId: await roleId("PLAYER"), clubId, status: "ACTIVE" },
  });
  await prisma.playerAccount.create({
    data: { id: accountId, clubId, userId, firstName: "Log", lastName: "In", email: `pl-${userId}@it.test` },
  });
  await prisma.session.create({ data: { userId, token: uid(), expiresAt: new Date(Date.now() + 3_600_000) } });
  return { userId, accountId };
}

async function link(clubId: string, playerId: string, accountId: string): Promise<void> {
  await prisma.playerAccountLink.create({
    data: { clubId, playerId, playerAccountId: accountId, relationshipType: "GUARDIAN", status: "ACTIVE" },
  });
}

afterAll(async () => {
  for (const clubId of createdClubs) {
    const events = await prisma.event.findMany({ where: { clubId }, select: { id: true } });
    const evIds = events.map((e) => e.id);
    if (evIds.length) {
      await prisma.eventAttachment.deleteMany({ where: { eventId: { in: evIds } } });
      await prisma.eventRsvp.deleteMany({ where: { eventId: { in: evIds } } });
      await prisma.attendanceRecord.deleteMany({ where: { eventId: { in: evIds } } });
    }
    await prisma.eventTeam.deleteMany({ where: { clubId } });
    await prisma.event.deleteMany({ where: { clubId } });
    const chats = await prisma.chat.findMany({ where: { clubId }, select: { id: true } });
    const chatIds = chats.map((c) => c.id);
    if (chatIds.length) {
      await prisma.messageAttachment.deleteMany({ where: { message: { chatId: { in: chatIds } } } });
      await prisma.message.deleteMany({ where: { chatId: { in: chatIds } } });
      await prisma.chatMember.deleteMany({ where: { chatId: { in: chatIds } } });
    }
    await prisma.chat.deleteMany({ where: { clubId } });
    await prisma.announcement.deleteMany({ where: { clubId } });
    await prisma.playerEvaluation.deleteMany({ where: { clubId } });
    await prisma.evaluationCycle.deleteMany({ where: { clubId } });
    await prisma.developmentGoal.deleteMany({ where: { clubId } });
    await prisma.playerRemark.deleteMany({ where: { clubId } });
    await prisma.playerAccountLink.deleteMany({ where: { clubId } });
    await prisma.playerTeamMembership.deleteMany({ where: { clubId } });
    await prisma.playerAccount.deleteMany({ where: { clubId } });
    await prisma.teamCoach.deleteMany({ where: { clubId } });
    await prisma.userRoleAssignment.deleteMany({ where: { clubId } });
    await prisma.invitation.deleteMany({ where: { clubId } });
    await prisma.auditLog.deleteMany({ where: { clubId } });
    await prisma.player.deleteMany({ where: { clubId } });
    await prisma.team.deleteMany({ where: { clubId } });
    await prisma.clubSetting.deleteMany({ where: { clubId } });
    await prisma.club.deleteMany({ where: { id: clubId } });
  }
  if (createdUsers.length) {
    await prisma.session.deleteMany({ where: { userId: { in: createdUsers } } });
    await prisma.user.deleteMany({ where: { id: { in: createdUsers } } });
  }
  await prisma.$disconnect();
});

run("player hard deletion", () => {
  it("removes the player and all dependents, with no orphans, and writes an audit snapshot", async () => {
    const clubId = await makeClub();
    const teamId = await makeTeam(clubId);
    const playerId = await makePlayer(clubId, teamId);
    const { accountId, userId } = await makePlayerLogin(clubId);
    await link(clubId, playerId, accountId);
    // A couple of dependents.
    const eventId = uid();
    await prisma.event.create({
      data: { id: eventId, clubId, audienceScope: "TEAMS", eventType: "PRACTICE", title: "P", startAt: new Date(), endAt: new Date(), timezone: "UTC" },
    });
    await prisma.eventRsvp.create({ data: { clubId, eventId, playerId, respondedByUserId: userId, responseStatus: "YES" } });
    await prisma.attendanceRecord.create({ data: { clubId, eventId, playerId, recordedByUserId: userId, attendanceStatus: "PRESENT" } });
    await prisma.playerRemark.create({ data: { clubId, playerId, authorUserId: userId, body: "note" } });

    await deletePlayer(adminCtx(clubId), playerId);

    expect(await prisma.player.findUnique({ where: { id: playerId } })).toBeNull();
    expect(await prisma.playerTeamMembership.count({ where: { playerId } })).toBe(0);
    expect(await prisma.playerAccountLink.count({ where: { playerId } })).toBe(0);
    expect(await prisma.eventRsvp.count({ where: { playerId } })).toBe(0);
    expect(await prisma.attendanceRecord.count({ where: { playerId } })).toBe(0);
    expect(await prisma.playerRemark.count({ where: { playerId } })).toBe(0);

    const audit = await prisma.auditLog.findFirst({ where: { clubId, action: "player.delete", resourceId: playerId } });
    expect(audit).toBeTruthy();
    const snap = (audit!.metadataJson as { snapshot?: { playerId: string; playerAccountEmails: string[] } } | null)?.snapshot;
    expect(snap?.playerId).toBe(playerId);
    expect(snap?.playerAccountEmails).toContain(`pl-${userId}@it.test`);
  });

  it("sibling 2→1 keeps the other profile + the shared account ACTIVE", async () => {
    const clubId = await makeClub();
    const teamId = await makeTeam(clubId);
    const kidA = await makePlayer(clubId, teamId);
    const kidB = await makePlayer(clubId, teamId);
    const { accountId } = await makePlayerLogin(clubId);
    await link(clubId, kidA, accountId);
    await link(clubId, kidB, accountId);

    await deletePlayer(adminCtx(clubId), kidA);

    expect(await prisma.player.findUnique({ where: { id: kidB } })).toBeTruthy();
    expect(await prisma.playerAccountLink.count({ where: { playerAccountId: accountId, status: "ACTIVE" } })).toBe(1);
    expect((await prisma.playerAccount.findUnique({ where: { id: accountId } }))!.status).toBe("ACTIVE");
  });

  it("1→0 deactivates the account + its PLAYER assignment and kills sessions", async () => {
    const clubId = await makeClub();
    const playerId = await makePlayer(clubId);
    const { accountId, userId } = await makePlayerLogin(clubId);
    await link(clubId, playerId, accountId);

    await deletePlayer(adminCtx(clubId), playerId);

    expect((await prisma.playerAccount.findUnique({ where: { id: accountId } }))!.status).toBe("INACTIVE");
    expect(await prisma.userRoleAssignment.count({ where: { userId, status: "ACTIVE" } })).toBe(0);
    expect(await prisma.session.count({ where: { userId } })).toBe(0);
  });

  it("1→0 does NOT kill sessions when the login still holds another role", async () => {
    const clubId = await makeClub();
    const teamId = await makeTeam(clubId);
    const playerId = await makePlayer(clubId);
    const { accountId, userId } = await makePlayerLogin(clubId);
    await link(clubId, playerId, accountId);
    // Same login is also a coach.
    await prisma.teamCoach.create({ data: { clubId, teamId, userId, roleType: "ASSISTANT_COACH", status: "ACTIVE" } });

    await deletePlayer(adminCtx(clubId), playerId);

    expect((await prisma.playerAccount.findUnique({ where: { id: accountId } }))!.status).toBe("INACTIVE");
    expect(await prisma.session.count({ where: { userId } })).toBe(1); // kept — still a coach
  });
});

run("coach hard deletion", () => {
  it("getCoachDeletionImpact: coachless only when zero coaches remain", async () => {
    const clubId = await makeClub();
    const solo = await makeTeam(clubId, "Solo");
    const shared = await makeTeam(clubId, "Shared");
    const target = uid();
    const other = uid();
    await prisma.user.createMany({
      data: [
        { id: target, email: `c-${target}@it.test`, firstName: "T", lastName: "Coach" },
        { id: other, email: `c-${other}@it.test`, firstName: "O", lastName: "Coach" },
      ],
    });
    createdUsers.push(target, other);
    await prisma.teamCoach.createMany({
      data: [
        { clubId, teamId: solo, userId: target, roleType: "HEAD_COACH", status: "ACTIVE" },
        { clubId, teamId: shared, userId: target, roleType: "HEAD_COACH", status: "ACTIVE" },
        { clubId, teamId: shared, userId: other, roleType: "ASSISTANT_COACH", status: "ACTIVE" },
      ],
    });

    const impact = await getCoachDeletionImpact(adminCtx(clubId), target);
    const byTeam = Object.fromEntries(impact.map((i) => [i.teamId, i]));
    expect(byTeam[solo]).toMatchObject({ willBeCoachless: true, remainingCoachName: null });
    expect(byTeam[shared]).toMatchObject({ willBeCoachless: false });
    expect(byTeam[shared].remainingCoachName).toBeTruthy();
  });

  it("clears this club's assignments (teams survive), revokes access, audits", async () => {
    const clubId = await makeClub();
    const teamId = await makeTeam(clubId);
    const userId = uid();
    await prisma.user.create({ data: { id: userId, email: `c-${userId}@it.test`, firstName: "Del", lastName: "Coach" } });
    createdUsers.push(userId);
    await prisma.userRoleAssignment.create({ data: { userId, roleId: await roleId("COACH"), clubId, status: "ACTIVE" } });
    await prisma.teamCoach.create({ data: { clubId, teamId, userId, roleType: "HEAD_COACH", status: "ACTIVE" } });
    await prisma.session.create({ data: { userId, token: uid(), expiresAt: new Date(Date.now() + 3_600_000) } });

    await deleteCoach(adminCtx(clubId), userId);

    expect(await prisma.teamCoach.count({ where: { userId, clubId } })).toBe(0);
    expect(await prisma.userRoleAssignment.count({ where: { userId, status: "ACTIVE" } })).toBe(0);
    expect(await prisma.team.findUnique({ where: { id: teamId } })).toBeTruthy(); // team survives
    expect(await prisma.user.findUnique({ where: { id: userId } })).toBeTruthy(); // login row survives
    expect(await prisma.session.count({ where: { userId } })).toBe(0); // access revoked
    expect(await prisma.auditLog.count({ where: { clubId, action: "coach.delete", resourceId: userId } })).toBe(1);
  });

  it("keeps sessions when the login holds another active role (also a club admin)", async () => {
    const clubId = await makeClub();
    const teamId = await makeTeam(clubId);
    const userId = uid();
    await prisma.user.create({ data: { id: userId, email: `c-${userId}@it.test`, firstName: "Multi", lastName: "Role" } });
    createdUsers.push(userId);
    await prisma.userRoleAssignment.createMany({
      data: [
        { userId, roleId: await roleId("COACH"), clubId, status: "ACTIVE" },
        { userId, roleId: await roleId("CLUB_ADMIN"), clubId, status: "ACTIVE" },
      ],
    });
    await prisma.teamCoach.create({ data: { clubId, teamId, userId, roleType: "HEAD_COACH", status: "ACTIVE" } });
    await prisma.session.create({ data: { userId, token: uid(), expiresAt: new Date(Date.now() + 3_600_000) } });

    await deleteCoach(adminCtx(clubId), userId);

    expect(await prisma.session.count({ where: { userId } })).toBe(1); // still a club admin
    expect(await prisma.userRoleAssignment.count({ where: { userId, status: "ACTIVE", role: { code: "CLUB_ADMIN" } } })).toBe(1);
  });
});

run("team hard deletion (detach-only)", () => {
  it("detaches players (teamless, not deleted), keeps multi-team memberships, deletes team data, audits counts", async () => {
    const clubId = await makeClub();
    const t1 = await makeTeam(clubId, "T1");
    const t2 = await makeTeam(clubId, "T2");
    const onlyT1 = await makePlayer(clubId, t1);
    const bothTeams = await makePlayer(clubId, t1);
    await prisma.playerTeamMembership.create({ data: { clubId, playerId: bothTeams, teamId: t2, status: "ACTIVE" } });
    // A coach on T1 only + team chat + a team-exclusive event + a club-wide event.
    const coachUser = uid();
    await prisma.user.create({ data: { id: coachUser, email: `c-${coachUser}@it.test`, firstName: "C", lastName: "One" } });
    createdUsers.push(coachUser);
    await prisma.teamCoach.create({ data: { clubId, teamId: t1, userId: coachUser, roleType: "HEAD_COACH", status: "ACTIVE" } });
    await prisma.chat.create({ data: { clubId, teamId: t1, chatType: "TEAM" } });
    const teamEvent = uid();
    const clubEvent = uid();
    await prisma.event.create({ data: { id: teamEvent, clubId, audienceScope: "TEAMS", eventType: "GAME", title: "TeamOnly", startAt: new Date(), endAt: new Date(), timezone: "UTC" } });
    await prisma.eventTeam.create({ data: { clubId, eventId: teamEvent, teamId: t1 } });
    await prisma.event.create({ data: { id: clubEvent, clubId, audienceScope: "CLUB_WIDE", eventType: "MEETING", title: "ClubWide", startAt: new Date(), endAt: new Date(), timezone: "UTC" } });

    await deleteTeam(adminCtx(clubId), t1);

    // Team gone; its data gone.
    expect(await prisma.team.findUnique({ where: { id: t1 } })).toBeNull();
    expect(await prisma.teamCoach.count({ where: { teamId: t1 } })).toBe(0);
    expect(await prisma.chat.count({ where: { teamId: t1 } })).toBe(0);
    expect(await prisma.event.findUnique({ where: { id: teamEvent } })).toBeNull(); // team-exclusive → deleted
    expect(await prisma.event.findUnique({ where: { id: clubEvent } })).toBeTruthy(); // club-wide → survives

    // People survive; detach semantics.
    expect(await prisma.player.findUnique({ where: { id: onlyT1 } })).toBeTruthy();
    expect(await prisma.playerTeamMembership.count({ where: { playerId: onlyT1, status: "ACTIVE" } })).toBe(0); // teamless
    expect(await prisma.playerTeamMembership.count({ where: { playerId: bothTeams, teamId: t2, status: "ACTIVE" } })).toBe(1); // keeps T2
    expect(await prisma.user.findUnique({ where: { id: coachUser } })).toBeTruthy();

    const audit = await prisma.auditLog.findFirst({ where: { clubId, action: "team.delete", resourceId: t1 } });
    const snap = (audit!.metadataJson as { snapshot?: { playersDetached: number; coachesUnassigned: number } } | null)?.snapshot;
    expect(snap?.playersDetached).toBe(2);
    expect(snap?.coachesUnassigned).toBe(1);
  });

  it("multi-team event survives when another team target remains", async () => {
    const clubId = await makeClub();
    const t1 = await makeTeam(clubId, "T1");
    const t2 = await makeTeam(clubId, "T2");
    const eventId = uid();
    await prisma.event.create({ data: { id: eventId, clubId, audienceScope: "TEAMS", eventType: "GAME", title: "Multi", startAt: new Date(), endAt: new Date(), timezone: "UTC" } });
    await prisma.eventTeam.createMany({ data: [
      { clubId, eventId, teamId: t1 },
      { clubId, eventId, teamId: t2 },
    ] });

    await deleteTeam(adminCtx(clubId), t1);

    expect(await prisma.event.findUnique({ where: { id: eventId } })).toBeTruthy(); // survives — still targets t2
    expect(await prisma.eventTeam.count({ where: { eventId, teamId: t1 } })).toBe(0);
    expect(await prisma.eventTeam.count({ where: { eventId, teamId: t2 } })).toBe(1);
  });
});

run("coach remove-from-team (non-destructive — never a delete)", () => {
  it("a coach soft-detaches a player from their own team; the player survives", async () => {
    const clubId = await makeClub();
    const teamA = await makeTeam(clubId, "A");
    const playerId = await makePlayer(clubId);
    const m = await prisma.playerTeamMembership.create({
      data: { clubId, playerId, teamId: teamA, status: "ACTIVE" },
    });

    const coach = coachCtx(clubId, [teamA], [playerId], teamA);
    await removePlayerFromTeam(coach, m.id);

    const after = await prisma.playerTeamMembership.findUnique({ where: { id: m.id } });
    expect(after!.status).toBe("INACTIVE"); // membership ended, not deleted
    expect(after!.leftAt).not.toBeNull();
    // The player record is untouched (becomes teamless, not deleted).
    expect(await prisma.player.findUnique({ where: { id: playerId } })).toBeTruthy();
  });

  it("a coach CANNOT remove a player from a team they do not coach", async () => {
    const clubId = await makeClub();
    const teamA = await makeTeam(clubId, "A");
    const teamB = await makeTeam(clubId, "B");
    const playerId = await makePlayer(clubId);
    const mB = await prisma.playerTeamMembership.create({
      data: { clubId, playerId, teamId: teamB, status: "ACTIVE" },
    });

    const coachOfA = coachCtx(clubId, [teamA], [], teamA); // not assigned to teamB
    await expect(removePlayerFromTeam(coachOfA, mB.id)).rejects.toBeInstanceOf(ForbiddenError);
    // Membership untouched.
    expect((await prisma.playerTeamMembership.findUnique({ where: { id: mB.id } }))!.status).toBe("ACTIVE");
  });
});

run("teamless pool + cross-club RBAC", () => {
  it("listTeamlessPlayers returns only zero-membership players in the club", async () => {
    const clubId = await makeClub();
    const teamId = await makeTeam(clubId);
    const rostered = await makePlayer(clubId, teamId);
    const teamless = await makePlayer(clubId); // no team
    // A teamless player in ANOTHER club must not leak.
    const otherClub = await makeClub();
    const otherTeamless = await makePlayer(otherClub);

    const pool = await listTeamlessPlayers(adminCtx(clubId), clubId);
    const ids = pool.map((p) => p.id);
    expect(ids).toContain(teamless);
    expect(ids).not.toContain(rostered);
    expect(ids).not.toContain(otherTeamless);
    // Safe projection — no PII fields leak.
    const row = pool.find((p) => p.id === teamless)!;
    expect(row).not.toHaveProperty("dateOfBirth");
    expect(row).not.toHaveProperty("medicalNotes");
  });

  it("a Club Admin cannot delete entities in another club", async () => {
    const clubA = await makeClub();
    const clubB = await makeClub();
    const teamB = await makeTeam(clubB);
    const playerB = await makePlayer(clubB, teamB);

    await expect(deletePlayer(adminCtx(clubA), playerB)).rejects.toBeInstanceOf(ForbiddenError);
    await expect(deleteTeam(adminCtx(clubA), teamB)).rejects.toBeInstanceOf(ForbiddenError);
  });
});
