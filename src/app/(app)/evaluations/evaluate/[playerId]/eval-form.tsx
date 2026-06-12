"use client";

import { useActionState, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { savePlayerEvaluationAction } from "@/modules/evaluations/actions";
import { INITIAL_STATE } from "@/modules/evaluations/action-state";

export interface Criterion {
  id: string;
  label: string;
  minScore: number;
  maxScore: number;
}
export interface TemplateOpt {
  id: string;
  name: string;
  criteria: Criterion[];
}
export interface NamedOpt {
  id: string;
  name: string;
}

/**
 * Coach/admin player-evaluation form. Pick team + cycle + template, score each
 * criterion, and write summary / player-visible / coach-only notes. The overall
 * score is computed server-side as the unweighted mean.
 */
export function PlayerEvaluationForm({
  playerId,
  teams,
  cycles,
  templates,
}: {
  playerId: string;
  teams: NamedOpt[];
  cycles: NamedOpt[];
  templates: TemplateOpt[];
}) {
  const [state, action, pending] = useActionState(savePlayerEvaluationAction, INITIAL_STATE);
  const [templateId, setTemplateId] = useState(templates[0]?.id ?? "");
  const template = templates.find((t) => t.id === templateId);

  if (teams.length === 0) {
    return <p className="text-sm text-muted-foreground">This player isn&apos;t on a team you can evaluate.</p>;
  }
  if (cycles.length === 0 || templates.length === 0) {
    return <p className="text-sm text-muted-foreground">Create an evaluation cycle and template first.</p>;
  }

  return (
    <form action={action} className="flex flex-col gap-4">
      <input type="hidden" name="playerId" value={playerId} />
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="ev-team">Team</Label>
          <Select id="ev-team" name="teamId" defaultValue={teams[0]?.id} required>
            {teams.map((t) => (
              <option key={t.id} value={t.id}>{t.name}</option>
            ))}
          </Select>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="ev-cycle">Cycle</Label>
          <Select id="ev-cycle" name="evaluationCycleId" defaultValue={cycles[0]?.id} required>
            {cycles.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </Select>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="ev-template">Template</Label>
          <Select id="ev-template" name="templateId" value={templateId} onChange={(e) => setTemplateId(e.target.value)} required>
            {templates.map((t) => (
              <option key={t.id} value={t.id}>{t.name}</option>
            ))}
          </Select>
        </div>
      </div>

      <div className="flex flex-col gap-2 rounded-lg border bg-card p-4">
        <p className="font-sport text-sm font-bold uppercase tracking-wide text-muted-foreground">Criterion scores</p>
        {template?.criteria.map((c) => (
          <div key={c.id} className="flex items-center gap-3">
            <input type="hidden" name="criterionId" value={c.id} />
            <span className="min-w-0 flex-1 truncate text-sm text-foreground">{c.label}</span>
            <Input
              type="number"
              name={`score_${c.id}`}
              min={c.minScore}
              max={c.maxScore}
              step="0.5"
              defaultValue={c.minScore}
              className="w-24"
              aria-label={`${c.label} score`}
              required
            />
            <span className="w-16 text-xs text-muted-foreground">/ {c.maxScore}</span>
          </div>
        ))}
      </div>

      <Note name="summaryComment" label="Summary (visible to players)" />
      <Note name="playerVisibleNotes" label="Player-visible notes" />
      <Note name="coachOnlyNotes" label="Coach-only notes (never shown to players)" />

      {state.error ? <p className="text-sm text-destructive" role="alert">{state.error}</p> : null}
      {state.ok ? <p className="text-sm text-primary" role="status">Evaluation saved.</p> : null}
      <div>
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : "Save evaluation"}
        </Button>
      </div>
    </form>
  );
}

function Note({ name, label }: { name: string; label: string }) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={name}>{label}</Label>
      <textarea
        id={name}
        name={name}
        rows={2}
        className="rounded-md border border-input bg-card px-3 py-2 text-sm shadow-xs focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
      />
    </div>
  );
}
