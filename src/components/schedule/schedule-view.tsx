"use client";

import { useMemo, useState } from "react";

import type { ScheduleEvent } from "@/modules/events/service";
import { eventDayKey } from "@/modules/events/format";

import { DayEventsRail } from "./day-events-rail";
import { EventDetailDrawer } from "./event-detail-drawer";
import { ScheduleCalendar } from "./schedule-calendar";

/**
 * The shared, surface-agnostic schedule UI: month grid (left) + day rail
 * (right), with a quick-look detail drawer. Identical structure on every
 * surface — Console renders it clean; inside the parent/player portal it
 * inherits Vibrant/Classic purely via `data-theme` tokens (no per-theme code).
 *
 * Events for (at least) the visible month are passed in once by the host page
 * (fetched via `listScheduleEvents`); selection + grouping happen client-side
 * with no extra round trip, respecting the app-wide router cache.
 */
export interface ScheduleViewProps {
  events: ScheduleEvent[];
  /** Today as `YYYY-MM-DD` (from the server, so SSR/client agree). */
  today: string;
  /** Initial displayed month `YYYY-MM` (defaults to today's month). */
  initialMonth?: string;
  /** Initial selected day `YYYY-MM-DD` (defaults to today). */
  initialSelectedDate?: string;
  seasonLabel?: string | null;
  /** Parent variant: per-card RSVP controls (own children only). */
  renderRsvp?: (event: ScheduleEvent) => React.ReactNode;
  emptyLabel?: string;
}

export function ScheduleView({
  events,
  today,
  initialMonth,
  initialSelectedDate,
  seasonLabel,
  renderRsvp,
  emptyLabel,
}: ScheduleViewProps) {
  const [selectedDate, setSelectedDate] = useState(initialSelectedDate ?? today);
  const [month, setMonth] = useState(initialMonth ?? today.slice(0, 7));
  const [openEvent, setOpenEvent] = useState<ScheduleEvent | null>(null);

  const dayEvents = useMemo(
    () => events.filter((e) => eventDayKey(e.startAt, e.timezone) === selectedDate),
    [events, selectedDate],
  );

  return (
    <div className="grid gap-4 lg:grid-cols-[1.6fr_1fr]">
      <ScheduleCalendar
        events={events}
        month={month}
        selectedDate={selectedDate}
        today={today}
        onSelectDate={(d) => {
          setSelectedDate(d);
          setMonth(d.slice(0, 7));
        }}
        onMonthChange={setMonth}
        seasonLabel={seasonLabel}
      />
      <DayEventsRail
        selectedDate={selectedDate}
        events={dayEvents}
        onOpenEvent={setOpenEvent}
        renderExtra={renderRsvp}
        emptyLabel={emptyLabel}
      />
      <EventDetailDrawer
        event={openEvent}
        open={openEvent != null}
        onOpenChange={(o) => {
          if (!o) setOpenEvent(null);
        }}
      />
    </div>
  );
}
