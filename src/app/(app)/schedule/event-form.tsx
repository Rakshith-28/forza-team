"use client";

import { useActionState, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { createEventAction, updateEventAction } from "@/modules/events/actions";
import { INITIAL_STATE } from "@/modules/events/action-state";
import { EVENT_STATUSES, EVENT_TYPE_LABELS, EVENT_TYPES } from "@/modules/events/schemas";

export interface TeamOption {
  id: string;
  name: string;
}

export interface EventFormData {
  id: string;
  title: string;
  eventType: string;
  audienceScope: string; // "CLUB_WIDE" | "TEAMS"
  teamIds: string[];
  description: string | null;
  startAtLocal: string; // yyyy-MM-ddTHH:mm
  endAtLocal: string;
  locationName: string | null;
  opponentName: string | null;
  uniformNotes: string | null;
  status: string;
}

/**
 * Create/edit event form. `canClubWide` lets admins post club-wide events
 * (team = none); coaches must pick one of their assigned teams.
 */
export function EventForm({
  teams,
  canClubWide,
  event,
}: {
  teams: TeamOption[];
  canClubWide: boolean;
  event?: EventFormData;
}) {
  const editing = !!event;
  const [state, action, pending] = useActionState(
    editing ? updateEventAction : createEventAction,
    INITIAL_STATE,
  );
  const [eventType, setEventType] = useState(event?.eventType ?? "PRACTICE");
  const isGame = eventType === "GAME" || eventType === "TOURNAMENT";
  const [scope, setScope] = useState(event?.audienceScope ?? (canClubWide ? "CLUB_WIDE" : "TEAMS"));
  const [teamIds, setTeamIds] = useState<string[]>(event?.teamIds ?? []);

  return (
    <form action={action} className="flex flex-col gap-4">
      {editing ? <input type="hidden" name="eventId" value={event.id} /> : null}
      <div className="grid gap-4 sm:grid-cols-2">
        <Field id="title" label="Title">
          <Input id="title" name="title" defaultValue={event?.title ?? ""} required />
        </Field>
        <Field id="eventType" label="Type">
          <Select id="eventType" name="eventType" value={eventType} onChange={(e) => setEventType(e.target.value)}>
            {EVENT_TYPES.map((t) => (
              <option key={t} value={t}>
                {EVENT_TYPE_LABELS[t]}
              </option>
            ))}
          </Select>
        </Field>
        <div className="flex flex-col gap-2 sm:col-span-2">
          <Label>Audience</Label>
          {/* The chosen scope is what the service reads; coaches are TEAMS-only. */}
          <input type="hidden" name="audienceScope" value={scope} />
          {canClubWide ? (
            <div className="flex flex-wrap gap-4 text-sm">
              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  name="audienceScopeRadio"
                  checked={scope === "CLUB_WIDE"}
                  onChange={() => setScope("CLUB_WIDE")}
                />
                Whole club
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  name="audienceScopeRadio"
                  checked={scope === "TEAMS"}
                  onChange={() => setScope("TEAMS")}
                />
                Specific teams
              </label>
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">Pick the team(s) this event is for.</p>
          )}
          {scope === "TEAMS" ? (
            <div className="flex flex-col gap-1.5 rounded-md border p-3">
              {teams.length === 0 ? (
                <p className="text-sm text-muted-foreground">No teams available.</p>
              ) : (
                teams.map((t) => (
                  <label key={t.id} className="flex items-center gap-2 text-sm text-foreground">
                    <input
                      type="checkbox"
                      name="teamIds"
                      value={t.id}
                      checked={teamIds.includes(t.id)}
                      onChange={(e) =>
                        setTeamIds(e.target.checked ? [...teamIds, t.id] : teamIds.filter((x) => x !== t.id))
                      }
                    />
                    {t.name}
                  </label>
                ))
              )}
            </div>
          ) : null}
        </div>
        {editing ? (
          <Field id="status" label="Status">
            <Select id="status" name="status" defaultValue={event.status}>
              {EVENT_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </Select>
          </Field>
        ) : null}
        <Field id="startAt" label="Starts">
          <Input id="startAt" name="startAt" type="datetime-local" defaultValue={event?.startAtLocal ?? ""} required />
        </Field>
        <Field id="endAt" label="Ends">
          <Input id="endAt" name="endAt" type="datetime-local" defaultValue={event?.endAtLocal ?? ""} required />
        </Field>
        <Field id="locationName" label="Location">
          <Input id="locationName" name="locationName" defaultValue={event?.locationName ?? ""} />
        </Field>
        {isGame ? (
          <>
            <Field id="opponentName" label="Opponent">
              <Input id="opponentName" name="opponentName" defaultValue={event?.opponentName ?? ""} />
            </Field>
            <Field id="homeAway" label="Home / Away">
              <Select id="homeAway" name="homeAway" defaultValue="">
                <option value="">—</option>
                <option value="HOME">Home</option>
                <option value="AWAY">Away</option>
                <option value="NEUTRAL">Neutral</option>
              </Select>
            </Field>
          </>
        ) : null}
      </div>
      <Field id="description" label="Description">
        <textarea
          id="description"
          name="description"
          rows={3}
          defaultValue={event?.description ?? ""}
          className="rounded-md border border-input bg-card px-3 py-2 text-sm shadow-xs focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
        />
      </Field>
      <Field id="uniformNotes" label="Uniform / notes">
        <Input id="uniformNotes" name="uniformNotes" defaultValue={event?.uniformNotes ?? ""} />
      </Field>
      {state.error ? <p className="text-sm text-destructive" role="alert">{state.error}</p> : null}
      {state.ok ? <p className="text-sm text-primary" role="status">Saved.</p> : null}
      <div>
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : editing ? "Save changes" : "Create event"}
        </Button>
      </div>
    </form>
  );
}

function Field({ id, label, children }: { id: string; label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={id}>{label}</Label>
      {children}
    </div>
  );
}
