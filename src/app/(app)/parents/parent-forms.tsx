"use client";

import { useActionState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { linkParentAction, updateParentAction } from "@/modules/roster/actions";
import { INITIAL_STATE } from "@/modules/roster/action-state";
import { CONTACT_METHODS, RELATIONSHIP_LABELS, RELATIONSHIP_TYPES } from "@/modules/roster/schemas";

export interface ParentEditData {
  id: string;
  firstName: string;
  lastName: string;
  phone: string | null;
  secondaryPhone: string | null;
  preferredContactMethod: string | null;
  addressLine1: string | null;
  addressLine2: string | null;
  city: string | null;
  state: string | null;
  postalCode: string | null;
}

export function ParentEditForm({ parent }: { parent: ParentEditData }) {
  const [state, action, pending] = useActionState(updateParentAction, INITIAL_STATE);

  return (
    <form action={action} className="flex flex-col gap-4">
      <input type="hidden" name="parentId" value={parent.id} />
      <div className="grid gap-4 sm:grid-cols-2">
        <Field id="firstName" label="First name">
          <Input id="firstName" name="firstName" defaultValue={parent.firstName} required />
        </Field>
        <Field id="lastName" label="Last name">
          <Input id="lastName" name="lastName" defaultValue={parent.lastName} required />
        </Field>
        <Field id="phone" label="Phone">
          <Input id="phone" name="phone" defaultValue={parent.phone ?? ""} />
        </Field>
        <Field id="secondaryPhone" label="Secondary phone">
          <Input id="secondaryPhone" name="secondaryPhone" defaultValue={parent.secondaryPhone ?? ""} />
        </Field>
        <Field id="preferredContactMethod" label="Preferred contact">
          <Select id="preferredContactMethod" name="preferredContactMethod" defaultValue={parent.preferredContactMethod ?? ""}>
            <option value="">— None —</option>
            {CONTACT_METHODS.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </Select>
        </Field>
        <Field id="addressLine1" label="Address line 1">
          <Input id="addressLine1" name="addressLine1" defaultValue={parent.addressLine1 ?? ""} />
        </Field>
        <Field id="addressLine2" label="Address line 2">
          <Input id="addressLine2" name="addressLine2" defaultValue={parent.addressLine2 ?? ""} />
        </Field>
        <Field id="city" label="City">
          <Input id="city" name="city" defaultValue={parent.city ?? ""} />
        </Field>
        <Field id="state" label="State">
          <Input id="state" name="state" defaultValue={parent.state ?? ""} />
        </Field>
        <Field id="postalCode" label="Postal code">
          <Input id="postalCode" name="postalCode" defaultValue={parent.postalCode ?? ""} />
        </Field>
      </div>
      {state.error ? <p className="text-sm text-destructive" role="alert">{state.error}</p> : null}
      {state.ok ? <p className="text-sm text-primary" role="status">Saved.</p> : null}
      <div>
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : "Save changes"}
        </Button>
      </div>
    </form>
  );
}

export interface PlayerOption {
  id: string;
  name: string;
}

export function LinkChildForm({ parentId, players }: { parentId: string; players: PlayerOption[] }) {
  const [state, action, pending] = useActionState(linkParentAction, INITIAL_STATE);

  if (players.length === 0) {
    return <p className="text-sm text-muted-foreground">No unlinked players available to link.</p>;
  }

  return (
    <form action={action} className="flex flex-col gap-3">
      <input type="hidden" name="parentId" value={parentId} />
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <div className="flex flex-1 flex-col gap-1.5">
          <Label htmlFor="playerId">Child</Label>
          <Select id="playerId" name="playerId" defaultValue="" required>
            <option value="" disabled>
              Select a player…
            </option>
            {players.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </Select>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="relationshipType">Relationship</Label>
          <Select id="relationshipType" name="relationshipType" defaultValue="GUARDIAN">
            {RELATIONSHIP_TYPES.map((r) => (
              <option key={r} value={r}>
                {RELATIONSHIP_LABELS[r]}
              </option>
            ))}
          </Select>
        </div>
      </div>
      <div className="flex flex-wrap gap-4 text-sm">
        <label className="flex items-center gap-2">
          <input type="checkbox" name="isPrimaryGuardian" /> Primary guardian
        </label>
        <label className="flex items-center gap-2">
          <input type="checkbox" name="canPickup" /> Can pick up
        </label>
        <label className="flex items-center gap-2">
          <input type="checkbox" name="canPay" defaultChecked /> Can pay
        </label>
      </div>
      <div>
        <Button type="submit" disabled={pending}>
          {pending ? "Linking…" : "Link child"}
        </Button>
      </div>
      {state.error ? <p className="text-sm text-destructive" role="alert">{state.error}</p> : null}
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
