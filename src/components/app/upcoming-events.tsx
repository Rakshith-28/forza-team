import Link from "next/link";

import { formatEventClock, formatEventDateChip } from "@/modules/events/format";
import { EVENT_TYPE_LABELS, type EventType } from "@/modules/events/schemas";

/** The minimal event shape the card needs (a subset of the events service rows). */
export interface UpcomingEventItem {
  id: string;
  title: string;
  eventType: string;
  startAt: Date | string;
  timezone: string;
  locationName?: string | null;
  team?: { name: string } | null;
}

/** Accent color per event type so the calendar chip reads at a glance. */
const TYPE_ACCENT: Record<string, string> = {
  GAME: "bg-primary/10 text-primary ring-primary/20",
  TOURNAMENT: "bg-primary/10 text-primary ring-primary/20",
  PRACTICE: "bg-sky-100 text-sky-700 ring-sky-200",
  TEAM_MEETING: "bg-violet-100 text-violet-700 ring-violet-200",
  TEAM_EVENT: "bg-violet-100 text-violet-700 ring-violet-200",
  CLUB_EVENT: "bg-amber-100 text-amber-700 ring-amber-200",
};

function accent(eventType: string): string {
  return TYPE_ACCENT[eventType] ?? "bg-secondary text-secondary-foreground ring-border";
}

/**
 * Upcoming events list, redesigned as calendar-chip rows: a colored month/day
 * badge on the left, title + type/team + location in the middle, and the start
 * time on the right. Shared across dashboards.
 */
export function UpcomingEvents({ events }: { events: UpcomingEventItem[] }) {
  return (
    <ul className="flex flex-col gap-2.5">
      {events.map((e) => {
        const chip = formatEventDateChip(e.startAt, e.timezone);
        const tone = accent(e.eventType);
        return (
          <li key={e.id}>
            <Link
              href={`/schedule/${e.id}`}
              className="group flex items-stretch gap-3 rounded-xl border bg-card p-2.5 transition-all hover:border-primary hover:shadow-sm"
            >
              {/* Calendar chip */}
              <div
                className={`flex w-14 shrink-0 flex-col items-center justify-center rounded-lg px-2 py-1.5 text-center ring-1 ring-inset ${tone}`}
              >
                <span className="text-[10px] font-semibold uppercase leading-none tracking-wide">{chip.month}</span>
                <span className="text-xl font-bold leading-tight tabular-nums">{chip.day}</span>
                <span className="text-[10px] uppercase leading-none opacity-80">{chip.weekday}</span>
              </div>

              {/* Body */}
              <div className="flex min-w-0 flex-1 flex-col justify-center">
                <p className="truncate font-semibold text-foreground">{e.title}</p>
                <p className="mt-0.5 flex flex-wrap items-center gap-x-1.5 text-xs text-muted-foreground">
                  <span className="font-medium uppercase tracking-wide text-foreground/70">
                    {EVENT_TYPE_LABELS[e.eventType as EventType] ?? e.eventType}
                  </span>
                  <span aria-hidden>·</span>
                  <span className="truncate">{e.team ? e.team.name : "Club-wide"}</span>
                  {e.locationName ? (
                    <>
                      <span aria-hidden>·</span>
                      <span className="truncate">{e.locationName}</span>
                    </>
                  ) : null}
                </p>
              </div>

              {/* Time */}
              <div className="flex shrink-0 flex-col items-end justify-center pl-2 text-right">
                <span className="text-sm font-semibold text-foreground tabular-nums">
                  {formatEventClock(e.startAt, e.timezone)}
                </span>
                <span className="text-[11px] text-muted-foreground transition-colors group-hover:text-primary">
                  View →
                </span>
              </div>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
