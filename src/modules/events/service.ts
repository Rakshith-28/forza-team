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
  AudienceScope,
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
 * Event audience is resolved through `audienceScope` + `event_teams`
 * (canonical) — NOT `events.team_id`, which is deprecated and never read here.
 * `audienceScope = 'CLUB_WIDE'` is visible to everyone in the club;
 * `'TEAMS'` is visible only to actors whose accessible teams intersect the
 * event's `event_teams` rows.
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

/** The teams (other than club-wide) an actor can see events for. */
function actorTeamIds(ctx: AuthContext): string[] {
  if (ctx.role === "COACH") return ctx.coachTeamIds;
  if (ctx.role === "PARENT") return ctx.childTeamIds;
  return []; // club-level actors are handled separately (they see everything)
}

async function assertTeamInClub(teamId: string, clubId: string): Promise<void> {
  const team = await prisma.team.findFirst({ where: { id: teamId, clubId, deletedAt: null }, select: { id: true } });
  if (!team) throw new ForbiddenError("Team does not belong to this club");
}

// ===========================================================================
// Audience model — resolution, view scoping, and write gating
// ===========================================================================

export interface AccessibleAudience {
  clubId: string;
  /** Teams whose TEAMS-scoped events this actor may see. */
  teamIds: string[];
  /** Whether the actor sees CLUB_WIDE events (everyone in a club does). */
  seesClubWide: boolean;
}

/**
 * The audience an actor can access in their active club: their team set plus
 * club-wide visibility. Club-level admins resolve to every team in the club.
 */
export async function resolveAccessibleAudience(ctx: AuthContext): Promise<AccessibleAudience> {
  const clubId = requireActiveClub(ctx);
  if (isClubLevel(ctx)) {
    const teams = await prisma.team.findMany({ where: { clubId, deletedAt: null }, select: { id: true } });
    return { clubId, teamIds: teams.map((t) => t.id), seesClubWide: true };
  }
  return { clubId, teamIds: actorTeamIds(ctx), seesClubWide: true };
}

/** Where-clause scoping events to what the caller may view (audience model). */
function audienceWhere(ctx: AuthContext, clubId: string): Prisma.EventWhereInput {
  if (isClubLevel(ctx)) return { clubId }; // admins see every event in their club
  const teamIds = actorTeamIds(ctx);
  return {
    clubId,
    OR: [
      { audienceScope: "CLUB_WIDE" },
      { audienceScope: "TEAMS", eventTeams: { some: { teamId: { in: teamIds } } } },
    ],
  };
}

/** Whether a resolved event (its audience + targeted teams) is visible to ctx. */
function canViewEventAudience(ctx: AuthContext, audienceScope: string, eventTeamIds: string[]): boolean {
  if (isClubLevel(ctx)) return true;
  if (audienceScope === "CLUB_WIDE") return true;
  const teamIds = actorTeamIds(ctx);
  return eventTeamIds.some((t) => teamIds.includes(t));
}

/**
 * Normalize the (audienceScope + teamIds) audience, accepting the legacy single
 * `teamId` from the old form for back-compat. Coach gating happens separately.
 */
function normalizeAudience(input: {
  audienceScope?: AudienceScope;
  teamIds?: string[];
  teamId?: string | null;
}): { audienceScope: AudienceScope; teamIds: string[] } {
  if (input.audienceScope) {
    return {
      audienceScope: input.audienceScope,
      teamIds: input.audienceScope === "TEAMS" ? unique(input.teamIds ?? []) : [],
    };
  }
  // Legacy: a single teamId (null = club-wide).
  const t = input.teamId ?? null;
  return t == null ? { audienceScope: "CLUB_WIDE", teamIds: [] } : { audienceScope: "TEAMS", teamIds: [t] };
}

/**
 * Gate who may write an event with this audience (create/edit/cancel):
 *  - CLUB_WIDE → club-level admins only.
 *  - TEAMS → at least one team; the actor must hold events.manage on EVERY
 *    targeted team (coaches are thereby limited to their assigned teams; admins
 *    pass for any team in the club).
 */
function assertAudienceWritable(
  ctx: AuthContext,
  clubId: string,
  audienceScope: AudienceScope,
  teamIds: string[],
): void {
  if (audienceScope === "CLUB_WIDE") {
    if (!isClubLevel(ctx)) throw new ForbiddenError("Only admins can manage club-wide events");
    assertCan(ctx, "events.manage", { clubId });
    return;
  }
  if (teamIds.length === 0) throw new ConflictError("Select at least one team for a team event");
  for (const teamId of teamIds) {
    assertCan(ctx, "events.manage", { clubId, teamId });
  }
}

function unique<T>(items: T[]): T[] {
  return [...new Set(items)];
}

// ===========================================================================
// Events — shared shapes / mappers
// ===========================================================================

type EventTeamWithName = { teamId: string; team: { id: string; name: string } | null };

/** Event row shape with eager-loaded targeted teams (for badges/derivation). */
const eventWithTeams = {
  include: { eventTeams: { include: { team: { select: { id: true, name: true } } } } },
} satisfies Prisma.EventDefaultArgs;
type EventWithTeams = Prisma.EventGetPayload<typeof eventWithTeams>;

function teamTags(eventTeams: EventTeamWithName[]): { id: string; name: string }[] {
  return eventTeams
    .map((et) => et.team)
    .filter((t): t is { id: string; name: string } => t != null);
}

/** First targeted team — back-compat for legacy single-team UI (derived, never team_id). */
function firstTeam(eventTeams: EventTeamWithName[]): { id: string; name: string } | null {
  return teamTags(eventTeams)[0] ?? null;
}

export interface ScheduleEvent {
  id: string;
  clubId: string;
  title: string;
  eventType: string;
  audienceScope: string;
  startAt: string;
  endAt: string;
  timezone: string;
  locationName: string | null;
  status: string;
  /** Targeted teams (empty for CLUB_WIDE). */
  teams: { id: string; name: string }[];
}

function toScheduleEvent(e: EventWithTeams): ScheduleEvent {
  return {
    id: e.id,
    clubId: e.clubId,
    title: e.title,
    eventType: e.eventType,
    audienceScope: e.audienceScope,
    startAt: e.startAt.toISOString(),
    endAt: e.endAt.toISOString(),
    timezone: e.timezone,
    locationName: e.locationName,
    status: e.status,
    teams: teamTags(e.eventTeams),
  };
}

/** Legacy event shape (adds a derived single `team`/`teamId` from event_teams). */
function withDerivedTeam<T extends EventWithTeams>(e: T) {
  const t = firstTeam(e.eventTeams);
  return { ...e, team: t, teamId: t?.id ?? null };
}

// ===========================================================================
// Events — listing and retrieval
// ===========================================================================

export async function listEvents(
  ctx: AuthContext,
  clubId: string,
  opts: { teamId?: string; from?: Date; to?: Date; upcomingOnly?: boolean; limit?: number } = {},
) {
  assertCan(ctx, "events.view", { clubId });
  const and: Prisma.EventWhereInput[] = [audienceWhere(ctx, clubId)];
  if (opts.teamId) {
    // Narrow to one team: that team's events plus club-wide (still bounded by scope above).
    and.push({ OR: [{ audienceScope: "CLUB_WIDE" }, { eventTeams: { some: { teamId: opts.teamId } } }] });
  }
  if (opts.from || opts.to || opts.upcomingOnly) {
    and.push({
      startAt: {
        ...(opts.upcomingOnly ? { gte: new Date() } : {}),
        ...(opts.from ? { gte: opts.from } : {}),
        ...(opts.to ? { lte: opts.to } : {}),
      },
    });
  }
  const events = await prisma.event.findMany({
    where: { AND: and },
    orderBy: { startAt: opts.upcomingOnly ? "asc" : "desc" },
    take: opts.limit,
    ...eventWithTeams,
  });
  return events.map(withDerivedTeam);
}

/**
 * Single calendar/list query powering EVERY surface (Console + parent portal):
 * the events visible to `actor` in `[from, to)`, scoped per the audience model,
 * with resolved team tags + status. Eager-loads team names for badges.
 */
export async function listScheduleEvents(args: {
  actor: AuthContext;
  from: Date;
  to: Date;
  filters?: { teamId?: string; teamIds?: string[]; eventType?: string; status?: string };
}): Promise<ScheduleEvent[]> {
  const { actor, from, to, filters = {} } = args;
  const clubId = requireActiveClub(actor);
  assertCan(actor, "events.view", { clubId });

  const and: Prisma.EventWhereInput[] = [
    audienceWhere(actor, clubId),
    { startAt: { gte: from, lt: to } },
  ];
  if (filters.teamId) {
    and.push({ OR: [{ audienceScope: "CLUB_WIDE" }, { eventTeams: { some: { teamId: filters.teamId } } }] });
  }
  // Narrow to a set of teams (e.g. a player's teams) — club-wide always included.
  if (filters.teamIds && filters.teamIds.length > 0) {
    and.push({ OR: [{ audienceScope: "CLUB_WIDE" }, { eventTeams: { some: { teamId: { in: filters.teamIds } } } }] });
  }
  if (filters.eventType) and.push({ eventType: filters.eventType });
  if (filters.status) and.push({ status: filters.status });

  const events = await prisma.event.findMany({
    where: { AND: and },
    orderBy: { startAt: "asc" },
    ...eventWithTeams,
  });
  return events.map(toScheduleEvent);
}

/** RBAC-checked detail fetch (with targeted teams) for the calendar drawer/detail. */
export async function getEventById(args: { actor: AuthContext; eventId: string }) {
  const { actor, eventId } = args;
  const event = await prisma.event.findUnique({ where: { id: eventId }, ...eventWithTeams });
  if (!event) return null;
  assertClubScope(actor, event.clubId);
  if (!canViewEventAudience(actor, event.audienceScope, event.eventTeams.map((et) => et.teamId))) {
    throw new ForbiddenError("Event is outside your scope");
  }
  return withDerivedTeam(event);
}

/** Legacy single-event fetch (kept for current detail page); audience-checked. */
export async function getEvent(ctx: AuthContext, eventId: string) {
  return getEventById({ actor: ctx, eventId });
}

/** Club timezone for the caller's club — used to compute "today" server-side. */
export async function getClubTimezone(ctx: AuthContext, clubId: string): Promise<string> {
  assertClubScope(ctx, clubId);
  const club = await prisma.club.findUnique({ where: { id: clubId }, select: { timezone: true } });
  return club?.timezone ?? "America/New_York";
}

export async function createEvent(ctx: AuthContext, clubId: string, input: CreateEventInput) {
  assertClubScope(ctx, clubId);
  const { audienceScope, teamIds } = normalizeAudience(input);
  assertAudienceWritable(ctx, clubId, audienceScope, teamIds);
  for (const teamId of teamIds) await assertTeamInClub(teamId, clubId);

  const club = await prisma.club.findUnique({ where: { id: clubId }, select: { timezone: true } });
  const timezone = input.timezone ?? club?.timezone ?? "America/New_York";

  return prisma.$transaction(async (tx) => {
    const event = await tx.event.create({
      data: {
        clubId,
        teamId: null, // deprecated — audience lives in audienceScope + event_teams
        audienceScope,
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
    if (teamIds.length > 0) {
      await tx.eventTeam.createMany({
        data: teamIds.map((teamId) => ({ clubId, eventId: event.id, teamId })),
      });
    }
    await recordAudit(tx, {
      action: "event.create",
      resourceType: "event",
      resourceId: event.id,
      clubId,
      actorUserId: ctx.userId,
      metadata: { eventType: event.eventType, audienceScope, teamIds },
    });
    return event;
  });
}

export async function updateEvent(ctx: AuthContext, eventId: string, input: UpdateEventInput) {
  const event = await prisma.event.findUnique({ where: { id: eventId }, ...eventWithTeams });
  if (!event) throw new ForbiddenError("Event not found");
  const current = { audienceScope: event.audienceScope as AudienceScope, teamIds: event.eventTeams.map((et) => et.teamId) };
  const next = normalizeAudience(input);
  // Must be allowed to manage BOTH the current and the proposed audience.
  assertAudienceWritable(ctx, event.clubId, current.audienceScope, current.teamIds);
  assertAudienceWritable(ctx, event.clubId, next.audienceScope, next.teamIds);
  for (const teamId of next.teamIds) await assertTeamInClub(teamId, event.clubId);

  return prisma.$transaction(async (tx) => {
    const updated = await tx.event.update({
      where: { id: eventId },
      data: {
        teamId: null,
        audienceScope: next.audienceScope,
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
    // Replace targeted teams wholesale.
    await tx.eventTeam.deleteMany({ where: { eventId } });
    if (next.teamIds.length > 0) {
      await tx.eventTeam.createMany({
        data: next.teamIds.map((teamId) => ({ clubId: event.clubId, eventId, teamId })),
      });
    }
    await recordAudit(tx, {
      action: "event.update",
      resourceType: "event",
      resourceId: eventId,
      clubId: event.clubId,
      actorUserId: ctx.userId,
      metadata: { audienceScope: next.audienceScope, teamIds: next.teamIds },
    });
    return updated;
  });
}

export async function cancelEvent(ctx: AuthContext, eventId: string) {
  const event = await prisma.event.findUnique({ where: { id: eventId }, ...eventWithTeams });
  if (!event) throw new ForbiddenError("Event not found");
  assertAudienceWritable(ctx, event.clubId, event.audienceScope as AudienceScope, event.eventTeams.map((et) => et.teamId));

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
// Parent-safe serialization
// ===========================================================================

export interface ParentSafeEvent {
  id: string;
  title: string;
  eventType: string;
  audienceScope: string;
  startAt: string;
  endAt: string;
  timezone: string;
  locationName: string | null;
  status: string;
  teams: { id: string; name: string }[];
  /** The linked child's own RSVP — never other children's responses. */
  myRsvp: string | null;
}

/** Shape `toParentSafeEvent` needs: an event with targeted teams + rsvps. */
export interface ParentSafeEventInput {
  id: string;
  title: string;
  eventType: string;
  audienceScope: string;
  startAt: Date;
  endAt: Date;
  timezone: string;
  locationName: string | null;
  status: string;
  eventTeams: EventTeamWithName[];
  rsvps: { playerId: string; responseStatus: string }[];
}

/**
 * Parent-safe projection of an event for a single linked child: exposes only
 * public event fields + team name(s) + that child's own RSVP. Strips
 * description/uniform notes and every OTHER child's RSVP/attendance data — the
 * child-safety guarantee, applied in the data layer (BUILD_PLAN §2).
 */
export function toParentSafeEvent(event: ParentSafeEventInput, opts: { childId: string }): ParentSafeEvent {
  return {
    id: event.id,
    title: event.title,
    eventType: event.eventType,
    audienceScope: event.audienceScope,
    startAt: event.startAt.toISOString(),
    endAt: event.endAt.toISOString(),
    timezone: event.timezone,
    locationName: event.locationName,
    status: event.status,
    teams: teamTags(event.eventTeams),
    myRsvp: event.rsvps.find((r) => r.playerId === opts.childId)?.responseStatus ?? null,
  };
}

// ===========================================================================
// RSVP (upsert per event+player)
// ===========================================================================

/** A team event's players must belong to a targeted team; club-wide accepts any club player. */
async function assertPlayerParticipates(playerId: string, clubId: string, eventTeamIds: string[]): Promise<void> {
  const player = await prisma.player.findFirst({ where: { id: playerId, clubId, deletedAt: null }, select: { id: true } });
  if (!player) throw new ForbiddenError("Player is not in this club");
  if (eventTeamIds.length > 0) {
    const membership = await prisma.playerTeamMembership.findFirst({
      where: { playerId, teamId: { in: eventTeamIds }, status: "ACTIVE" },
      select: { id: true },
    });
    if (!membership) throw new ForbiddenError("Player is not on this event's team");
  }
}

export async function submitRsvp(ctx: AuthContext, eventId: string, input: RsvpInput) {
  const event = await prisma.event.findUnique({
    where: { id: eventId },
    select: { clubId: true, status: true, eventTeams: { select: { teamId: true } } },
  });
  if (!event) throw new ForbiddenError("Event not found");
  // Parent → own child only; admin/coach may override (scope-checked by permission).
  assertCan(ctx, "rsvp.respond_own_child", { clubId: event.clubId, playerId: input.playerId });
  await assertPlayerParticipates(input.playerId, event.clubId, event.eventTeams.map((et) => et.teamId));

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
  const event = await prisma.event.findUnique({
    where: { id: eventId },
    select: { clubId: true, audienceScope: true, eventTeams: { select: { teamId: true } } },
  });
  if (!event) throw new ForbiddenError("Event not found");
  if (ctx.role === "PARENT") throw new ForbiddenError("Parents see only their own child's RSVP");
  assertCan(ctx, "events.view", { clubId: event.clubId });
  if (!canViewEventAudience(ctx, event.audienceScope, event.eventTeams.map((et) => et.teamId))) {
    throw new ForbiddenError("Event is outside your scope");
  }

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
    select: { clubId: true, audienceScope: true, eventTeams: { select: { teamId: true } } },
  });
  if (!event) throw new ForbiddenError("Event not found");
  // Recording attendance requires manage authority over the event's audience.
  assertAudienceWritable(ctx, event.clubId, event.audienceScope as AudienceScope, event.eventTeams.map((et) => et.teamId));

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
      metadata: { count: input.entries.length },
    });
    return { recorded: input.entries.length };
  });
}

/** Staff attendance summary for an event (per-player). */
export async function getAttendanceSummary(ctx: AuthContext, eventId: string) {
  const event = await prisma.event.findUnique({
    where: { id: eventId },
    select: { clubId: true, audienceScope: true, eventTeams: { select: { teamId: true } } },
  });
  if (!event) throw new ForbiddenError("Event not found");
  assertCan(ctx, "attendance.view_team", { clubId: event.clubId });
  if (!isClubLevel(ctx) && !canViewEventAudience(ctx, event.audienceScope, event.eventTeams.map((et) => et.teamId))) {
    throw new ForbiddenError("Event is outside your scope");
  }

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
    where: { playerId: { in: players.map((p) => p.id) }, event: { eventTeams: { some: { teamId } } } },
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
      event: {
        select: {
          id: true,
          title: true,
          startAt: true,
          eventType: true,
          timezone: true,
          eventTeams: { include: { team: { select: { name: true } } } },
        },
      },
    },
  });
  // Derive a single `team` (first targeted team) for the legacy drill-down UI.
  const shaped = records.map((r) => ({
    ...r,
    event: { ...r.event, team: r.event.eventTeams[0]?.team ?? null },
  }));
  return { player, records: shaped };
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
 * Aggregated schedule for a parent across ALL linked children: events targeting
 * any linked child's team plus club-wide events, de-duplicated (one row per
 * event), each carrying the relevant children and that child's RSVP.
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

  const and: Prisma.EventWhereInput[] = [audienceWhere(ctx, clubId)];
  if (opts.upcomingOnly) and.push({ startAt: { gte: new Date() } });

  const events = await prisma.event.findMany({
    where: { AND: and },
    orderBy: { startAt: opts.upcomingOnly ? "asc" : "desc" },
    take: opts.limit,
    ...eventWithTeams,
  });
  if (events.length === 0) return [];

  const rsvps = await prisma.eventRsvp.findMany({
    where: { eventId: { in: events.map((e) => e.id) }, playerId: { in: ctx.linkedPlayerIds } },
    select: { eventId: true, playerId: true, responseStatus: true },
  });
  const rsvpMap = new Map<string, string>(); // `${eventId}:${playerId}` -> status
  for (const r of rsvps) rsvpMap.set(`${r.eventId}:${r.playerId}`, r.responseStatus);

  return events.map((e) => {
    const eventTeamIds = new Set(e.eventTeams.map((et) => et.teamId));
    const clubWide = e.audienceScope === "CLUB_WIDE";
    const relevant = players.filter((p) =>
      clubWide ? true : [...(childTeamSet.get(p.id) ?? [])].some((t) => eventTeamIds.has(t)),
    );
    const tag = firstTeam(e.eventTeams);
    return {
      event: {
        id: e.id,
        title: e.title,
        eventType: e.eventType,
        teamId: tag?.id ?? null,
        teamName: tag?.name ?? null,
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
  const and: Prisma.EventWhereInput[] = [
    { clubId, endAt: { lt: new Date() }, status: { notIn: ["CANCELLED"] }, attendanceRecords: { none: {} } },
    // Team events only (club-wide events don't take roster attendance).
    { audienceScope: "TEAMS" },
  ];
  if (ctx.role === "COACH") and.push({ eventTeams: { some: { teamId: { in: ctx.coachTeamIds } } } });
  return prisma.event.count({ where: { AND: and } });
}

export interface CoachAttendanceOverview {
  /** Average attendance across the recent events in `series`, or null if none. */
  avgPct: number | null;
  /** Attendance for the most recent recorded event, or null if none. */
  lastPct: number | null;
  /** Per-event attendance % (oldest → newest) for the dashboard sparkline. */
  series: number[];
}

/**
 * Recent per-event attendance % across the coach's assigned teams — feeds the
 * dashboard "Attendance" sparkline. Each point is PRESENT-or-LATE over total
 * recorded for that event. Returns empty when nothing has been recorded yet.
 */
export async function getCoachAttendanceOverview(ctx: AuthContext, clubId: string): Promise<CoachAttendanceOverview> {
  assertCan(ctx, "attendance.view_team", { clubId });
  if (ctx.coachTeamIds.length === 0) return { avgPct: null, lastPct: null, series: [] };

  const events = await prisma.event.findMany({
    where: {
      clubId,
      eventTeams: { some: { teamId: { in: ctx.coachTeamIds } } },
      startAt: { lte: new Date() },
      attendanceRecords: { some: {} },
    },
    orderBy: { startAt: "desc" },
    take: 8,
    select: { id: true, attendanceRecords: { select: { attendanceStatus: true } } },
  });
  // Query is newest-first; reverse to chronological so the line reads left→right.
  const series = [...events].reverse().map((e) => {
    const total = e.attendanceRecords.length;
    const attended = e.attendanceRecords.filter(
      (r) => r.attendanceStatus === "PRESENT" || r.attendanceStatus === "LATE",
    ).length;
    return total > 0 ? Math.round((attended / total) * 100) : 0;
  });
  if (series.length === 0) return { avgPct: null, lastPct: null, series: [] };
  const avgPct = Math.round(series.reduce((a, b) => a + b, 0) / series.length);
  return { avgPct, lastPct: series[series.length - 1], series };
}
