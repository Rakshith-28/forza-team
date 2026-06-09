import Link from "next/link";
import { notFound } from "next/navigation";
import { CalendarDays, Clock, FileText, MapPin, Shirt, Swords } from "lucide-react";

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
import { formatEventDateChip, formatEventDay, formatEventTime, toDatetimeLocal } from "@/modules/events/format";
import { listTeams } from "@/modules/clubs/service";

import { StatusBadge } from "../../seasons/season-forms";
import { AttendanceEntry, type AttendanceRow } from "../attendance-entry";
import { EventForm } from "../event-form";
import { RsvpControl } from "../rsvp-control";

/** Accent for the date badge, tinted by event type (mirrors the schedule chips). */
const TYPE_ACCENT: Record<string, string> = {
  GAME: "bg-primary/10 text-primary ring-primary/20",
  TOURNAMENT: "bg-primary/10 text-primary ring-primary/20",
  PRACTICE: "bg-sky-100 text-sky-700 ring-sky-200",
  TEAM_MEETING: "bg-violet-100 text-violet-700 ring-violet-200",
  TEAM_EVENT: "bg-violet-100 text-violet-700 ring-violet-200",
  CLUB_EVENT: "bg-amber-100 text-amber-700 ring-amber-200",
};

function DetailRow({
  icon: Icon,
  label,
  children,
}: {
  icon: typeof Clock;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-start gap-3">
      <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-secondary text-muted-foreground">
        <Icon className="size-4" aria-hidden />
      </span>
      <div className="min-w-0">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
        <p className="text-sm text-foreground wrap-break-word">{children}</p>
      </div>
    </div>
  );
}

export default async function EventDetailPage({ params }: { params: Promise<{ eventId: string }> }) {
  const { eventId } = await params;
  const ctx = await requireAuthContext();

  const event = await getEvent(ctx, eventId);
  if (!event) notFound();

  const isParent = ctx.role === "PARENT";
  const canManage = can(ctx, "events.manage", { clubId: event.clubId, teamId: event.teamId ?? undefined });

  const chip = formatEventDateChip(event.startAt, event.timezone);
  const tone = TYPE_ACCENT[event.eventType] ?? "bg-secondary text-secondary-foreground ring-border";

  return (
    <div className="mx-auto min-w-0 max-w-2xl">
      <Link href="/schedule" className="text-sm text-muted-foreground underline-offset-4 hover:underline">
        ← Schedule
      </Link>

      {/* Hero */}
      <div className="mt-3 overflow-hidden rounded-2xl border bg-card shadow-sm">
        <div className="flex items-start gap-4 border-b bg-secondary/30 p-5">
          {/* Date badge */}
          <div
            className={`flex w-16 shrink-0 flex-col items-center justify-center rounded-xl px-2 py-2 text-center ring-1 ring-inset ${tone}`}
          >
            <span className="text-[10px] font-semibold uppercase leading-none tracking-wide">{chip.month}</span>
            <span className="text-2xl font-bold leading-tight tabular-nums">{chip.day}</span>
            <span className="text-[10px] uppercase leading-none opacity-80">{chip.weekday}</span>
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex items-start justify-between gap-3">
              <h1 className="font-display text-2xl uppercase leading-none tracking-tight text-foreground wrap-break-word sm:text-3xl">
                {event.title}
              </h1>
              <span className="shrink-0">
                <StatusBadge status={event.status} />
              </span>
            </div>
            <p className="mt-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {EVENT_TYPE_LABELS[event.eventType as EventType] ?? event.eventType}
              {event.team ? ` · ${event.team.name}` : " · Club-wide"}
            </p>
            {event.opponentName ? (
              <p className="mt-2 inline-flex items-center gap-1.5 text-sm font-bold text-foreground">
                <Swords className="size-4 text-primary" aria-hidden /> vs {event.opponentName}
              </p>
            ) : null}
          </div>
        </div>

        {/* Detail rows */}
        <div className="grid gap-4 p-5 sm:grid-cols-2">
          <DetailRow icon={CalendarDays} label="Date">
            {formatEventDay(event.startAt, event.timezone)}
          </DetailRow>
          <DetailRow icon={Clock} label="Time">
            {formatEventTime(event.startAt, event.timezone)} – {formatEventTime(event.endAt, event.timezone)}
          </DetailRow>
          {event.locationName ? (
            <DetailRow icon={MapPin} label="Location">
              {event.locationName}
            </DetailRow>
          ) : null}
          {event.uniformNotes ? (
            <DetailRow icon={Shirt} label="Uniform">
              {event.uniformNotes}
            </DetailRow>
          ) : null}
        </div>

        {event.description ? (
          <div className="border-t p-5">
            <p className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              <FileText className="size-3.5" aria-hidden /> Notes
            </p>
            <p className="mt-1.5 whitespace-pre-wrap text-sm text-foreground wrap-break-word">{event.description}</p>
          </div>
        ) : null}
      </div>

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

const RSVP_TONE: Record<RsvpStatus, string> = {
  GOING: "bg-primary/10 text-primary ring-primary/20",
  MAYBE: "bg-amber-100 text-amber-700 ring-amber-200",
  LATE: "bg-sky-100 text-sky-700 ring-sky-200",
  NOT_GOING: "bg-muted text-muted-foreground ring-border",
};

async function StaffRsvpSummary({ ctx, eventId }: { ctx: Ctx; eventId: string }) {
  const { counts, responses } = await getRsvpSummary(ctx, eventId);
  return (
    <Card className="mt-4">
      <CardHeader>
        <CardTitle className="font-sport text-base">RSVP</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {(["GOING", "MAYBE", "LATE", "NOT_GOING"] as RsvpStatus[]).map((s) => (
            <div key={s} className={`rounded-xl px-3 py-2.5 text-center ring-1 ring-inset ${RSVP_TONE[s]}`}>
              <p className="text-2xl font-bold leading-none tabular-nums">{counts[s] ?? 0}</p>
              <p className="mt-1 text-[11px] font-semibold uppercase tracking-wide">{RSVP_LABELS[s]}</p>
            </div>
          ))}
        </div>
        {responses.length > 0 ? (
          <ul className="flex flex-col divide-y rounded-lg border">
            {responses.map((r) => (
              <li key={r.id} className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
                <span className="min-w-0 truncate text-foreground">
                  {r.player.firstName} {r.player.lastName}
                </span>
                <span className="shrink-0 text-xs font-medium text-muted-foreground">
                  {RSVP_LABELS[r.responseStatus as RsvpStatus] ?? r.responseStatus}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">No responses yet.</p>
        )}
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
                audienceScope: event.audienceScope,
                teamIds: event.eventTeams.map((et) => et.teamId),
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
