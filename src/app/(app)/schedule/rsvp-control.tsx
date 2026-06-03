"use client";

import { useActionState } from "react";

import { Select } from "@/components/ui/select";
import { submitRsvpAction } from "@/modules/events/actions";
import { INITIAL_STATE } from "@/modules/events/action-state";
import { RSVP_LABELS, RSVP_STATUSES } from "@/modules/events/schemas";

/**
 * Per-child RSVP selector. Auto-submits on change (mobile-friendly). One per
 * (event, child); the service enforces parent → own-child-only.
 */
export function RsvpControl({
  eventId,
  playerId,
  playerName,
  current,
}: {
  eventId: string;
  playerId: string;
  playerName: string;
  current: string | null;
}) {
  const [state, action, pending] = useActionState(submitRsvpAction, INITIAL_STATE);

  return (
    <form action={action} className="flex items-center gap-2">
      <input type="hidden" name="eventId" value={eventId} />
      <input type="hidden" name="playerId" value={playerId} />
      <span className="min-w-0 flex-1 truncate text-sm text-foreground">{playerName}</span>
      <Select
        name="responseStatus"
        defaultValue={current ?? ""}
        disabled={pending}
        aria-label={`RSVP for ${playerName}`}
        className="h-8 w-32"
        onChange={(e) => e.currentTarget.form?.requestSubmit()}
      >
        <option value="" disabled>
          RSVP…
        </option>
        {RSVP_STATUSES.map((s) => (
          <option key={s} value={s}>
            {RSVP_LABELS[s]}
          </option>
        ))}
      </Select>
      {state.error ? <span className="text-xs text-destructive">!</span> : null}
    </form>
  );
}
