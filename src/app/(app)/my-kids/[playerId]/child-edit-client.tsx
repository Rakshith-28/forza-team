"use client";

import { useActionState, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { updateOwnChildAction } from "@/modules/roster/actions";
import { INITIAL_STATE } from "@/modules/roster/action-state";

export interface ChildEditData {
  id: string;
  preferredName: string | null;
  photoUrl: string | null;
  emergencyContactName: string | null;
  emergencyContactPhone: string | null;
  medicalNotes: string | null;
  allergyNotes: string | null;
}

/**
 * Parent self-service edit — limited to the approved whitelist
 * (preferred name, photo, emergency contacts, medical/allergy notes). Jersey,
 * positions, status and team/links are deliberately not editable here and are
 * also rejected server-side.
 */
export function ChildEditForm({ child }: { child: ChildEditData }) {
  const [editing, setEditing] = useState(false);
  const [state, action, pending] = useActionState(updateOwnChildAction, INITIAL_STATE);

  if (!editing) {
    return (
      <Button variant="outline" size="sm" onClick={() => setEditing(true)}>
        Edit details
      </Button>
    );
  }

  return (
    <form action={action} className="flex flex-col gap-4 rounded-lg border bg-card p-5">
      <input type="hidden" name="playerId" value={child.id} />
      <div className="grid gap-4 sm:grid-cols-2">
        <Field id="preferredName" label="Preferred name">
          <Input id="preferredName" name="preferredName" defaultValue={child.preferredName ?? ""} />
        </Field>
        <Field id="photoUrl" label="Photo URL">
          <Input id="photoUrl" name="photoUrl" defaultValue={child.photoUrl ?? ""} />
        </Field>
        <Field id="emergencyContactName" label="Emergency contact name">
          <Input id="emergencyContactName" name="emergencyContactName" defaultValue={child.emergencyContactName ?? ""} />
        </Field>
        <Field id="emergencyContactPhone" label="Emergency contact phone">
          <Input id="emergencyContactPhone" name="emergencyContactPhone" defaultValue={child.emergencyContactPhone ?? ""} />
        </Field>
      </div>
      <Field id="medicalNotes" label="Medical notes">
        <Input id="medicalNotes" name="medicalNotes" defaultValue={child.medicalNotes ?? ""} />
      </Field>
      <Field id="allergyNotes" label="Allergy notes">
        <Input id="allergyNotes" name="allergyNotes" defaultValue={child.allergyNotes ?? ""} />
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

function Field({ id, label, children }: { id: string; label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={id}>{label}</Label>
      {children}
    </div>
  );
}
