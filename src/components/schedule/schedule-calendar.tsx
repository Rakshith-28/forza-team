"use client";

import { useMemo } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

import type { ScheduleEvent } from "@/modules/events/service";
import { eventAccentVar } from "@/modules/events/schemas";
import { eventDayKey } from "@/modules/events/format";
import { cn } from "@/lib/utils";

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

const pad = (n: number) => String(n).padStart(2, "0");
const dateKey = (y: number, m0: number, d: number) => `${y}-${pad(m0 + 1)}-${pad(d)}`;

interface Cell {
  key: string;
  day: number;
  inMonth: boolean;
}

/** A whole-weeks month matrix for `YYYY-MM`: leading/trailing days fill only
 * enough to complete the first and last weeks — no extra trailing week. */
function buildMatrix(month: string): Cell[] {
  const [y, m] = month.split("-").map(Number);
  const year = y;
  const month0 = m - 1;
  const startWeekday = new Date(Date.UTC(year, month0, 1)).getUTCDay();
  const daysInMonth = new Date(Date.UTC(year, month0 + 1, 0)).getUTCDate();
  const prevDays = new Date(Date.UTC(year, month0, 0)).getUTCDate();
  const cells: Cell[] = [];
  for (let i = startWeekday - 1; i >= 0; i--) {
    const d = prevDays - i;
    const pm = month0 === 0 ? 11 : month0 - 1;
    const py = month0 === 0 ? year - 1 : year;
    cells.push({ key: dateKey(py, pm, d), day: d, inMonth: false });
  }
  for (let d = 1; d <= daysInMonth; d++) cells.push({ key: dateKey(year, month0, d), day: d, inMonth: true });
  let nd = 1;
  // Fill only to the end of the last week (a whole number of rows) — not a
  // fixed 6th week — so months that fit in 5 rows don't render an empty row.
  while (cells.length % 7 !== 0) {
    const nm = month0 === 11 ? 0 : month0 + 1;
    const ny = month0 === 11 ? year + 1 : year;
    cells.push({ key: dateKey(ny, nm, nd), day: nd, inMonth: false });
    nd++;
  }
  return cells;
}

function shiftMonth(month: string, delta: number): string {
  const [y, m] = month.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + delta, 1));
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}`;
}

export interface ScheduleCalendarProps {
  /** Events covering (at least) the displayed month. */
  events: ScheduleEvent[];
  /** Displayed month, `YYYY-MM`. */
  month: string;
  /** Selected day, `YYYY-MM-DD`. */
  selectedDate: string | null;
  /** Today, `YYYY-MM-DD` (passed in so server/client agree — no hydration drift). */
  today: string;
  onSelectDate: (date: string) => void;
  onMonthChange: (month: string) => void;
  /** Optional active-season marker shown beside the month label. */
  seasonLabel?: string | null;
}

export function ScheduleCalendar({
  events,
  month,
  selectedDate,
  today,
  onSelectDate,
  onMonthChange,
  seasonLabel,
}: ScheduleCalendarProps) {
  const cells = useMemo(() => buildMatrix(month), [month]);
  const byDay = useMemo(() => {
    const m = new Map<string, ScheduleEvent[]>();
    for (const e of events) {
      const key = eventDayKey(e.startAt, e.timezone);
      const list = m.get(key);
      if (list) list.push(e);
      else m.set(key, [e]);
    }
    return m;
  }, [events]);

  const [y, mo] = month.split("-").map(Number);

  return (
    <div className="app-card p-4">
      {/* Header */}
      <div className="mb-3 flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <h2 className="font-sport text-lg font-bold tracking-tight text-foreground">
            {MONTHS[mo - 1]} {y}
          </h2>
          {seasonLabel ? (
            <span className="truncate rounded-full bg-secondary px-2 py-0.5 text-[11px] font-medium text-secondary-foreground">
              {seasonLabel}
            </span>
          ) : null}
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <button
            type="button"
            aria-label="Previous month"
            onClick={() => onMonthChange(shiftMonth(month, -1))}
            className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
          >
            <ChevronLeft className="size-4" />
          </button>
          <button
            type="button"
            aria-label="Next month"
            onClick={() => onMonthChange(shiftMonth(month, 1))}
            className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
          >
            <ChevronRight className="size-4" />
          </button>
        </div>
      </div>

      {/* Weekday row */}
      <div className="grid grid-cols-7 gap-1 text-center text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
        {WEEKDAYS.map((w) => (
          <div key={w} className="py-1">{w}</div>
        ))}
      </div>

      {/* Day cells */}
      <div className="mt-1 grid grid-cols-7 gap-1">
        {cells.map((c) => {
          const dayEvents = byDay.get(c.key) ?? [];
          const isToday = c.key === today;
          const isSelected = c.key === selectedDate;
          return (
            <button
              key={c.key}
              type="button"
              aria-label={c.key}
              aria-current={isSelected ? "date" : undefined}
              onClick={() => onSelectDate(c.key)}
              className={cn(
                "flex aspect-square flex-col items-center gap-1 rounded-lg border p-1 text-sm transition-colors focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50",
                c.inMonth ? "text-foreground" : "text-muted-foreground/50",
                isSelected
                  ? "border-primary bg-primary/10"
                  : "border-transparent hover:border-border hover:bg-secondary/60",
              )}
            >
              <span
                className={cn(
                  "grid size-6 place-items-center rounded-full text-xs tabular-nums",
                  isToday && "bg-primary font-bold text-primary-foreground",
                  isSelected && !isToday && "font-bold text-primary",
                )}
              >
                {c.day}
              </span>
              {dayEvents.length > 0 ? (
                <span className="flex items-center gap-0.5">
                  {dayEvents.slice(0, 3).map((e) => (
                    <span key={e.id} aria-hidden className="size-1.5 rounded-full" style={{ background: eventAccentVar(e.eventType) }} />
                  ))}
                  {dayEvents.length > 3 ? (
                    <span className="text-[9px] font-semibold text-muted-foreground">+{dayEvents.length - 3}</span>
                  ) : null}
                </span>
              ) : null}
            </button>
          );
        })}
      </div>
    </div>
  );
}
