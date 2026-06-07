import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { prisma } from "@/db/client";
import { ForbiddenError } from "@/lib/rbac";
import { ConflictError, createEvent, listScheduleEvents } from "@/modules/events/service";
import { createEventSchema } from "@/modules/events/schemas";

import { INTEGRATION, adminCtx, coachCtx, parentCtx, uid } from "./helpers";

/**
 * DB-backed coverage of the audience model (audienceScope + event_teams),
 * gated on TEST_DATABASE_URL. Verifies who can SEE which events and who can
 * CREATE which audiences. One club, two teams (A, B); a club-wide event, a
 * team-A event, a team-B event, and a multi-team (A+B) event.
 */

/** Build a full CreateEventInput from minimal fields (fills optional keys). */
const evt = (o: {
  title: string;
  eventType: string;
  startAt: Date;
  endAt: Date;
  audienceScope: "CLUB_WIDE" | "TEAMS";
  teamIds: string[];
}) => createEventSchema.parse(o);

const ids = { club: uid(), teamA: uid(), teamB: uid() };
const FROM = new Date(Date.now() - 86_400_000);
const TO = new Date(Date.now() + 14 * 86_400_000);
const at = (days: number) => new Date(Date.now() + days * 86_400_000);

const created: Record<string, string> = {};

const run = INTEGRATION ? describe : describe.skip;

run("schedule audience model", () => {
  beforeAll(async () => {
    await prisma.club.create({ data: { id: ids.club, name: "Audience FC", shortCode: `AUD-${ids.club.slice(0, 8)}` } });
    await prisma.team.createMany({
      data: [
        { id: ids.teamA, clubId: ids.club, name: "Team A", teamCode: `A-${ids.teamA.slice(0, 6)}` },
        { id: ids.teamB, clubId: ids.club, name: "Team B", teamCode: `B-${ids.teamB.slice(0, 6)}` },
      ],
    });

    const admin = adminCtx(ids.club);
    const evClub = await createEvent(admin, ids.club, evt({ title: "Club Picnic", eventType: "CLUB_EVENT", startAt: at(1), endAt: at(1), audienceScope: "CLUB_WIDE", teamIds: [] }));
    const evA = await createEvent(admin, ids.club, evt({ title: "A Practice", eventType: "PRACTICE", startAt: at(2), endAt: at(2), audienceScope: "TEAMS", teamIds: [ids.teamA] }));
    const evB = await createEvent(admin, ids.club, evt({ title: "B Practice", eventType: "PRACTICE", startAt: at(3), endAt: at(3), audienceScope: "TEAMS", teamIds: [ids.teamB] }));
    const evMulti = await createEvent(admin, ids.club, evt({ title: "AB Tournament", eventType: "TOURNAMENT", startAt: at(4), endAt: at(4), audienceScope: "TEAMS", teamIds: [ids.teamA, ids.teamB] }));
    created.club = evClub.id;
    created.a = evA.id;
    created.b = evB.id;
    created.multi = evMulti.id;
  });

  afterAll(async () => {
    await prisma.eventTeam.deleteMany({ where: { clubId: ids.club } });
    await prisma.event.deleteMany({ where: { clubId: ids.club } });
    await prisma.auditLog.deleteMany({ where: { clubId: ids.club } });
    await prisma.team.deleteMany({ where: { clubId: ids.club } });
    await prisma.club.deleteMany({ where: { id: ids.club } });
    await prisma.$disconnect();
  });

  const titles = async (ctx: Parameters<typeof listScheduleEvents>[0]["actor"]) =>
    (await listScheduleEvents({ actor: ctx, from: FROM, to: TO })).map((e) => e.title).sort();

  it("createEvent persisted exactly one event_teams row per targeted team", async () => {
    const a = await prisma.eventTeam.findMany({ where: { eventId: created.a } });
    const club = await prisma.eventTeam.findMany({ where: { eventId: created.club } });
    const multi = await prisma.eventTeam.findMany({ where: { eventId: created.multi } });
    expect(a.map((r) => r.teamId)).toEqual([ids.teamA]);
    expect(club).toHaveLength(0); // CLUB_WIDE → no rows
    expect(multi.map((r) => r.teamId).sort()).toEqual([ids.teamA, ids.teamB].sort());
  });

  it("Club Admin sees every club event (club-wide + every team)", async () => {
    expect(await titles(adminCtx(ids.club))).toEqual(["A Practice", "AB Tournament", "B Practice", "Club Picnic"]);
  });

  it("Coach sees only assigned-team events + club-wide, never another coach's team", async () => {
    const coachA = coachCtx(ids.club, [ids.teamA], []);
    expect(await titles(coachA)).toEqual(["A Practice", "AB Tournament", "Club Picnic"]);
    expect(await titles(coachA)).not.toContain("B Practice");
  });

  it("Parent sees only linked children's teams' events + club-wide", async () => {
    const parentA = parentCtx(ids.club, [uid()], [ids.teamA]);
    expect(await titles(parentA)).toEqual(["A Practice", "AB Tournament", "Club Picnic"]);
    expect(await titles(parentA)).not.toContain("B Practice");
  });

  it("a multi-team event is visible to coaches/parents of ALL targeted teams and none outside", async () => {
    const coachB = coachCtx(ids.club, [ids.teamB], []);
    const parentB = parentCtx(ids.club, [uid()], [ids.teamB]);
    expect(await titles(coachB)).toContain("AB Tournament");
    expect(await titles(parentB)).toContain("AB Tournament");
    // An actor on neither team sees only the club-wide event.
    const coachOutsider = coachCtx(ids.club, [uid()], []);
    expect(await titles(coachOutsider)).toEqual(["Club Picnic"]);
  });

  it("Coach CANNOT create a club-wide event", async () => {
    const coachA = coachCtx(ids.club, [ids.teamA], []);
    await expect(
      createEvent(coachA, ids.club, evt({ title: "Coach Club Event", eventType: "CLUB_EVENT", startAt: at(5), endAt: at(5), audienceScope: "CLUB_WIDE", teamIds: [] })),
    ).rejects.toBeInstanceOf(ForbiddenError);
  });

  it("Coach CANNOT target a team they are not assigned to", async () => {
    const coachA = coachCtx(ids.club, [ids.teamA], []);
    await expect(
      createEvent(coachA, ids.club, evt({ title: "Coach Targets B", eventType: "PRACTICE", startAt: at(6), endAt: at(6), audienceScope: "TEAMS", teamIds: [ids.teamB] })),
    ).rejects.toBeInstanceOf(ForbiddenError);
  });

  it("Coach CAN create an event for their assigned team", async () => {
    const coachA = coachCtx(ids.club, [ids.teamA], []);
    const ev = await createEvent(coachA, ids.club, evt({ title: "Coach A Session", eventType: "PRACTICE", startAt: at(7), endAt: at(7), audienceScope: "TEAMS", teamIds: [ids.teamA] }));
    const rows = await prisma.eventTeam.findMany({ where: { eventId: ev.id } });
    expect(rows.map((r) => r.teamId)).toEqual([ids.teamA]);
  });

  it("a TEAMS event with no teams is rejected (ConflictError)", async () => {
    await expect(
      createEvent(adminCtx(ids.club), ids.club, evt({ title: "Empty Teams", eventType: "PRACTICE", startAt: at(8), endAt: at(8), audienceScope: "TEAMS", teamIds: [] })),
    ).rejects.toBeInstanceOf(ConflictError);
  });
});
