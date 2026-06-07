import { eventDayKey } from "./format";

/**
 * Compute the calendar's "today", displayed month, and the event-fetch window
 * for the schedule surfaces. The window spans the previous month through two
 * months ahead so a few prev/next steps stay within the fetched data (no blank
 * flash, no refetch on month nav within range). Pure + isomorphic.
 */
export function scheduleWindow(now: Date, timezone: string): {
  todayKey: string;
  month: string;
  from: Date;
  to: Date;
} {
  const todayKey = eventDayKey(now, timezone); // YYYY-MM-DD in the club tz
  const month = todayKey.slice(0, 7); // YYYY-MM
  const [y, m] = month.split("-").map(Number);
  const from = new Date(Date.UTC(y, m - 2, 1)); // start of previous month
  const to = new Date(Date.UTC(y, m + 2, 1)); // start of (current + 2) month
  return { todayKey, month, from, to };
}
