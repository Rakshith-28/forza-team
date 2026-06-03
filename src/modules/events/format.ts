/**
 * Timezone-aware event time formatting. Events store TIMESTAMPTZ + a `timezone`
 * string; we always render the instant in that timezone (BUILD_PLAN — times in
 * the event's tz, falling back to the club's). Pure + isomorphic (client+server).
 */
export function formatEventTime(iso: string | Date, timezone: string): string {
  const d = typeof iso === "string" ? new Date(iso) : iso;
  try {
    return new Intl.DateTimeFormat("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
      timeZone: timezone,
      timeZoneName: "short",
    }).format(d);
  } catch {
    // Invalid tz string — fall back to the runtime default.
    return d.toLocaleString();
  }
}

/** Render an instant as a `yyyy-MM-ddTHH:mm` string in `timezone` for <input type="datetime-local">. */
export function toDatetimeLocal(date: Date, timezone: string): string {
  try {
    const parts = new Intl.DateTimeFormat("en-CA", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
      timeZone: timezone,
    }).formatToParts(date);
    const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "00";
    return `${get("year")}-${get("month")}-${get("day")}T${get("hour")}:${get("minute")}`;
  } catch {
    return date.toISOString().slice(0, 16);
  }
}

export function formatEventDay(iso: string | Date, timezone: string): string {
  const d = typeof iso === "string" ? new Date(iso) : iso;
  try {
    return new Intl.DateTimeFormat("en-US", {
      weekday: "long",
      month: "long",
      day: "numeric",
      year: "numeric",
      timeZone: timezone,
    }).format(d);
  } catch {
    return d.toLocaleDateString();
  }
}
