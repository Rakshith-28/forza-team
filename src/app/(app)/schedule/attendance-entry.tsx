"use client";

import { useActionState } from "react";

import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { recordAttendanceAction } from "@/modules/events/actions";
import { INITIAL_STATE } from "@/modules/events/action-state";
import { ATTENDANCE_LABELS, ATTENDANCE_STATUSES } from "@/modules/events/schemas";

export interface AttendanceRow {
  playerId: string;
  name: string;
  current: string | null;
}

/**
 * Bulk attendance quick-entry. One status select per roster player; submit marks
 * them all in a single upsert pass. Mobile-friendly (large tap targets, sticky
 * save). Staff-only — the service rejects non-staff.
 */
export function AttendanceEntry({ eventId, rows }: { eventId: string; rows: AttendanceRow[] }) {
  const [state, action, pending] = useActionState(recordAttendanceAction, INITIAL_STATE);

  if (rows.length === 0) {
    return <p className="text-sm text-muted-foreground">No players on this team yet.</p>;
  }

  return (
    <form action={action} className="flex flex-col gap-3">
      <input type="hidden" name="eventId" value={eventId} />
      <ul className="flex flex-col gap-2">
        {rows.map((r) => (
          <li key={r.playerId} className="flex items-center gap-3 rounded-lg border bg-card p-2">
            <input type="hidden" name="playerId" value={r.playerId} />
            <span className="min-w-0 flex-1 truncate text-sm font-medium text-foreground">{r.name}</span>
            <Select
              name={`status_${r.playerId}`}
              defaultValue={r.current ?? ""}
              aria-label={`Attendance for ${r.name}`}
              className="h-9 w-36"
            >
              <option value="">—</option>
              {ATTENDANCE_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {ATTENDANCE_LABELS[s]}
                </option>
              ))}
            </Select>
          </li>
        ))}
      </ul>
      {state.error ? <p className="text-sm text-destructive" role="alert">{state.error}</p> : null}
      {state.ok ? <p className="text-sm text-primary" role="status">Attendance saved.</p> : null}
      <div className="sticky bottom-0 bg-background py-2">
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : "Save attendance"}
        </Button>
      </div>
    </form>
  );
}
