"use client";

import { useActionState, useEffect, useRef, useState } from "react";

import { InviteLinkDialog } from "@/components/app/invite-link-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { assignCoachAction, inviteCoachAction } from "@/modules/coaches/actions";
import { INITIAL_STATE } from "@/modules/coaches/action-state";
import { COACH_ROLE_LABELS, COACH_ROLE_TYPES } from "@/modules/clubs/schemas";

export interface TeamOption {
  id: string;
  name: string;
}

export function InviteCoachForm({ teams }: { teams: TeamOption[] }) {
  const [state, action, pending] = useActionState(inviteCoachAction, INITIAL_STATE);
  const ref = useRef<HTMLFormElement>(null);
  const [dismissed, setDismissed] = useState<string | null>(null);
  useEffect(() => {
    if (state.ok) ref.current?.reset();
  }, [state]);
  // Derive the dialog from the action result (each invite has a unique URL); the
  // user dismisses it by remembering the last-shown URL — no setState-in-effect.
  const linkUrl = state.ok ? state.acceptUrl ?? null : null;

  return (
    <form ref={ref} action={action} className="flex flex-col gap-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="ic-email">Coach email</Label>
          <Input id="ic-email" name="email" type="email" placeholder="coach@example.com" required />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="ic-team">Initial team (optional)</Label>
          <Select id="ic-team" name="teamId" defaultValue="">
            <option value="">— None —</option>
            {teams.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </Select>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="ic-role">Role type</Label>
          <Select id="ic-role" name="roleType" defaultValue="ASSISTANT_COACH">
            {COACH_ROLE_TYPES.map((r) => (
              <option key={r} value={r}>
                {COACH_ROLE_LABELS[r]}
              </option>
            ))}
          </Select>
        </div>
      </div>
      {state.error ? <p className="text-sm text-destructive" role="alert">{state.error}</p> : null}
      {state.ok && !state.notice ? <p className="text-sm text-primary" role="status">Invitation sent.</p> : null}
      {state.ok && state.notice ? <p className="text-sm text-amber-600" role="status">{state.notice}</p> : null}
      <div>
        <Button type="submit" disabled={pending}>
          {pending ? "Sending…" : "Send invite"}
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">
        The coach sets their password via the invite link; the role and any initial team apply on acceptance.
      </p>
      <InviteLinkDialog
        url={linkUrl}
        open={linkUrl !== null && linkUrl !== dismissed}
        onOpenChange={(o) => !o && setDismissed(linkUrl)}
      />
    </form>
  );
}

export function AssignCoachForm({ userId, teams }: { userId: string; teams: TeamOption[] }) {
  const [state, action, pending] = useActionState(assignCoachAction, INITIAL_STATE);
  const [open, setOpen] = useState(false);

  if (!open) {
    return (
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        Assign to team
      </Button>
    );
  }

  return (
    <form action={action} className="flex flex-wrap items-end gap-2 rounded-lg border bg-card p-3">
      <input type="hidden" name="userId" value={userId} />
      <div className="flex flex-col gap-1.5">
        <Label htmlFor={`as-team-${userId}`}>Team</Label>
        <Select id={`as-team-${userId}`} name="teamId" defaultValue="" required>
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
      <div className="flex flex-col gap-1.5">
        <Label htmlFor={`as-role-${userId}`}>Role</Label>
        <Select id={`as-role-${userId}`} name="roleType" defaultValue="ASSISTANT_COACH">
          {COACH_ROLE_TYPES.map((r) => (
            <option key={r} value={r}>
              {COACH_ROLE_LABELS[r]}
            </option>
          ))}
        </Select>
      </div>
      <Button type="submit" size="sm" disabled={pending}>
        {pending ? "Assigning…" : "Assign"}
      </Button>
      <Button type="button" size="sm" variant="outline" onClick={() => setOpen(false)}>
        Cancel
      </Button>
      {state.error ? <p className="basis-full text-sm text-destructive" role="alert">{state.error}</p> : null}
      {state.ok ? <p className="basis-full text-sm text-primary" role="status">Assigned.</p> : null}
    </form>
  );
}
