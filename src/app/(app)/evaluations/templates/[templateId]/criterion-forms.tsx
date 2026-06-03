"use client";

import { useActionState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createCriterionAction, updateCriterionAction, updateTemplateAction } from "@/modules/evaluations/actions";
import { INITIAL_STATE } from "@/modules/evaluations/action-state";

export function AddCriterionForm({ templateId }: { templateId: string }) {
  const [state, action, pending] = useActionState(createCriterionAction, INITIAL_STATE);
  return (
    <form action={action} className="flex flex-col gap-3 sm:flex-row sm:items-end">
      <input type="hidden" name="templateId" value={templateId} />
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="cr-code">Code</Label>
        <Input id="cr-code" name="code" placeholder="FINISHING" required />
      </div>
      <div className="flex flex-1 flex-col gap-1.5">
        <Label htmlFor="cr-label">Label</Label>
        <Input id="cr-label" name="label" placeholder="Finishing" required />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="cr-min">Min</Label>
        <Input id="cr-min" name="minScore" type="number" defaultValue={0} className="w-20" />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="cr-max">Max</Label>
        <Input id="cr-max" name="maxScore" type="number" defaultValue={10} className="w-20" />
      </div>
      <Button type="submit" disabled={pending}>
        {pending ? "Adding…" : "Add"}
      </Button>
      {state.error ? <p className="text-sm text-destructive sm:basis-full" role="alert">{state.error}</p> : null}
    </form>
  );
}

export interface CriterionData {
  id: string;
  code: string;
  label: string;
  minScore: number;
  maxScore: number;
  isActive: boolean;
}

export function EditCriterionForm({ templateId, criterion }: { templateId: string; criterion: CriterionData }) {
  const [state, action, pending] = useActionState(updateCriterionAction, INITIAL_STATE);
  return (
    <form action={action} className="flex flex-wrap items-end gap-2">
      <input type="hidden" name="templateId" value={templateId} />
      <input type="hidden" name="criterionId" value={criterion.id} />
      <span className="w-28 shrink-0 text-xs uppercase tracking-wide text-muted-foreground">{criterion.code}</span>
      <Input name="label" defaultValue={criterion.label} className="flex-1" aria-label="Label" required />
      <Input name="minScore" type="number" defaultValue={criterion.minScore} className="w-16" aria-label="Min" />
      <Input name="maxScore" type="number" defaultValue={criterion.maxScore} className="w-16" aria-label="Max" />
      <label className="flex items-center gap-1 text-xs">
        <input type="checkbox" name="isActive" defaultChecked={criterion.isActive} /> Active
      </label>
      <Button type="submit" size="sm" variant="outline" disabled={pending}>
        {pending ? "…" : "Save"}
      </Button>
      {state.error ? <p className="basis-full text-sm text-destructive" role="alert">{state.error}</p> : null}
    </form>
  );
}

export function TemplateNameForm({ templateId, name, description }: { templateId: string; name: string; description: string | null }) {
  const [state, action, pending] = useActionState(updateTemplateAction, INITIAL_STATE);
  return (
    <form action={action} className="flex flex-col gap-3">
      <input type="hidden" name="templateId" value={templateId} />
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="tn-name">Template name</Label>
        <Input id="tn-name" name="name" defaultValue={name} required />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="tn-desc">Description</Label>
        <Input id="tn-desc" name="description" defaultValue={description ?? ""} />
      </div>
      {state.error ? <p className="text-sm text-destructive" role="alert">{state.error}</p> : null}
      {state.ok ? <p className="text-sm text-primary" role="status">Saved.</p> : null}
      <div>
        <Button type="submit" size="sm" disabled={pending}>
          {pending ? "Saving…" : "Save"}
        </Button>
      </div>
    </form>
  );
}
