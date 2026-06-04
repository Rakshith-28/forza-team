import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { prisma } from "@/db/client";
import type { AuthContext } from "@/lib/rbac";
import { loadAuthContext } from "@/modules/identity/context";
import { applyInvitationGrants, type InvitationForGrants } from "@/modules/identity/invitations";
import { createClub, createSeason, createTeam, updateClubSettings } from "@/modules/clubs/service";
import { createPlayer, inviteParentForPlayer, listLinkedChildren } from "@/modules/roster/service";
import { createAnnouncement, listAnnouncements, publishAnnouncement } from "@/modules/comms/service";
import { createEvent, recordAttendance, submitRsvp } from "@/modules/events/service";
import {
  createCycle,
  createTemplate,
  getOwnChildEvaluationSummary,
  savePlayerEvaluation,
} from "@/modules/evaluations/service";

import { INTEGRATION, adminCtx, uid } from "./helpers";

/**
 * MVP journeys as a service-layer end-to-end against an isolated DB (gated).
 * Walks the cascade and ties each step to mvp_scope.md. Browser-level Playwright
 * E2E is deferred (no headless browser in this environment) — the manual QA
 * checklist in docs/RUNBOOK.md covers the in-browser pass; here we exercise the
 * same operations through the real services the UI calls.
 *
 * The Better Auth signUpEmail step (needs a request context) is represented by
 * directly provisioning the accepted user + applyInvitationGrants — the exact
 * grant path acceptInvitation runs post-signup (unit-tested separately).
 */
const created: { clubId?: string; parentUserId?: string } = {};

const run = INTEGRATION ? describe : describe.skip;

run("MVP journey (service-layer end-to-end)", () => {
  beforeAll(async () => {
    for (const [code, name] of [["MASTER_ADMIN", "Master Admin"], ["CLUB_ADMIN", "Club Manager"], ["PARENT", "Parent / Guardian"]] as const) {
      await prisma.role.upsert({ where: { code }, create: { code, name }, update: {} });
    }
  });

  afterAll(async () => {
    const clubId = created.clubId;
    if (clubId) {
      await prisma.playerEvaluationScore.deleteMany({ where: { playerEvaluation: { clubId } } });
      await prisma.playerEvaluation.deleteMany({ where: { clubId } });
      await prisma.evaluationCriterion.deleteMany({ where: { template: { clubId } } });
      await prisma.evaluationCycle.deleteMany({ where: { clubId } });
      await prisma.evaluationTemplate.deleteMany({ where: { clubId } });
      await prisma.eventRsvp.deleteMany({ where: { clubId } });
      await prisma.attendanceRecord.deleteMany({ where: { clubId } });
      await prisma.event.deleteMany({ where: { clubId } });
      await prisma.announcement.deleteMany({ where: { clubId } });
      await prisma.playerParentLink.deleteMany({ where: { clubId } });
      await prisma.playerTeamMembership.deleteMany({ where: { clubId } });
      await prisma.parent.deleteMany({ where: { clubId } });
      await prisma.invitation.deleteMany({ where: { clubId } });
      await prisma.userRoleAssignment.deleteMany({ where: { clubId } });
      await prisma.player.deleteMany({ where: { clubId } });
      await prisma.team.deleteMany({ where: { clubId } });
      await prisma.season.deleteMany({ where: { clubId } });
      await prisma.clubSetting.deleteMany({ where: { clubId } });
      await prisma.club.deleteMany({ where: { id: clubId } });
    }
    if (created.parentUserId) await prisma.user.deleteMany({ where: { id: created.parentUserId } });
    await prisma.$disconnect();
  });

  it("runs the full onboarding → schedule → eval cascade with correct scope + privacy", async () => {
    // (1) Master Admin creates a club.
    const master: AuthContext = {
      userId: uid(),
      role: "MASTER_ADMIN",
      activeClubId: null,
      coachTeamIds: [],
      coachTeamPlayerIds: [],
      linkedPlayerIds: [],
      childTeamIds: [],
    };
    const club = await createClub(master, { name: "ITJourney", shortCode: `ITJ-${uid().slice(0, 8)}` });
    created.clubId = club.id;
    const admin = adminCtx(club.id);

    // (2) Club Manager creates a season + team.
    const season = await createSeason(admin, club.id, {
      name: "2026 Spring",
      startDate: new Date("2026-03-01"),
      endDate: new Date("2026-06-30"),
    });
    const team = await createTeam(admin, club.id, { name: "U12", teamCode: `U12-${uid().slice(0, 6)}`, seasonId: season.id } as never);

    // (3) Coach/admin adds a player and invites the parent FOR that player.
    const player = await createPlayer(admin, club.id, {
      firstName: "Journey",
      lastName: "Kid",
      primaryPosition: "MID",
      initialTeamId: team.id,
      initialSeasonId: season.id,
    } as never);
    const invitation = await inviteParentForPlayer(admin, {
      email: `journey-parent-${uid()}@it.test`,
      playerId: player.id,
      relationshipType: "GUARDIAN",
      canPickup: true,
      canPay: true,
    } as never);

    // ...parent accepts (Better Auth signup represented directly + the real grant path).
    const invRow = await prisma.invitation.findUniqueOrThrow({ where: { id: invitation.id } });
    const parentUserId = uid();
    created.parentUserId = parentUserId;
    const parentRole = (await prisma.role.findUnique({ where: { code: "PARENT" }, select: { id: true } }))!.id;
    await prisma.user.create({ data: { id: parentUserId, email: invRow.email, firstName: "Journey", lastName: "Parent" } });
    await prisma.userRoleAssignment.create({ data: { userId: parentUserId, roleId: parentRole, clubId: club.id, status: "ACTIVE" } });
    const parent = await prisma.parent.create({
      data: { clubId: club.id, userId: parentUserId, firstName: "Journey", lastName: "Parent", email: invRow.email, status: "ACTIVE" },
    });
    await prisma.$transaction((tx) =>
      applyInvitationGrants(tx, { invitation: invRow as unknown as InvitationForGrants, userId: parentUserId, parentId: parent.id }),
    );

    // Parent's single login surfaces the linked child + team (real scope derivation).
    const parentCtx = (await loadAuthContext(parentUserId, club.id))!;
    expect(parentCtx.linkedPlayerIds).toContain(player.id);
    expect(parentCtx.childTeamIds).toContain(team.id);
    const kids = await listLinkedChildren(parentCtx);
    expect(kids.map((k) => k.id)).toContain(player.id);

    // (4) Announcement + event; parent RSVPs; staff records attendance.
    const ann = await createAnnouncement(admin, club.id, { title: "Welcome", body: "Season starts!", audienceType: "TEAM_ONLY", teamId: team.id } as never);
    await publishAnnouncement(admin, ann.id);
    const parentFeed = await listAnnouncements(parentCtx, club.id);
    expect(parentFeed.map((a) => a.id)).toContain(ann.id);

    const event = await createEvent(admin, club.id, {
      title: "Practice",
      eventType: "PRACTICE",
      teamId: team.id,
      startAt: new Date(Date.now() + 86_400_000),
      endAt: new Date(Date.now() + 90_000_000),
    } as never);
    await submitRsvp(parentCtx, event.id, { playerId: player.id, responseStatus: "GOING", comment: undefined });
    const rsvps = await prisma.eventRsvp.findMany({ where: { eventId: event.id, playerId: player.id } });
    expect(rsvps).toHaveLength(1);
    expect(rsvps[0].responseStatus).toBe("GOING");

    await recordAttendance(admin, event.id, { entries: [{ playerId: player.id, attendanceStatus: "PRESENT", notes: undefined }] });
    const att = await prisma.attendanceRecord.findFirst({ where: { eventId: event.id, playerId: player.id } });
    expect(att?.attendanceStatus).toBe("PRESENT");

    // (5) Evaluation; (6) parent sees ONLY the permitted summary, gated by the setting.
    const template = await createTemplate(admin, club.id, { name: "Default", description: undefined });
    const cycle = await createCycle(admin, club.id, {
      name: "Mid",
      cycleType: "MIDSEASON",
      teamId: team.id,
      startsAt: new Date(Date.now() - 1000),
      endsAt: new Date(Date.now() + 1_000_000),
    } as never);
    const criteria = await prisma.evaluationCriterion.findMany({ where: { templateId: template.id } });
    await savePlayerEvaluation(admin, {
      playerId: player.id,
      teamId: team.id,
      evaluationCycleId: cycle.id,
      templateId: template.id,
      scores: criteria.map((c) => ({ criterionId: c.id, rawScore: 7 })),
      summaryComment: "Great start",
      parentVisibleNotes: "Work on first touch",
      coachOnlyNotes: "SECRET — select squad",
    } as never);

    // Gate OFF (default) → parent denied.
    await expect(getOwnChildEvaluationSummary(parentCtx, player.id)).rejects.toBeTruthy();
    // Gate ON → summary visible, coach-only notes never leak.
    await updateClubSettings(admin, club.id, {
      showPlayerPhotosToParents: false,
      allowParentChildEvaluationView: true,
      attendanceTrackingEnabled: true,
      allowCoachInviteParents: true,
    });
    const summaries = await getOwnChildEvaluationSummary(parentCtx, player.id);
    expect(summaries.length).toBeGreaterThan(0);
    expect(JSON.stringify(summaries)).not.toContain("SECRET");
  });
});
