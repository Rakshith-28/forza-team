import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { requireAuthContext } from "@/lib/auth-guards";
import { can } from "@/lib/rbac";
import { listEvents, listParentSchedule } from "@/modules/events/service";
import { EVENT_TYPE_LABELS, type EventType } from "@/modules/events/schemas";
import { formatEventTime } from "@/modules/events/format";

import { StatusBadge } from "../seasons/season-forms";
import { RsvpControl } from "./rsvp-control";

function typeLabel(t: string): string {
  return EVENT_TYPE_LABELS[t as EventType] ?? t;
}

export default async function SchedulePage() {
  const ctx = await requireAuthContext();
  if (!ctx.activeClubId) {
    return (
      <div className="mx-auto max-w-lg py-16 text-center">
        <h1 className="font-sport text-xl font-bold">No active club</h1>
        <p className="mt-2 text-sm text-muted-foreground">Your account isn&apos;t scoped to a club yet.</p>
      </div>
    );
  }

  const clubId = ctx.activeClubId;

  if (ctx.role === "PARENT") {
    const schedule = await listParentSchedule(ctx);
    return (
      <div className="mx-auto max-w-2xl">
        <h1 className="font-display text-3xl uppercase tracking-tight text-foreground">Schedule</h1>
        <p className="mt-1 text-muted-foreground">Events across all your children, with RSVP.</p>

        <div className="mt-6 flex flex-col gap-3">
          {schedule.length === 0 ? (
            <p className="rounded-lg border border-dashed bg-card p-8 text-center text-sm text-muted-foreground">
              No events scheduled yet.
            </p>
          ) : (
            schedule.map(({ event, children }) => (
              <article key={event.id} className="rounded-lg border bg-card p-4">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <h2 className="font-sport text-base font-bold text-foreground">{event.title}</h2>
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">
                      {typeLabel(event.eventType)}
                      {event.teamName ? ` · ${event.teamName}` : " · Club-wide"}
                    </p>
                    <p className="mt-0.5 text-sm text-muted-foreground">
                      {formatEventTime(event.startAt, event.timezone)}
                      {event.locationName ? ` · ${event.locationName}` : ""}
                    </p>
                  </div>
                  <StatusBadge status={event.status} />
                </div>
                {event.status !== "CANCELLED" ? (
                  <div className="mt-3 flex flex-col gap-1.5 border-t pt-3">
                    {children.map((c) => (
                      <RsvpControl
                        key={c.playerId}
                        eventId={event.id}
                        playerId={c.playerId}
                        playerName={c.name}
                        current={c.rsvpStatus}
                      />
                    ))}
                  </div>
                ) : null}
              </article>
            ))
          )}
        </div>
      </div>
    );
  }

  // Admin / Coach
  const canManage = can(ctx, "events.manage", { clubId });
  const events = await listEvents(ctx, clubId, { limit: 100 });

  return (
    <div className="mx-auto max-w-2xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-3xl uppercase tracking-tight text-foreground">Schedule</h1>
          <p className="mt-1 text-muted-foreground">
            {ctx.role === "COACH" ? "Events for the teams you coach." : "Club and team events."}
          </p>
        </div>
        {canManage ? (
          <Button asChild>
            <Link href="/schedule/new">New event</Link>
          </Button>
        ) : null}
      </div>

      <div className="mt-6 flex flex-col gap-3">
        {events.length === 0 ? (
          <p className="rounded-lg border border-dashed bg-card p-8 text-center text-sm text-muted-foreground">
            No events yet.
          </p>
        ) : (
          events.map((e) => (
            <Link key={e.id} href={`/schedule/${e.id}`}>
              <Card className="transition-colors hover:border-primary">
                <CardContent className="flex items-center justify-between gap-4 py-4">
                  <div>
                    <p className="font-sport text-base font-bold text-foreground">{e.title}</p>
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">
                      {typeLabel(e.eventType)}
                      {e.team ? ` · ${e.team.name}` : " · Club-wide"}
                    </p>
                    <p className="mt-0.5 text-sm text-muted-foreground">{formatEventTime(e.startAt, e.timezone)}</p>
                  </div>
                  <StatusBadge status={e.status} />
                </CardContent>
              </Card>
            </Link>
          ))
        )}
      </div>
    </div>
  );
}
