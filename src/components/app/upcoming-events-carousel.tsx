"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Clock, MapPin } from "lucide-react";

import { eventDayKey, formatEventClock, formatEventDateChip } from "@/modules/events/format";
import { EVENT_TYPE_LABELS, type EventType } from "@/modules/events/schemas";

/** The minimal event shape the carousel renders (a subset of the events service rows). */
export interface CarouselEvent {
  id: string;
  title: string;
  eventType: string;
  startAt: string;
  timezone: string;
  locationName: string | null;
  teams: { id: string; name: string }[];
}

/** Accent per event type so the date chip reads at a glance (mirrors UpcomingEvents). */
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

/** Calendar-day countdown in the event's timezone: "Today" / "Tomorrow" / "In N days". */
function startsInLabel(iso: string, timezone: string): string {
  const today = Date.parse(`${eventDayKey(new Date(), timezone)}T00:00:00Z`);
  const day = Date.parse(`${eventDayKey(iso, timezone)}T00:00:00Z`);
  const diff = Math.round((day - today) / 86_400_000);
  if (Number.isNaN(diff)) return "";
  if (diff < 0) return "Past event";
  if (diff === 0) return "Starts today";
  if (diff === 1) return "Starts tomorrow";
  if (diff < 7) return `Starts in ${diff} days`;
  if (diff < 14) return "Starts next week";
  return `Starts in ${Math.round(diff / 7)} weeks`;
}

/**
 * Swipeable "Upcoming events" carousel: one rich event card per slide, with
 * prev/next arrows on pointer devices, finger-swipe on touch, and a dot tracker.
 * One event per view keeps the card content full instead of a sparse list.
 */
export function UpcomingEventsCarousel({ events }: { events: CarouselEvent[] }) {
  const [index, setIndex] = useState(0);
  const touchX = useRef<number | null>(null);

  if (events.length === 0) return null;

  const last = events.length - 1;
  const go = (i: number) => setIndex(Math.max(0, Math.min(last, i)));

  function onTouchStart(e: React.TouchEvent) {
    touchX.current = e.touches[0]?.clientX ?? null;
  }
  function onTouchEnd(e: React.TouchEvent) {
    if (touchX.current === null) return;
    const dx = (e.changedTouches[0]?.clientX ?? touchX.current) - touchX.current;
    if (Math.abs(dx) > 40) go(index + (dx < 0 ? 1 : -1));
    touchX.current = null;
  }

  const multiple = events.length > 1;

  return (
    <div>
      {/* Pointer-device nav — hidden on touch where swiping takes over. */}
      {multiple ? (
        <div className="mb-2 hidden items-center justify-end gap-1.5 sm:flex">
          <NavButton label="Previous event" disabled={index === 0} onClick={() => go(index - 1)}>
            <ChevronLeft className="size-4" aria-hidden />
          </NavButton>
          <NavButton label="Next event" disabled={index === last} onClick={() => go(index + 1)}>
            <ChevronRight className="size-4" aria-hidden />
          </NavButton>
        </div>
      ) : null}

      {/* Viewport */}
      <div className="overflow-hidden" onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
        <div
          className="flex transition-transform duration-300 ease-out"
          style={{ transform: `translateX(-${index * 100}%)` }}
        >
          {events.map((e) => (
            <div key={e.id} className="w-full shrink-0">
              <EventSlide event={e} />
            </div>
          ))}
        </div>
      </div>

      {/* Dot tracker */}
      {multiple ? (
        <div className="mt-3 flex justify-center gap-1.5">
          {events.map((e, i) => (
            <button
              key={e.id}
              type="button"
              onClick={() => go(i)}
              aria-label={`Go to event ${i + 1} of ${events.length}`}
              aria-current={i === index}
              className={`h-1.5 rounded-full transition-all ${
                i === index ? "w-5 bg-primary" : "w-1.5 bg-muted-foreground/30 hover:bg-muted-foreground/50"
              }`}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}

function NavButton({
  label,
  disabled,
  onClick,
  children,
}: {
  label: string;
  disabled: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className="flex size-7 items-center justify-center rounded-full border bg-card text-muted-foreground transition-colors hover:border-primary hover:text-primary disabled:cursor-not-allowed disabled:opacity-40"
    >
      {children}
    </button>
  );
}

function EventSlide({ event }: { event: CarouselEvent }) {
  const chip = formatEventDateChip(event.startAt, event.timezone);
  const tone = accent(event.eventType);
  const teamLabel =
    event.teams.length > 0 ? event.teams.map((t) => t.name).join(" vs ") : "Club-wide";

  return (
    <Link
      href={`/schedule/${event.id}`}
      className="group flex items-stretch gap-4 rounded-xl border bg-card p-4 transition-all hover:border-primary hover:shadow-sm"
    >
      {/* Date badge */}
      <div
        className={`flex w-16 shrink-0 flex-col items-center justify-center rounded-lg px-2 py-2 text-center ring-1 ring-inset ${tone}`}
      >
        <span className="text-[10px] font-semibold uppercase leading-none tracking-wide">{chip.month}</span>
        <span className="text-2xl font-bold leading-tight tabular-nums">{chip.day}</span>
        <span className="text-[10px] uppercase leading-none opacity-80">{chip.weekday}</span>
      </div>

      {/* Body */}
      <div className="flex min-w-0 flex-1 flex-col justify-center gap-1">
        <p className="truncate font-sport text-base font-bold text-foreground">{event.title}</p>
        {/* Single truncating line so a long title/team/venue can never push width. */}
        <p className="truncate text-xs text-muted-foreground">
          <span className="font-semibold uppercase tracking-wide text-foreground/70">
            {EVENT_TYPE_LABELS[event.eventType as EventType] ?? event.eventType}
          </span>
          {" · "}
          {teamLabel}
          {event.locationName ? (
            <>
              {" · "}
              <MapPin className="inline size-3 -translate-y-px" aria-hidden /> {event.locationName}
            </>
          ) : null}
        </p>
        <p suppressHydrationWarning className="text-xs font-semibold text-primary">
          {startsInLabel(event.startAt, event.timezone)}
        </p>
      </div>

      {/* Time + CTA */}
      <div className="flex shrink-0 flex-col items-end justify-center gap-1 pl-2 text-right">
        <span className="inline-flex items-center gap-1 text-sm font-semibold tabular-nums text-foreground">
          <Clock className="size-3.5 shrink-0" aria-hidden />
          {formatEventClock(event.startAt, event.timezone)}
        </span>
        <span className="text-[11px] text-muted-foreground transition-colors group-hover:text-primary">
          Full details →
        </span>
      </div>
    </Link>
  );
}
