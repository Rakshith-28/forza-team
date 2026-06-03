"use client";

import { useActionState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { createTeamAction } from "@/modules/clubs/actions";
import { INITIAL_STATE } from "@/modules/clubs/action-state";

export interface SeasonOption {
  id: string;
  name: string;
}

export function CreateTeamForm({ seasons }: { seasons: SeasonOption[] }) {
  const [state, action, pending] = useActionState(createTeamAction, INITIAL_STATE);

  return (
    <form action={action} className="flex flex-col gap-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="t-name">Team name</Label>
          <Input id="t-name" name="name" placeholder="First Team" required />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="t-code">Team code</Label>
          <Input id="t-code" name="teamCode" placeholder="FIRST" required />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="t-season">Season</Label>
          <Select id="t-season" name="seasonId" defaultValue="">
            <option value="">— None —</option>
            {seasons.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </Select>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="t-age">Age group</Label>
          <Input id="t-age" name="ageGroup" placeholder="U16" />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="t-div">Division</Label>
          <Input id="t-div" name="division" placeholder="Division 1" />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="t-level">Competitive level</Label>
          <Input id="t-level" name="competitiveLevel" placeholder="Elite" />
        </div>
      </div>
      {state.error ? <p className="text-sm text-destructive" role="alert">{state.error}</p> : null}
      <div>
        <Button type="submit" disabled={pending}>
          {pending ? "Creating…" : "Create team"}
        </Button>
      </div>
    </form>
  );
}
