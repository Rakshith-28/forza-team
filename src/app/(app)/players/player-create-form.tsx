"use client";

import { useActionState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { createPlayerAction } from "@/modules/roster/actions";
import { INITIAL_STATE } from "@/modules/roster/action-state";
import { PLAYER_POSITION_LABELS, PLAYER_POSITIONS } from "@/modules/roster/schemas";

export interface TeamOption {
  id: string;
  name: string;
}

/** `teamRequired` is true for coaches (they may only add players to their teams). */
export function CreatePlayerForm({ teams, teamRequired }: { teams: TeamOption[]; teamRequired: boolean }) {
  const [state, action, pending] = useActionState(createPlayerAction, INITIAL_STATE);

  return (
    <form action={action} className="flex flex-col gap-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field id="firstName" label="First name">
          <Input id="firstName" name="firstName" required />
        </Field>
        <Field id="lastName" label="Last name">
          <Input id="lastName" name="lastName" required />
        </Field>
        <Field id="preferredName" label="Preferred name">
          <Input id="preferredName" name="preferredName" />
        </Field>
        <Field id="dateOfBirth" label="Date of birth">
          <Input id="dateOfBirth" name="dateOfBirth" type="date" />
        </Field>
        <Field id="jerseyNumber" label="Jersey number">
          <Input id="jerseyNumber" name="jerseyNumber" />
        </Field>
        <Field id="primaryPosition" label="Primary position">
          <Select id="primaryPosition" name="primaryPosition" defaultValue="">
            <option value="">— None —</option>
            {PLAYER_POSITIONS.map((p) => (
              <option key={p} value={p}>
                {PLAYER_POSITION_LABELS[p]}
              </option>
            ))}
          </Select>
        </Field>
        <Field id="secondaryPosition" label="Secondary position">
          <Select id="secondaryPosition" name="secondaryPosition" defaultValue="">
            <option value="">— None —</option>
            {PLAYER_POSITIONS.map((p) => (
              <option key={p} value={p}>
                {PLAYER_POSITION_LABELS[p]}
              </option>
            ))}
          </Select>
        </Field>
        <Field id="initialTeamId" label={teamRequired ? "Team (required)" : "Initial team"}>
          <Select id="initialTeamId" name="initialTeamId" defaultValue="" required={teamRequired}>
            <option value="">{teamRequired ? "Select a team…" : "— None —"}</option>
            {teams.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field id="emergencyContactName" label="Emergency contact name">
          <Input id="emergencyContactName" name="emergencyContactName" />
        </Field>
        <Field id="emergencyContactPhone" label="Emergency contact phone">
          <Input id="emergencyContactPhone" name="emergencyContactPhone" />
        </Field>
      </div>
      <Field id="medicalNotes" label="Medical notes">
        <Input id="medicalNotes" name="medicalNotes" />
      </Field>
      <Field id="allergyNotes" label="Allergy notes">
        <Input id="allergyNotes" name="allergyNotes" />
      </Field>
      {state.error ? <p className="text-sm text-destructive" role="alert">{state.error}</p> : null}
      <div>
        <Button type="submit" disabled={pending}>
          {pending ? "Adding…" : "Add player"}
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
