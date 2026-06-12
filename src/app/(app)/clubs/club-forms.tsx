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
import { CREATE_CLUB_INITIAL, INITIAL_STATE, type CreateClubState } from "@/modules/clubs/action-state";

import { CopyableLink } from "./copyable-link";
import { StatusBadge } from "../seasons/season-forms";

export interface ClubView {
  id: string;
  name: string;
  shortCode: string;
  status: string;
}

function InviteResult({ invite }: { invite: NonNullable<CreateClubState["invite"]> }) {
  return (
    <div className="rounded-lg border bg-card p-3" role="status">
      <p className="text-sm font-medium text-primary">Club created.</p>
      {invite.emailDelivered ? (
        <p className="mt-1 text-sm text-muted-foreground">Invitation emailed to {invite.email}.</p>
      ) : (
        <>
          <p className="mt-1 text-sm text-muted-foreground">
            Email isn&apos;t configured here — share this invite link with {invite.email}:
          </p>
          <div className="mt-2">
            <CopyableLink url={invite.acceptUrl} />
          </div>
        </>
      )}
    </div>
  );
}

export function CreateClubForm() {
  const [state, action, pending] = useActionState(createClubAction, CREATE_CLUB_INITIAL);
  const ref = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (state.ok) ref.current?.reset();
  }, [state]);

  return (
    <form ref={ref} action={action} className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
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
      </div>

      {/* Initial club admin — optional but prominent. A club with no admin is
          flagged as an orphan; you can also invite one later from club detail. */}
      <fieldset className="rounded-lg border border-dashed bg-secondary/30 p-4">
        <legend className="px-1 text-sm font-semibold text-foreground">Initial club admin</legend>
        <p className="text-xs text-muted-foreground">
          Invite someone to run this club. Optional — leave blank to create the club without an admin.
        </p>
        <div className="mt-3 grid gap-3 sm:grid-cols-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="admin-email">Admin email</Label>
            <Input id="admin-email" name="adminEmail" type="email" placeholder="admin@club.test" />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="admin-first">First name</Label>
            <Input id="admin-first" name="adminFirstName" />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="admin-last">Last name</Label>
            <Input id="admin-last" name="adminLastName" />
          </div>
        </div>
      </fieldset>

      {state.error ? (
        <p className="text-sm text-destructive" role="alert">
          {state.error}
        </p>
      ) : null}
      {state.ok && !state.invite ? (
        <p className="text-sm text-primary" role="status">
          Club created.
        </p>
      ) : null}
      {state.ok && state.invite ? <InviteResult invite={state.invite} /> : null}
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
 * Keyed by the club's updatedAt at the host so a successful save remounts it
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
