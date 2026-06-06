import "server-only";

import { prisma } from "@/db/client";
import { Prisma } from "@/db/generated/client";
import { recordAudit } from "@/lib/audit";
import {
  assertCan,
  assertClubScope,
  assertTeamScope,
  ForbiddenError,
  type AuthContext,
} from "@/lib/rbac";
import type {
  BulkAttendanceInput,
  CreateEventInput,
  RsvpInput,
  UpdateEventInput,
} from "@/modules/events/schemas";

/**
 * Events module service layer — AUTHORITATIVE for authorization, tenant/team
 * scoping, validation, upserts, and audit for events, RSVP, and attendance
 * (BUILD_PLAN §2, RBAC matrix §6.12–6.14).
 *
 * Times are stored as TIMESTAMPTZ; each event carries a `timezone` (falling back
 * to the club timezone) that the UI renders in. RSVP and attendance writes are
 * upserts keyed on (event_id, player_id) — never duplicated.
 */

export class ConflictError extends Error {
  readonly code = "CONFLICT";
  constructor(message: string) {
    super(message);
    this.name = "ConflictError";
  }
}

function isClubLevel(ctx: AuthContext): boolean {
  return ctx.role === "MASTER_ADMIN" || ctx.role === "CLUB_ADMIN";
}

function requireActiveClub(ctx: AuthContext): string {
  if (!ctx.activeClubId) throw new ForbiddenError("No active club in context");
  return ctx.activeClubId;
}

async function assertTeamInClub(teamId: string, clubId: string): Promise<void> {
  const team = await prisma.team.findFirst({ where: { id: teamId, clubId, deletedAt: null }, select: { id: true } });
  if (!team) throw new ForbiddenError("Team does not belong to this club");
}

/** Manage (create/edit/cancel). Club-wide events (no team) are admin-only. */
function assertEventManage(ctx: AuthContext, clubId: string, teamId: string | null | undefined): void {
  if (teamId == null) {
    if (!isClubLevel(ctx)) throw new ForbiddenError("Only admins can manage club-wide events");
    assertCan(ctx, "events.manage", { clubId });
  } else {
    assertCan(ctx, "events.manage", { clubId, teamId });
  }
}

// ===========================================================================
// Events
// ===========================================================================

/** Where-clause scoping events to what the caller may view. */
function eventViewWhere(ctx: AuthContext, clubId: string): Prisma.EventWhereInput {
  const base: Prisma.EventWhereInput = { clubId };
  if (isClubLevel(ctx)) return base;
  if (ctx.role === "COACH") {
    return { ...base, OR: [{ teamId: { in: ctx.coachTeamIds } }, { teamId: null }] };
  }
  // PARENT — linked children's teams + club-wide events.
  return { ...base, OR: [{ teamId: { in: ctx.childTeamIds } }, { teamId: null }] };
}

export async function listEvents(
  ctx: AuthContext,
  clubId: string,
  opts: { teamId?: string; from?: Date; to?: Date; upcomingOnly?: boolean; limit?: number } = {},
) {
  assertCan(ctx, "events.view", { clubId });
  const where = eventViewWhere(ctx, clubId);
  if (opts.teamId) {
    // Narrow to one team, still bounded by the caller's view scope above.
    where.AND = [{ teamId: opts.teamId }];
  }
  if (opts.from || opts.to || opts.upcomingOnly) {
    where.startAt = {
      ...(opts.upcomingOnly ? { gte: new Date() } : {}),
      ...(opts.from ? { gte: opts.from } : {}),
      ...(opts.to ? { lte: opts.to } : {}),
    };
  }
  return prisma.event.findMany({
    where,
    orderBy: { startAt: opts.upcomingOnly ? "asc" : "desc" },
    take: opts.limit,
    include: { team: { select: { id: true, name: true } } },
  });
}

export async function getEvent(ctx: AuthContext, eventId: string) {
  const event = await prisma.event.findUnique({
    where: { id: eventId },
    include: { team: { select: { id: true, name: true } } },
  });
  if (!event) return null;
  assertClubScope(ctx, event.clubId);
  if (!canViewEvent(ctx, event.teamId)) throw new ForbiddenError("Event is outside your scope");
  return event;
}

function canViewEvent(ctx: AuthContext, teamId: string | null): boolean {
  if (isClubLevel(ctx)) return true;
  if (teamId == null) return true; // club-wide visible to members
  if (ctx.role === "COACH") return ctx.coachTeamIds.includes(teamId);
  return ctx.childTeamIds.includes(teamId);
}

export async function createEvent(ctx: AuthContext, clubId: string, input: CreateEventInput) {
  const teamId = input.teamId ?? null;
  assertEventManage(ctx, clubId, teamId);
  if (teamId) await assertTeamInClub(teamId, clubId);

  const club = await prisma.club.findUnique({ where: { id: clubId }, select: { timezone: true } });
  const timezone = input.timezone ?? club?.timezone ?? "America/New_York";

  return prisma.$transaction(async (tx) => {
    const event = await tx.event.create({
      data: {
        clubId,
        teamId,
        eventType: input.eventType,
        title: input.title,
        description: input.description ?? null,
        startAt: input.startAt,
        endAt: input.endAt,
        timezone,
        locationName: input.locationName ?? null,
        addressLine1: input.addressLine1 ?? null,
        city: input.city ?? null,
        state: input.state ?? null,
        postalCode: input.postalCode ?? null,
        opponentName: input.opponentName ?? null,
        homeAway: input.homeAway ?? null,
        arrivalTime: input.arrivalTime ?? null,
        uniformNotes: input.uniformNotes ?? null,
        status: "SCHEDULED",
        createdBy: ctx.userId,
      },
    });
    await recordAudit(tx, {
      action: "event.create",
      resourceType: "event",
      resourceId: event.id,
      clubId,
      actorUserId: ctx.userId,
      metadata: { eventType: event.eventType, teamId },
    });
    return event;
  });
}

export async function updateEvent(ctx: AuthContext, eventId: string, input: UpdateEventInput) {
  const event = await prisma.event.findUnique({ where: { id: eventId } });
  if (!event) throw new ForbiddenError("Event not found");
  const newTeamId = input.teamId ?? null;
  // Must be allowed to manage both the current and the proposed team scope.
  assertEventManage(ctx, event.clubId, event.teamId);
  assertEventManage(ctx, event.clubId, newTeamId);
  if (newTeamId) await assertTeamInClub(newTeamId, event.clubId);

  return prisma.$transaction(async (tx) => {
    const updated = await tx.event.update({
      where: { id: eventId },
      data: {
        teamId: newTeamId,
        eventType: input.eventType,
        title: input.title,
        description: input.description ?? null,
        startAt: input.startAt,
        endAt: input.endAt,
        timezone: input.timezone ?? event.timezone,
        locationName: input.locationName ?? null,
        addressLine1: input.addressLine1 ?? null,
        city: input.city ?? null,
        state: input.state ?? null,
        postalCode: input.postalCode ?? null,
        opponentName: input.opponentName ?? null,
        homeAway: input.homeAway ?? null,
        arrivalTime: input.arrivalTime ?? null,
        uniformNotes: input.uniformNotes ?? null,
        status: input.status,
        updatedAt: new Date(),
        updatedBy: ctx.userId,
      },
    });
    return updated;
  });
}

export async function cancelEvent(ctx: AuthContext, eventId: string) {
  const event = await prisma.event.findUnique({ where: { id: eventId } });
  if (!event) throw new ForbiddenError("Event not found");
  assertEventManage(ctx, event.clubId, event.teamId);

  return prisma.$transaction(async (tx) => {
    const cancelled = await tx.event.update({
      where: { id: eventId },
      data: { status: "CANCELLED", updatedAt: new Date(), updatedBy: ctx.userId },
    });
    await recordAudit(tx, {
      action: "event.cancel",
      resourceType: "event",
      resourceId: eventId,
      clubId: event.clubId,
      actorUserId: ctx.userId,
    });
    return cancelled;
  });
}

// ===========================================================================
// RSVP (upsert per event+player)
// ===========================================================================

/** A team event's players must belong to that team; club-wide events accept any club player. */
async function assertPlayerParticipates(playerId: string, clubId: string, teamId: string | null): Promise<void> {
  const player = await prisma.player.findFirst({ where: { id: playerId, clubId, deletedAt: null }, select: { id: true } });
  if (!player) throw new ForbiddenError("Player is not in this club");
  if (teamId) {
    const membership = await prisma.playerTeamMembership.findFirst({
      where: { playerId, teamId, status: "ACTIVE" },
      select: { id: true },
    });
    if (!membership) throw new ForbiddenError("Player is not on this event's team");
  }
}

export async function submitRsvp(ctx: AuthContext, eventId: string, input: RsvpInput) {
  const event = await prisma.event.findUnique({
    where: { id: eventId },
    select: { clubId: true, teamId: true, status: true },
  });
  if (!event) throw new ForbiddenError("Event not found");
  // Parent → own child only; admin/coach may override (scope-checked by permission).
  assertCan(ctx, "rsvp.respond_own_child", { clubId: event.clubId, playerId: input.playerId });
  await assertPlayerParticipates(input.playerId, event.clubId, event.teamId);

  return prisma.eventRsvp.upsert({
    where: { uq_event_rsvp: { eventId, playerId: input.playerId } },
    create: {
      clubId: event.clubId,
      eventId,
      playerId: input.playerId,
      respondedByUserId: ctx.userId,
      responseStatus: input.responseStatus,
      comment: input.comment ?? null,
    },
    update: {
      respondedByUserId: ctx.userId,
      responseStatus: input.responseStatus,
      comment: input.comment ?? null,
      respondedAt: new Date(),
    },
  });
}

/** Staff RSVP summary for an event: counts + per-player responses. */
export async function getRsvpSummary(ctx: AuthContext, eventId: string) {
  const event = await prisma.event.findUnique({ where: { id: eventId }, select: { clubId: true, teamId: true } });
  if (!event) throw new ForbiddenError("Event not found");
  assertCan(ctx, "events.view", { clubId: event.clubId, teamId: event.teamId ?? undefined });
  if (ctx.role === "PARENT") throw new ForbiddenError("Parents see only their own child's RSVP");

  const rsvps = await prisma.eventRsvp.findMany({
    where: { eventId },
    include: { player: { select: { id: true, firstName: true, lastName: true } } },
  });
  const counts = { GOING: 0, NOT_GOING: 0, MAYBE: 0, LATE: 0 } as Record<string, number>;
  for (const r of rsvps) counts[r.responseStatus] = (counts[r.responseStatus] ?? 0) + 1;
  return { counts, responses: rsvps };
}

// ===========================================================================
// Attendance (staff-only; upsert per event+player; bulk-friendly)
// ===========================================================================

export async function recordAttendance(ctx: AuthContext, eventId: string, input: BulkAttendanceInput) {
  const event = await prisma.event.findUnique({
    where: { id: eventId },
    select: { clubId: true, teamId: true },
  });
  if (!event) throw new ForbiddenError("Event not found");
  assertCan(ctx, "attendance.record", { clubId: event.clubId, teamId: event.teamId ?? undefined });

  return prisma.$transaction(async (tx) => {
    for (const entry of input.entries) {
      await tx.attendanceRecord.upsert({
        where: { uq_attendance_record: { eventId, playerId: entry.playerId } },
        create: {
          clubId: event.clubId,
          eventId,
          playerId: entry.playerId,
          recordedByUserId: ctx.userId,
          attendanceStatus: entry.attendanceStatus,
          notes: entry.notes ?? null,
        },
        update: {
          recordedByUserId: ctx.userId,
          attendanceStatus: entry.attendanceStatus,
          notes: entry.notes ?? null,
          recordedAt: new Date(),
        },
      });
    }
    await recordAudit(tx, {
      action: "attendance.record",
      resourceType: "event",
      resourceId: eventId,
      clubId: event.clubId,
      actorUserId: ctx.userId,
      metadata: { count: input.entries.length, teamId: event.teamId },
    });
    return { recorded: input.entries.length };
  });
}

/** Staff attendance summary for an event (counts + per-player). */
export async function getAttendanceSummary(ctx: AuthContext, eventId: string) {
  const event = await prisma.event.findUnique({ where: { id: eventId }, select: { clubId: true, teamId: true } });
  if (!event) throw new ForbiddenError("Event not found");
  assertCan(ctx, "attendance.view_team", { clubId: event.clubId, teamId: event.teamId ?? undefined });

  const records = await prisma.attendanceRecord.findMany({
    where: { eventId },
    include: { player: { select: { id: true, firstName: true, lastName: true } } },
  });
  return records;
}

/** Parent (or staff) view of a single child's attendance history. Own child only for parents. */
export async function getChildAttendance(ctx: AuthContext, playerId: string) {
  const player = await prisma.player.findFirst({ where: { id: playerId, deletedAt: null }, select: { clubId: true } });
  if (!player) throw new ForbiddenError("Player not found");
  if (ctx.role === "PARENT") {
    assertCan(ctx, "attendance.view_own_child", { clubId: player.clubId, playerId });
  } else {
    assertCan(ctx, "attendance.view_team", { clubId: player.clubId });
  }
  return prisma.attendanceRecord.findMany({
    where: { playerId },
    orderBy: { recordedAt: "desc" },
    include: { event: { select: { id: true, title: true, startAt: true, eventType: true, timezone: true } } },
  });
}

// ===========================================================================
// Attendance — dedicated team roster summary + per-player record (staff)
// ===========================================================================

export interface TeamAttendanceRow {
  playerId: string;
  name: string;
  /** Events on this team where the player was PRESENT or LATE. */
  attended: number;
  /** Events on this team where attendance was recorded for the player. */
  total: number;
  /** attended/total as a percentage, or null when nothing has been recorded yet. */
  pct: number | null;
}

/**
 * Per-player attendance summary across a team's events (the Attendance section,
 * separate from Schedule). Staff-only; a coach must be assigned to the team.
 * "Attended" counts PRESENT or LATE (mirrors the parent dashboard ring).
 */
export async function listTeamAttendance(ctx: AuthContext, teamId: string): Promise<TeamAttendanceRow[]> {
  const team = await prisma.team.findFirst({ where: { id: teamId, deletedAt: null }, select: { clubId: true } });
  if (!team) throw new ForbiddenError("Team not found");
  assertTeamScope(ctx, { clubId: team.clubId, teamId });

  const memberships = await prisma.playerTeamMembership.findMany({
    where: { teamId, clubId: team.clubId, status: "ACTIVE" },
    select: { player: { select: { id: true, firstName: true, lastName: true, preferredName: true } } },
    orderBy: { player: { lastName: "asc" } },
  });
  const players = memberships.map((m) => m.player);
  if (players.length === 0) return [];

  const records = await prisma.attendanceRecord.findMany({
    where: { playerId: { in: players.map((p) => p.id) }, event: { teamId } },
    select: { playerId: true, attendanceStatus: true },
  });
  const agg = new Map<string, { attended: number; total: number }>();
  for (const r of records) {
    const cur = agg.get(r.playerId) ?? { attended: 0, total: 0 };
    cur.total += 1;
    if (r.attendanceStatus === "PRESENT" || r.attendanceStatus === "LATE") cur.attended += 1;
    agg.set(r.playerId, cur);
  }
  return players.map((p) => {
    const a = agg.get(p.id) ?? { attended: 0, total: 0 };
    return {
      playerId: p.id,
      name: p.preferredName ?? `${p.firstName} ${p.lastName}`,
      attended: a.attended,
      total: a.total,
      pct: a.total > 0 ? Math.round((a.attended / a.total) * 100) : null,
    };
  });
}

/**
 * One player's full event-by-event attendance record, for the staff drill-down.
 * Scoped via roster.view_full (admin club-wide; coach assigned-team players only).
 */
export async function getPlayerAttendanceForStaff(ctx: AuthContext, playerId: string) {
  const player = await prisma.player.findFirst({
    where: { id: playerId, deletedAt: null },
    select: { id: true, clubId: true, firstName: true, lastName: true, preferredName: true },
  });
  if (!player) throw new ForbiddenError("Player not found");
  assertCan(ctx, "roster.view_full", { clubId: player.clubId, playerId });

  const records = await prisma.attendanceRecord.findMany({
    where: { playerId },
    orderBy: { recordedAt: "desc" },
    include: {
      event: { select: { id: true, title: true, startAt: true, eventType: true, timezone: true, team: { select: { name: true } } } },
    },
  });
  return { player, records };
}

// ===========================================================================
// Parent multi-child schedule aggregation
// ===========================================================================

export interface ParentScheduleEntry {
  event: {
    id: string;
    title: string;
    eventType: string;
    teamId: string | null;
    teamName: string | null;
    startAt: string;
    endAt: string;
    timezone: string;
    locationName: string | null;
    status: string;
  };
  children: { playerId: string; name: string; rsvpStatus: string | null }[];
}

/**
 * Aggregated schedule for a parent across ALL linked children: events on any
 * linked child's team plus club-wide events, de-duplicated (one row per event),
 * each carrying the relevant children and that child's RSVP.
 */
export async function listParentSchedule(
  ctx: AuthContext,
  opts: { upcomingOnly?: boolean; limit?: number } = {},
): Promise<ParentScheduleEntry[]> {
  if (ctx.role !== "PARENT") throw new ForbiddenError("Parent schedule is for parents");
  const clubId = requireActiveClub(ctx);
  if (ctx.linkedPlayerIds.length === 0) return [];

  const players = await prisma.player.findMany({
    where: { id: { in: ctx.linkedPlayerIds }, deletedAt: null },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      preferredName: true,
      teamMemberships: { where: { status: "ACTIVE" }, select: { teamId: true } },
    },
  });
  const childTeamSet = new Map<string, Set<string>>(); // playerId -> set of teamIds
  for (const p of players) childTeamSet.set(p.id, new Set(p.teamMemberships.map((m) => m.teamId)));

  const where: Prisma.EventWhereInput = {
    clubId,
    OR: [{ teamId: { in: ctx.childTeamIds } }, { teamId: null }],
  };
  if (opts.upcomingOnly) where.startAt = { gte: new Date() };

  const events = await prisma.event.findMany({
    where,
    orderBy: { startAt: opts.upcomingOnly ? "asc" : "desc" },
    take: opts.limit,
    include: { team: { select: { id: true, name: true } } },
  });
  if (events.length === 0) return [];

  const rsvps = await prisma.eventRsvp.findMany({
    where: { eventId: { in: events.map((e) => e.id) }, playerId: { in: ctx.linkedPlayerIds } },
    select: { eventId: true, playerId: true, responseStatus: true },
  });
  const rsvpMap = new Map<string, string>(); // `${eventId}:${playerId}` -> status
  for (const r of rsvps) rsvpMap.set(`${r.eventId}:${r.playerId}`, r.responseStatus);

  return events.map((e) => {
    const relevant = players.filter((p) =>
      e.teamId == null ? true : childTeamSet.get(p.id)?.has(e.teamId),
    );
    return {
      event: {
        id: e.id,
        title: e.title,
        eventType: e.eventType,
        teamId: e.teamId,
        teamName: e.team?.name ?? null,
        startAt: e.startAt.toISOString(),
        endAt: e.endAt.toISOString(),
        timezone: e.timezone,
        locationName: e.locationName,
        status: e.status,
      },
      children: relevant.map((p) => ({
        playerId: p.id,
        name: p.preferredName ?? `${p.firstName} ${p.lastName}`,
        rsvpStatus: rsvpMap.get(`${e.id}:${p.id}`) ?? null,
      })),
    };
  });
}

// ===========================================================================
// Dashboard feeds
// ===========================================================================

/** Upcoming events for the coach/admin dashboards (role-scoped). */
export function listUpcomingEvents(ctx: AuthContext, clubId: string, limit = 5) {
  return listEvents(ctx, clubId, { upcomingOnly: true, limit });
}

/** Count of past team events still missing attendance — coach dashboard "to-do". */
export async function countEventsNeedingAttendance(ctx: AuthContext, clubId: string): Promise<number> {
  assertCan(ctx, "attendance.view_team", { clubId });
  const where: Prisma.EventWhereInput = {
    clubId,
    endAt: { lt: new Date() },
    status: { notIn: ["CANCELLED"] },
    attendanceRecords: { none: {} },
  };
  if (ctx.role === "COACH") where.teamId = { in: ctx.coachTeamIds };
  else where.teamId = { not: null };
  return prisma.event.count({ where });
}
