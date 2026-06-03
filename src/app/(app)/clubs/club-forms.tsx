"use client";

import { useActionState, useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  archiveClubAction,
  createClubAction,
  updateClubAction,
} from "@/modules/clubs/actions";
import { INITIAL_STATE } from "@/modules/clubs/action-state";

import { StatusBadge } from "../seasons/season-forms";

export interface ClubView {
  id: string;
  name: string;
  shortCode: string;
  status: string;
}

export function CreateClubForm() {
  const [state, action, pending] = useActionState(createClubAction, INITIAL_STATE);
  const ref = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (state.ok) ref.current?.reset();
  }, [state]);

  return (
    <form ref={ref} action={action} className="flex flex-col gap-3 sm:flex-row sm:items-end">
      <div className="flex flex-1 flex-col gap-1.5">
        <Label htmlFor="c-name">Club name</Label>
        <Input id="c-name" name="name" placeholder="Riverside FC" required />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="c-code">Short code</Label>
        <Input id="c-code" name="shortCode" placeholder="RIV" required />
      </div>
      <Button type="submit" disabled={pending}>
        {pending ? "Creating…" : "Create club"}
      </Button>
      {state.error ? (
        <p className="text-sm text-destructive sm:basis-full" role="alert">
          {state.error}
        </p>
      ) : null}
    </form>
  );
}

export function ClubRow({ club }: { club: ClubView }) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-lg border bg-card p-4">
      <div>
        <p className="font-sport text-base font-bold text-foreground">{club.name}</p>
        <p className="text-sm text-muted-foreground">{club.shortCode}</p>
      </div>
      <div className="flex items-center gap-2">
        <StatusBadge status={club.status} />
        {club.status !== "ARCHIVED" ? (
          <form action={archiveClubAction}>
            <input type="hidden" name="clubId" value={club.id} />
            <Button size="sm" variant="ghost" type="submit" className="text-muted-foreground">
              Archive
            </Button>
          </form>
        ) : null}
      </div>
    </div>
  );
}

/**
 * Inline editor for a single club's name (used on the Club Admin dashboard).
 * Keyed by the club's updatedAt at the parent so a successful save remounts it
 * collapsed; errors keep it open.
 */
export function ClubNameForm({ clubId, name }: { clubId: string; name: string }) {
  const [editing, setEditing] = useState(false);
  const [state, action, pending] = useActionState(updateClubAction, INITIAL_STATE);

  if (!editing) {
    return (
      <Button variant="outline" size="sm" onClick={() => setEditing(true)}>
        Edit club name
      </Button>
    );
  }

  return (
    <form action={action} className="flex flex-col gap-2 sm:flex-row sm:items-end">
      <input type="hidden" name="clubId" value={clubId} />
      <div className="flex flex-1 flex-col gap-1.5">
        <Label htmlFor="club-name">Club name</Label>
        <Input id="club-name" name="name" defaultValue={name} required />
      </div>
      <div className="flex gap-2">
        <Button type="submit" size="sm" disabled={pending}>
          {pending ? "Saving…" : "Save"}
        </Button>
        <Button type="button" size="sm" variant="outline" onClick={() => setEditing(false)}>
          Cancel
        </Button>
      </div>
      {state.error ? (
        <p className="text-sm text-destructive sm:basis-full" role="alert">
          {state.error}
        </p>
      ) : null}
    </form>
  );
}
