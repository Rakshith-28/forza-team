"use client";

import { useActionState, useEffect, useRef } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { createCycleAction, createTemplateAction } from "@/modules/evaluations/actions";
import { INITIAL_STATE } from "@/modules/evaluations/action-state";
import { CYCLE_TYPE_LABELS, CYCLE_TYPES } from "@/modules/evaluations/schemas";

export interface TeamOption {
  id: string;
  name: string;
}

export function CreateTemplateForm() {
  const [state, action, pending] = useActionState(createTemplateAction, INITIAL_STATE);
  return (
    <form action={action} className="flex flex-col gap-3">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="t-name">Template name</Label>
        <Input id="t-name" name="name" placeholder="Default Player Evaluation" required />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="t-desc">Description</Label>
        <Input id="t-desc" name="description" placeholder="Optional" />
      </div>
      {state.error ? <p className="text-sm text-destructive" role="alert">{state.error}</p> : null}
      <div>
        <Button type="submit" disabled={pending}>
          {pending ? "Creating…" : "Create template"}
        </Button>
      </div>
    </form>
  );
}

export function CreateCycleForm({ teams }: { teams: TeamOption[] }) {
  const [state, action, pending] = useActionState(createCycleAction, INITIAL_STATE);
  const ref = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (state.ok) ref.current?.reset();
  }, [state]);

  return (
    <form ref={ref} action={action} className="flex flex-col gap-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="c-name">Cycle name</Label>
          <Input id="c-name" name="name" placeholder="2026 Mid-season" required />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="c-type">Type</Label>
          <Select id="c-type" name="cycleType" defaultValue="MIDSEASON">
            {CYCLE_TYPES.map((t) => (
              <option key={t} value={t}>
                {CYCLE_TYPE_LABELS[t]}
              </option>
            ))}
          </Select>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="c-team">Team (blank = club-wide)</Label>
          <Select id="c-team" name="teamId" defaultValue="">
            <option value="">— Club-wide —</option>
            {teams.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </Select>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="c-start">Starts</Label>
          <Input id="c-start" name="startsAt" type="date" required />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="c-end">Ends</Label>
          <Input id="c-end" name="endsAt" type="date" required />
        </div>
      </div>
      {state.error ? <p className="text-sm text-destructive" role="alert">{state.error}</p> : null}
      {state.ok ? <p className="text-sm text-primary" role="status">Cycle created.</p> : null}
      <div>
        <Button type="submit" disabled={pending}>
          {pending ? "Creating…" : "Create cycle"}
        </Button>
      </div>
    </form>
  );
}
