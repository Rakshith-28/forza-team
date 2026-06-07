"use client";

import Link from "next/link";

import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/console/dialog";
import type { ScheduleEvent } from "@/modules/events/service";
import { EVENT_TYPE_LABELS, eventAccentVar, type EventType } from "@/modules/events/schemas";
import { formatEventDay, formatEventTime } from "@/modules/events/format";

/**
 * Quick-look event detail in the shared right-side drawer (Radix Dialog —
 * focus trap, ESC, ARIA). Token-driven, so it inherits Vibrant/Classic on the
 * parent surface. Links out to the full detail page for staff actions
 * (RSVP summary, attendance, edit/cancel).
 */
export function EventDetailDrawer({
  event,
  open,
  onOpenChange,
  detailHref,
}: {
  event: ScheduleEvent | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  detailHref?: (id: string) => string;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        {event ? (
          <>
            <DialogHeader>
              <span className="flex items-center gap-2">
                <span aria-hidden className="size-2.5 rounded-full" style={{ background: eventAccentVar(event.eventType) }} />
                <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  {EVENT_TYPE_LABELS[event.eventType as EventType] ?? event.eventType}
                </span>
                {event.status === "CANCELLED" ? (
                  <span className="text-xs font-semibold uppercase text-destructive">· Cancelled</span>
                ) : null}
              </span>
              <DialogTitle className="mt-1">{event.title}</DialogTitle>
            </DialogHeader>
            <DialogBody className="flex flex-col gap-3 text-sm">
              <p className="text-foreground">{formatEventDay(event.startAt, event.timezone)}</p>
              <p className="text-muted-foreground">
                {formatEventTime(event.startAt, event.timezone)} – {formatEventTime(event.endAt, event.timezone)}
              </p>
              <div className="flex flex-wrap gap-1.5">
                {event.teams.length > 0 ? (
                  event.teams.map((t) => (
                    <span key={t.id} className="rounded-full bg-secondary px-2.5 py-0.5 text-xs font-medium text-secondary-foreground">
                      {t.name}
                    </span>
                  ))
                ) : (
                  <span className="rounded-full bg-secondary px-2.5 py-0.5 text-xs font-medium text-secondary-foreground">
                    Club-wide
                  </span>
                )}
              </div>
              {event.locationName ? <p className="text-muted-foreground">📍 {event.locationName}</p> : null}
              {detailHref ? (
                <Link
                  href={detailHref(event.id)}
                  className="mt-1 inline-flex w-fit items-center text-sm font-medium text-primary underline-offset-4 hover:underline"
                >
                  Open full details →
                </Link>
              ) : null}
            </DialogBody>
          </>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
