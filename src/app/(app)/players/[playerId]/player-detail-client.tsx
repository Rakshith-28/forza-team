"use client";

import { useActionState, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { addMembershipAction, updatePlayerAction } from "@/modules/roster/actions";
import { INITIAL_STATE } from "@/modules/roster/action-state";
import { PLAYER_POSITION_LABELS, PLAYER_POSITIONS, PLAYER_STATUSES } from "@/modules/roster/schemas";

export interface PlayerEditData {
  id: string;
  firstName: string;
  lastName: string;
  preferredName: string | null;
  dateOfBirth: string | null; // yyyy-mm-dd
  jerseyNumber: string | null;
  primaryPosition: string | null;
  secondaryPosition: string | null;
  emergencyContactName: string | null;
  emergencyContactPhone: string | null;
  medicalNotes: string | null;
  allergyNotes: string | null;
  status: string;
}

export interface TeamOption {
  id: string;
  name: string;
}

export function PlayerEditSection({ player }: { player: PlayerEditData }) {
  const [editing, setEditing] = useState(false);
  const [state, action, pending] = useActionState(updatePlayerAction, INITIAL_STATE);

  if (!editing) {
    return (
      <Button variant="outline" size="sm" onClick={() => setEditing(true)}>
        Edit player
      </Button>
    );
  }

  return (
    <form action={action} className="flex flex-col gap-4 rounded-lg border bg-card p-5">
      <input type="hidden" name="playerId" value={player.id} />
      <div className="grid gap-4 sm:grid-cols-2">
        <Field id="firstName" label="First name">
          <Input id="firstName" name="firstName" defaultValue={player.firstName} required />
        </Field>
        <Field id="lastName" label="Last name">
          <Input id="lastName" name="lastName" defaultValue={player.lastName} required />
        </Field>
        <Field id="preferredName" label="Preferred name">
          <Input id="preferredName" name="preferredName" defaultValue={player.preferredName ?? ""} />
        </Field>
        <Field id="dateOfBirth" label="Date of birth">
          <Input id="dateOfBirth" name="dateOfBirth" type="date" defaultValue={player.dateOfBirth ?? ""} />
        </Field>
        <Field id="jerseyNumber" label="Jersey number">
          <Input id="jerseyNumber" name="jerseyNumber" defaultValue={player.jerseyNumber ?? ""} />
        </Field>
        <Field id="status" label="Status">
          <Select id="status" name="status" defaultValue={player.status}>
            {PLAYER_STATUSES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </Select>
        </Field>
        <Field id="primaryPosition" label="Primary position">
          <Select id="primaryPosition" name="primaryPosition" defaultValue={player.primaryPosition ?? ""}>
            <option value="">— None —</option>
            {PLAYER_POSITIONS.map((p) => (
              <option key={p} value={p}>
                {PLAYER_POSITION_LABELS[p]}
              </option>
            ))}
          </Select>
        </Field>
        <Field id="secondaryPosition" label="Secondary position">
          <Select id="secondaryPosition" name="secondaryPosition" defaultValue={player.secondaryPosition ?? ""}>
            <option value="">— None —</option>
            {PLAYER_POSITIONS.map((p) => (
              <option key={p} value={p}>
                {PLAYER_POSITION_LABELS[p]}
              </option>
            ))}
          </Select>
        </Field>
        <Field id="emergencyContactName" label="Emergency contact name">
          <Input id="emergencyContactName" name="emergencyContactName" defaultValue={player.emergencyContactName ?? ""} />
        </Field>
        <Field id="emergencyContactPhone" label="Emergency contact phone">
          <Input id="emergencyContactPhone" name="emergencyContactPhone" defaultValue={player.emergencyContactPhone ?? ""} />
        </Field>
      </div>
      <Field id="medicalNotes" label="Medical notes">
        <Input id="medicalNotes" name="medicalNotes" defaultValue={player.medicalNotes ?? ""} />
      </Field>
      <Field id="allergyNotes" label="Allergy notes">
        <Input id="allergyNotes" name="allergyNotes" defaultValue={player.allergyNotes ?? ""} />
      </Field>
      {state.error ? <p className="text-sm text-destructive" role="alert">{state.error}</p> : null}
      {state.ok ? <p className="text-sm text-primary" role="status">Saved.</p> : null}
      <div className="flex gap-2">
        <Button type="submit" size="sm" disabled={pending}>
          {pending ? "Saving…" : "Save changes"}
        </Button>
        <Button type="button" size="sm" variant="outline" onClick={() => setEditing(false)}>
          Close
        </Button>
      </div>
    </form>
  );
}

export function AddMembershipForm({ playerId, teams }: { playerId: string; teams: TeamOption[] }) {
  const [state, action, pending] = useActionState(addMembershipAction, INITIAL_STATE);

  if (teams.length === 0) {
    return <p className="text-sm text-muted-foreground">No teams available to add this player to.</p>;
  }

  return (
    <form action={action} className="flex flex-col gap-3 sm:flex-row sm:items-end">
      <input type="hidden" name="playerId" value={playerId} />
      <div className="flex flex-1 flex-col gap-1.5">
        <Label htmlFor="teamId">Add to team</Label>
        <Select id="teamId" name="teamId" defaultValue="" required>
          <option value="" disabled>
            Select a team…
          </option>
          {teams.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </Select>
      </div>
      <Button type="submit" disabled={pending}>
        {pending ? "Adding…" : "Add"}
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
