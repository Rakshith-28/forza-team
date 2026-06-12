"use client";

import { RsvpControl } from "@/app/(app)/schedule/rsvp-control";
import type { ScheduleEvent } from "@/modules/events/service";

import { ScheduleView } from "./schedule-view";

export interface PlayerChildRsvp {
  playerId: string;
  name: string;
  rsvpStatus: string | null;
}

/**
 * Player calendar: the shared ScheduleView with a per-card RSVP slot.
 * The day-rail card for each event renders an RSVP selector for the caller's
 * OWN linked children only (the data is already scoped — `events` are
 * audience-scoped and `childrenByEvent` carries only this player's children).
 * RSVP submits through the existing server action + revalidation.
 */
export function PlayerSchedule({
  events,
  childrenByEvent,
  today,
  month,
  selectedDate,
}: {
  events: ScheduleEvent[];
  childrenByEvent: Record<string, PlayerChildRsvp[]>;
  today: string;
  month: string;
  selectedDate: string;
}) {
  return (
    <ScheduleView
      events={events}
      today={today}
      initialMonth={month}
      initialSelectedDate={selectedDate}
      emptyLabel="Nothing scheduled."
      renderRsvp={(event) => {
        if (event.status === "CANCELLED") return null;
        const kids = childrenByEvent[event.id] ?? [];
        if (kids.length === 0) return null;
        return (
          <div className="flex flex-col gap-1.5">
            {kids.map((c) => (
              <RsvpControl
                key={c.playerId}
                eventId={event.id}
                playerId={c.playerId}
                playerName={c.name}
                current={c.rsvpStatus}
              />
            ))}
          </div>
        );
      }}
    />
  );
}
