"use client";

import type { ScheduleEvent } from "@/modules/events/service";
import { EVENT_TYPE_LABELS, eventAccentVar, type EventType } from "@/modules/events/schemas";
import { formatEventClock } from "@/modules/events/format";

/**
 * A single event row in the day rail. Surface-agnostic and 100% token-driven:
 * the `.app-card` surface re-skins under Vibrant/Classic, and the event-type
 * accent (left edge + badge) comes from the `--event-*` tokens. Optional
 * `children` host per-card controls (e.g. the parent RSVP selector).
 */
export function EventCard({
  event,
  onOpen,
  children,
}: {
  event: ScheduleEvent;
  onOpen?: (event: ScheduleEvent) => void;
  children?: React.ReactNode;
}) {
  const accent = eventAccentVar(event.eventType);
  const label = EVENT_TYPE_LABELS[event.eventType as EventType] ?? event.eventType;
  const cancelled = event.status === "CANCELLED";
  const teams = event.teams.length > 0 ? event.teams.map((t) => t.name).join(", ") : "Club-wide";

  return (
    <div className="app-card overflow-hidden p-0">
      <button
        type="button"
        onClick={onOpen ? () => onOpen(event) : undefined}
        className="flex w-full items-stretch gap-3 p-3 text-left transition-colors hover:bg-secondary/60 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
      >
        <span aria-hidden className="w-1.5 shrink-0 self-stretch rounded-full" style={{ background: accent }} />
        <span className="flex min-w-0 flex-1 flex-col gap-1">
          <span className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-semibold tabular-nums text-foreground">
              {formatEventClock(event.startAt, event.timezone)}
            </span>
            <span
              className="rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-foreground"
              style={{ background: accent }}
            >
              {label}
            </span>
            {cancelled ? (
              <span className="text-[10px] font-semibold uppercase tracking-wide text-destructive">Cancelled</span>
            ) : null}
          </span>
          <span className="truncate font-sport text-base font-bold text-foreground">{event.title}</span>
          <span className="flex flex-wrap items-center gap-x-1.5 text-xs text-muted-foreground">
            <span className="truncate">{teams}</span>
            {event.locationName ? (
              <>
                <span aria-hidden>·</span>
                <span className="truncate">{event.locationName}</span>
              </>
            ) : null}
          </span>
        </span>
      </button>
      {children ? <div className="border-t px-3 py-2">{children}</div> : null}
    </div>
  );
}
