import Link from "next/link";
import { notFound } from "next/navigation";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requireAuthContext } from "@/lib/auth-guards";
import { can } from "@/lib/rbac";
import { listPlayers } from "@/modules/roster/service";
import { cancelEventAction } from "@/modules/events/actions";
import {
  getAttendanceSummary,
  getEvent,
  getRsvpSummary,
  listParentSchedule,
} from "@/modules/events/service";
import { EVENT_TYPE_LABELS, RSVP_LABELS, type EventType, type RsvpStatus } from "@/modules/events/schemas";
import { formatEventDay, formatEventTime, toDatetimeLocal } from "@/modules/events/format";
import { listTeams } from "@/modules/clubs/service";

import { StatusBadge } from "../../seasons/season-forms";
import { AttendanceEntry, type AttendanceRow } from "../attendance-entry";
import { EventForm } from "../event-form";
import { RsvpControl } from "../rsvp-control";

export default async function EventDetailPage({ params }: { params: Promise<{ eventId: string }> }) {
  const { eventId } = await params;
  const ctx = await requireAuthContext();

  const event = await getEvent(ctx, eventId);
  if (!event) notFound();

  const isParent = ctx.role === "PARENT";
  const canManage = can(ctx, "events.manage", { clubId: event.clubId, teamId: event.teamId ?? undefined });

  return (
    <div className="mx-auto max-w-2xl">
      <Link href="/schedule" className="text-sm text-muted-foreground underline-offset-4 hover:underline">
        ← Schedule
      </Link>

      <div className="mt-3 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl uppercase tracking-tight text-foreground">{event.title}</h1>
          <p className="mt-1 text-xs uppercase tracking-wide text-muted-foreground">
            {EVENT_TYPE_LABELS[event.eventType as EventType] ?? event.eventType}
            {event.team ? ` · ${event.team.name}` : " · Club-wide"}
          </p>
        </div>
        <StatusBadge status={event.status} />
      </div>

      <Card className="mt-6">
        <CardContent className="grid gap-2 py-4 text-sm">
          <p className="text-foreground">{formatEventDay(event.startAt, event.timezone)}</p>
          <p className="text-muted-foreground">
            {formatEventTime(event.startAt, event.timezone)} – {formatEventTime(event.endAt, event.timezone)}
          </p>
          {event.locationName ? <p className="text-muted-foreground">📍 {event.locationName}</p> : null}
          {event.opponentName ? <p className="text-muted-foreground">vs {event.opponentName}</p> : null}
          {event.description ? <p className="whitespace-pre-wrap text-foreground">{event.description}</p> : null}
          {event.uniformNotes ? <p className="text-muted-foreground">👕 {event.uniformNotes}</p> : null}
        </CardContent>
      </Card>

      {isParent ? <ParentRsvpSection ctx={ctx} eventId={event.id} status={event.status} /> : null}

      {!isParent ? (
        <>
          <StaffRsvpSummary ctx={ctx} eventId={event.id} />
          {event.teamId ? <StaffAttendance ctx={ctx} eventId={event.id} clubId={event.clubId} teamId={event.teamId} /> : null}
          {canManage ? <EditFormLoader ctx={ctx} event={event} /> : null}
        </>
      ) : null}
    </div>
  );
}

type Ctx = Awaited<ReturnType<typeof requireAuthContext>>;

async function ParentRsvpSection({ ctx, eventId, status }: { ctx: Ctx; eventId: string; status: string }) {
  const schedule = await listParentSchedule(ctx);
  const entry = schedule.find((s) => s.event.id === eventId);
  const children = entry?.children ?? [];
  return (
    <Card className="mt-4">
      <CardHeader>
        <CardTitle className="font-sport text-base">Your RSVP</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-1.5">
        {status === "CANCELLED" ? (
          <p className="text-sm text-muted-foreground">This event is cancelled.</p>
        ) : children.length === 0 ? (
          <p className="text-sm text-muted-foreground">No linked children participate in this event.</p>
        ) : (
          children.map((c) => (
            <RsvpControl key={c.playerId} eventId={eventId} playerId={c.playerId} playerName={c.name} current={c.rsvpStatus} />
          ))
        )}
      </CardContent>
    </Card>
  );
}

async function StaffRsvpSummary({ ctx, eventId }: { ctx: Ctx; eventId: string }) {
  const { counts, responses } = await getRsvpSummary(ctx, eventId);
  return (
    <Card className="mt-4">
      <CardHeader>
        <CardTitle className="font-sport text-base">RSVP</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <div className="flex flex-wrap gap-3 text-sm">
          {(["GOING", "MAYBE", "LATE", "NOT_GOING"] as RsvpStatus[]).map((s) => (
            <span key={s} className="rounded-full bg-secondary px-2.5 py-0.5 text-secondary-foreground">
              {RSVP_LABELS[s]}: <strong>{counts[s] ?? 0}</strong>
            </span>
          ))}
        </div>
        {responses.length > 0 ? (
          <ul className="text-sm text-muted-foreground">
            {responses.map((r) => (
              <li key={r.id}>
                {r.player.firstName} {r.player.lastName} — {RSVP_LABELS[r.responseStatus as RsvpStatus] ?? r.responseStatus}
              </li>
            ))}
          </ul>
        ) : null}
      </CardContent>
    </Card>
  );
}

async function StaffAttendance({
  ctx,
  eventId,
  clubId,
  teamId,
}: {
  ctx: Ctx;
  eventId: string;
  clubId: string;
  teamId: string;
}) {
  const [players, records] = await Promise.all([
    listPlayers(ctx, clubId, { teamId }),
    getAttendanceSummary(ctx, eventId),
  ]);
  const current = new Map(records.map((r) => [r.playerId, r.attendanceStatus]));
  const rows: AttendanceRow[] = players.map((p) => ({
    playerId: p.id,
    name: `${p.firstName} ${p.lastName}`,
    current: current.get(p.id) ?? null,
  }));
  return (
    <Card className="mt-4">
      <CardHeader>
        <CardTitle className="font-sport text-base">Attendance</CardTitle>
      </CardHeader>
      <CardContent>
        <AttendanceEntry eventId={eventId} rows={rows} />
      </CardContent>
    </Card>
  );
}

async function EditFormLoader({
  ctx,
  event,
}: {
  ctx: Ctx;
  event: NonNullable<Awaited<ReturnType<typeof getEvent>>>;
}) {
  const teams = await listTeams(ctx, event.clubId);
  const teamOptions = teams.filter((t) => t.status !== "ARCHIVED").map((t) => ({ id: t.id, name: t.name }));
  const canClubWide = ctx.role === "MASTER_ADMIN" || ctx.role === "CLUB_ADMIN";

  return (
    <Card className="mt-4">
      <CardHeader>
        <CardTitle className="font-sport text-base">Manage event</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <details>
          <summary className="cursor-pointer text-sm font-medium text-primary">Edit event</summary>
          <div className="mt-4">
            <EventForm
              teams={teamOptions}
              canClubWide={canClubWide}
              event={{
                id: event.id,
                title: event.title,
                eventType: event.eventType,
                teamId: event.teamId,
                description: event.description,
                startAtLocal: toDatetimeLocal(event.startAt, event.timezone),
                endAtLocal: toDatetimeLocal(event.endAt, event.timezone),
                locationName: event.locationName,
                opponentName: event.opponentName,
                uniformNotes: event.uniformNotes,
                status: event.status,
              }}
            />
          </div>
        </details>
        {event.status !== "CANCELLED" ? (
          <form action={cancelEventAction}>
            <input type="hidden" name="eventId" value={event.id} />
            <button type="submit" className="text-sm font-medium text-muted-foreground hover:text-destructive">
              Cancel this event
            </button>
          </form>
        ) : null}
      </CardContent>
    </Card>
  );
}
