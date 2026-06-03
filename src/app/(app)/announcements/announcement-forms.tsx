"use client";

import { useActionState, useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { createAnnouncementAction } from "@/modules/comms/actions";
import { INITIAL_STATE } from "@/modules/comms/action-state";
import {
  ANNOUNCEMENT_AUDIENCES,
  ANNOUNCEMENT_AUDIENCE_LABELS,
  type AnnouncementAudience,
} from "@/modules/comms/schemas";

export interface TeamOption {
  id: string;
  name: string;
}

/**
 * Create-announcement form. `canClubWide` is false for coaches (they may only
 * post team-only announcements for their assigned teams). The audience options
 * are filtered accordingly, and the team picker appears for TEAM_ONLY.
 */
export function CreateAnnouncementForm({
  teams,
  canClubWide,
}: {
  teams: TeamOption[];
  canClubWide: boolean;
}) {
  const [state, action, pending] = useActionState(createAnnouncementAction, INITIAL_STATE);
  const [audience, setAudience] = useState<AnnouncementAudience>(canClubWide ? "CLUB_ALL" : "TEAM_ONLY");
  const ref = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.ok) {
      ref.current?.reset();
      // Reset the controlled audience back to its default after a successful save.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setAudience(canClubWide ? "CLUB_ALL" : "TEAM_ONLY");
    }
  }, [state, canClubWide]);

  const audiences = canClubWide ? ANNOUNCEMENT_AUDIENCES : (["TEAM_ONLY"] as const);

  return (
    <form ref={ref} action={action} className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="a-title">Title</Label>
        <Input id="a-title" name="title" placeholder="Match this Saturday" required />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="a-body">Message</Label>
        <textarea
          id="a-body"
          name="body"
          required
          rows={4}
          className="rounded-md border border-input bg-card px-3 py-2 text-sm shadow-xs focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
        />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="a-aud">Audience</Label>
          <Select
            id="a-aud"
            name="audienceType"
            value={audience}
            onChange={(e) => setAudience(e.target.value as AnnouncementAudience)}
          >
            {audiences.map((a) => (
              <option key={a} value={a}>
                {ANNOUNCEMENT_AUDIENCE_LABELS[a]}
              </option>
            ))}
          </Select>
        </div>
        {audience === "TEAM_ONLY" ? (
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="a-team">Team</Label>
            <Select id="a-team" name="teamId" defaultValue="" required>
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
        ) : null}
      </div>
      {state.error ? <p className="text-sm text-destructive" role="alert">{state.error}</p> : null}
      {state.ok ? <p className="text-sm text-primary" role="status">Draft created.</p> : null}
      <div>
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : "Create draft"}
        </Button>
      </div>
    </form>
  );
}
