"use client";

import { useActionState, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { assignCoachAction, updateTeamAction } from "@/modules/clubs/actions";
import { INITIAL_STATE } from "@/modules/clubs/action-state";
import { COACH_ROLE_LABELS, COACH_ROLE_TYPES, TEAM_STATUSES } from "@/modules/clubs/schemas";

export interface TeamEditData {
  id: string;
  name: string;
  teamCode: string;
  seasonId: string | null;
  ageGroup: string | null;
  division: string | null;
  competitiveLevel: string | null;
  status: string;
}

export interface SeasonOption {
  id: string;
  name: string;
}

// Keyed by the team's `version` (updatedAt) at the host, so a successful save
// remounts it collapsed; validation errors keep it open.
export function TeamEditSection({ team, seasons }: { team: TeamEditData; seasons: SeasonOption[] }) {
  const [editing, setEditing] = useState(false);
  const [state, action, pending] = useActionState(updateTeamAction, INITIAL_STATE);

  if (!editing) {
    return (
      <Button variant="outline" size="sm" onClick={() => setEditing(true)}>
        Edit team
      </Button>
    );
  }

  return (
    <form action={action} className="flex flex-col gap-4 rounded-lg border bg-card p-5">
      <input type="hidden" name="teamId" value={team.id} />
      <div className="grid gap-4 sm:grid-cols-2">
        <Field id="name" label="Team name">
          <Input id="name" name="name" defaultValue={team.name} required />
        </Field>
        <Field id="teamCode" label="Team code">
          <Input id="teamCode" name="teamCode" defaultValue={team.teamCode} required />
        </Field>
        <Field id="seasonId" label="Season">
          <Select id="seasonId" name="seasonId" defaultValue={team.seasonId ?? ""}>
            <option value="">— None —</option>
            {seasons.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field id="status" label="Status">
          <Select id="status" name="status" defaultValue={team.status}>
            {TEAM_STATUSES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </Select>
        </Field>
        <Field id="ageGroup" label="Age group">
          <Input id="ageGroup" name="ageGroup" defaultValue={team.ageGroup ?? ""} />
        </Field>
        <Field id="division" label="Division">
          <Input id="division" name="division" defaultValue={team.division ?? ""} />
        </Field>
        <Field id="competitiveLevel" label="Competitive level">
          <Input id="competitiveLevel" name="competitiveLevel" defaultValue={team.competitiveLevel ?? ""} />
        </Field>
      </div>
      {state.error ? <p className="text-sm text-destructive" role="alert">{state.error}</p> : null}
      <div className="flex gap-2">
        <Button type="submit" size="sm" disabled={pending}>
          {pending ? "Saving…" : "Save changes"}
        </Button>
        <Button type="button" size="sm" variant="outline" onClick={() => setEditing(false)}>
          Cancel
        </Button>
      </div>
    </form>
  );
}

export interface CoachOption {
  id: string;
  label: string;
}

export function CoachAssignForm({ teamId, assignable }: { teamId: string; assignable: CoachOption[] }) {
  const [state, action, pending] = useActionState(assignCoachAction, INITIAL_STATE);

  if (assignable.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No club members with a Coach role to assign yet. Invite coaches first.
      </p>
    );
  }

  return (
    <form action={action} className="flex flex-col gap-3 sm:flex-row sm:items-end">
      <input type="hidden" name="teamId" value={teamId} />
      <div className="flex flex-1 flex-col gap-1.5">
        <Label htmlFor="userId">Coach</Label>
        <Select id="userId" name="userId" defaultValue="" required>
          <option value="" disabled>
            Select a coach…
          </option>
          {assignable.map((c) => (
            <option key={c.id} value={c.id}>
              {c.label}
            </option>
          ))}
        </Select>
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="roleType">Role</Label>
        <Select id="roleType" name="roleType" defaultValue="HEAD_COACH">
          {COACH_ROLE_TYPES.map((r) => (
            <option key={r} value={r}>
              {COACH_ROLE_LABELS[r]}
            </option>
          ))}
        </Select>
      </div>
      <Button type="submit" disabled={pending}>
        {pending ? "Assigning…" : "Assign"}
      </Button>
      {state.error ? (
        <p className="text-sm text-destructive sm:basis-full" role="alert">
          {state.error}
        </p>
      ) : null}
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
