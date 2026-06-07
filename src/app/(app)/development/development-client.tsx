"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { StatusBadge } from "@/components/console";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import type { DevelopmentGoalRow } from "@/modules/evaluations/development-service";
import {
  GOAL_STATUSES,
  GOAL_STATUS_LABELS,
  GOAL_VISIBILITIES,
} from "@/modules/evaluations/development-schemas";

import { addGoalUpdateAction, createDevelopmentGoalAction } from "./actions";

const textareaCls =
  "min-h-16 w-full rounded-md border border-input bg-card px-3 py-2 text-sm shadow-xs focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50";

const STATUS_TONE: Record<string, string> = {
  OPEN: "bg-secondary text-ink-2",
  IN_PROGRESS: "bg-amber-100 text-amber-700",
  ACHIEVED: "bg-primary/10 text-primary",
  ON_HOLD: "bg-muted text-muted-foreground",
};

function GoalStatus({ status }: { status: string }) {
  return <StatusBadge status={GOAL_STATUS_LABELS[status as keyof typeof GOAL_STATUS_LABELS] ?? status} className={STATUS_TONE[status] ?? ""} />;
}

function fmtDate(d: Date | string | null): string {
  if (!d) return "—";
  return new Date(d).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

export function DevelopmentClient({
  goals,
  players,
}: {
  goals: DevelopmentGoalRow[];
  players: { playerId: string; teamId: string | null; name: string }[];
}) {
  const router = useRouter();
  const [playerId, setPlayerId] = useState("");
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("");
  const [visibility, setVisibility] = useState("COACH_ONLY");
  const [targetDate, setTargetDate] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function create() {
    setError(null);
    if (!playerId) {
      setError("Pick a player.");
      return;
    }
    startTransition(async () => {
      const res = await createDevelopmentGoalAction({ playerId, title, category, visibility, targetDate: targetDate || null });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setTitle("");
      setCategory("");
      setTargetDate("");
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Create goal */}
      <section className="rounded-xl border bg-card p-5 shadow-sm">
        <h2 className="font-sport text-base font-bold text-foreground">New development goal</h2>
        {players.length === 0 ? (
          <p className="mt-2 text-sm text-muted-foreground">No players in your scope yet.</p>
        ) : (
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="g-player">Player</Label>
              <Select id="g-player" value={playerId} onChange={(e) => setPlayerId(e.target.value)}>
                <option value="">Select a player…</option>
                {players.map((p) => (
                  <option key={p.playerId} value={p.playerId}>
                    {p.name}
                  </option>
                ))}
              </Select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="g-title">Goal</Label>
              <Input id="g-title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Improve weak-foot passing" />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="g-cat">Category</Label>
              <Input id="g-cat" value={category} onChange={(e) => setCategory(e.target.value)} placeholder="Technical, Physical…" />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="g-target">Target date</Label>
              <Input id="g-target" type="date" value={targetDate} onChange={(e) => setTargetDate(e.target.value)} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="g-vis">Visibility</Label>
              <Select id="g-vis" value={visibility} onChange={(e) => setVisibility(e.target.value)}>
                {GOAL_VISIBILITIES.map((v) => (
                  <option key={v} value={v}>
                    {v === "COACH_ONLY" ? "Coaches only" : "Visible to parent"}
                  </option>
                ))}
              </Select>
            </div>
          </div>
        )}
        {error ? (
          <p className="mt-2 text-sm text-destructive" role="alert">
            {error}
          </p>
        ) : null}
        {players.length > 0 ? (
          <div className="mt-3">
            <Button type="button" disabled={pending} onClick={create}>
              {pending ? "Saving…" : "Create goal"}
            </Button>
          </div>
        ) : null}
      </section>

      {/* Goals list */}
      {goals.length === 0 ? (
        <p className="rounded-xl border border-dashed bg-card p-8 text-center text-sm text-muted-foreground">
          No development goals yet.
        </p>
      ) : (
        <ul className="flex flex-col gap-3">
          {goals.map((g) => (
            <GoalCard key={g.id} goal={g} />
          ))}
        </ul>
      )}
    </div>
  );
}

function GoalCard({ goal }: { goal: DevelopmentGoalRow }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState(goal.status);
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function submit() {
    setError(null);
    startTransition(async () => {
      const res = await addGoalUpdateAction(goal.id, { progressStatus: status, notes });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setNotes("");
      setOpen(false);
      router.refresh();
    });
  }

  return (
    <li className="rounded-xl border bg-card p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-sport text-base font-bold text-foreground">{goal.title}</p>
          <p suppressHydrationWarning className="text-xs text-muted-foreground">
            {goal.playerName}
            {goal.category ? ` · ${goal.category}` : ""}
            {goal.targetDate ? ` · target ${fmtDate(goal.targetDate)}` : ""}
            {goal.visibility === "PARENT_VISIBLE" ? " · parent-visible" : ""}
          </p>
        </div>
        <GoalStatus status={goal.status} />
      </div>

      {goal.latestUpdate ? (
        <p className="mt-2 border-l-2 border-border pl-3 text-sm text-muted-foreground">
          {goal.latestUpdate.notes || GOAL_STATUS_LABELS[goal.latestUpdate.progressStatus as keyof typeof GOAL_STATUS_LABELS] || goal.latestUpdate.progressStatus}
          <span suppressHydrationWarning className="ml-1 text-xs">· {fmtDate(goal.latestUpdate.createdAt)} · {goal.updatesCount} update{goal.updatesCount === 1 ? "" : "s"}</span>
        </p>
      ) : null}

      {open ? (
        <div className="mt-3 flex flex-col gap-2 border-t pt-3">
          <div className="flex flex-col gap-1.5 sm:max-w-xs">
            <Label htmlFor={`s-${goal.id}`}>Progress</Label>
            <Select id={`s-${goal.id}`} value={status} onChange={(e) => setStatus(e.target.value)}>
              {GOAL_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {GOAL_STATUS_LABELS[s]}
                </option>
              ))}
            </Select>
          </div>
          <textarea className={textareaCls} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="What changed?" />
          {error ? (
            <p className="text-sm text-destructive" role="alert">
              {error}
            </p>
          ) : null}
          <div className="flex gap-2">
            <Button type="button" size="sm" disabled={pending} onClick={submit}>
              {pending ? "Saving…" : "Save update"}
            </Button>
            <Button type="button" size="sm" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
          </div>
        </div>
      ) : (
        <div className="mt-3">
          <Button type="button" size="sm" variant="outline" onClick={() => setOpen(true)}>
            Add update
          </Button>
        </div>
      )}
    </li>
  );
}
