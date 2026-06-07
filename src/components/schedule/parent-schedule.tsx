"use client";

import { RsvpControl } from "@/app/(app)/schedule/rsvp-control";
import type { ScheduleEvent } from "@/modules/events/service";

import { ScheduleView } from "./schedule-view";

export interface ParentChildRsvp {
  playerId: string;
  name: string;
  rsvpStatus: string | null;
}

/**
 * Parent/player calendar: the shared ScheduleView with a per-card RSVP slot.
 * The day-rail card for each event renders an RSVP selector for the caller's
 * OWN linked children only (the data is already parent-safe — `events` are
 * audience-scoped and `childrenByEvent` carries only this parent's children).
 * RSVP submits through the existing server action + revalidation.
 */
export function ParentSchedule({
  events,
  childrenByEvent,
  today,
  month,
  selectedDate,
}: {
  events: ScheduleEvent[];
  childrenByEvent: Record<string, ParentChildRsvp[]>;
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
      detailHref={(id) => `/schedule/${id}`}
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
