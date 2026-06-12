"use client";

import type { ScheduleEvent } from "@/modules/events/service";
import { ScrollPanel } from "@/components/app/scroll-panel";

import { EventCard } from "./event-card";

/** Human label for a `YYYY-MM-DD` key, rendered deterministically in UTC. */
function dayLabel(key: string | null): string {
  if (!key) return "Select a date";
  const [y, m, d] = key.split("-").map(Number);
  return new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(y, m - 1, d)));
}

/**
 * The right-side rail listing the selected day's events as cards. `renderExtra`
 * injects per-card controls (the player variant passes the per-child RSVP
 * selector). Token-driven; inherits Vibrant/Classic on the player surface.
 */
export function DayEventsRail({
  selectedDate,
  events,
  onOpenEvent,
  renderExtra,
  emptyLabel = "No events on this day.",
}: {
  selectedDate: string | null;
  events: ScheduleEvent[];
  onOpenEvent?: (event: ScheduleEvent) => void;
  renderExtra?: (event: ScheduleEvent) => React.ReactNode;
  emptyLabel?: string;
}) {
  const sorted = [...events].sort((a, b) => (a.startAt < b.startAt ? -1 : 1));

  return (
    <div className="flex flex-col gap-3">
      <h3 className="font-sport text-base font-bold tracking-tight text-foreground">{dayLabel(selectedDate)}</h3>
      {sorted.length === 0 ? (
        <p className="app-card p-6 text-center text-sm text-muted-foreground">{emptyLabel}</p>
      ) : (
        <ScrollPanel maxHeightClass="max-h-128" gapClass="gap-3">
          {sorted.map((e) => (
            <EventCard key={e.id} event={e} onOpen={onOpenEvent}>
              {renderExtra ? renderExtra(e) : null}
            </EventCard>
          ))}
        </ScrollPanel>
      )}
    </div>
  );
}
