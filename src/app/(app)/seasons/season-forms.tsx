"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { CalendarRange } from "lucide-react";

import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/console";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import {
  archiveSeasonAction,
  createSeasonAction,
  updateSeasonAction,
} from "@/modules/clubs/actions";
import { INITIAL_STATE } from "@/modules/clubs/action-state";
import { SEASON_STATUSES } from "@/modules/clubs/schemas";

export interface SeasonView {
  id: string;
  name: string;
  start: string; // yyyy-mm-dd
  end: string;
  status: string;
  /** Changes on every update; used as a remount key so the editor collapses on save. */
  version: string;
}

export function CreateSeasonForm() {
  const [state, action, pending] = useActionState(createSeasonAction, INITIAL_STATE);
  const ref = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (state.ok) ref.current?.reset();
  }, [state]);

  return (
    <form ref={ref} action={action} className="flex flex-col gap-3">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="s-name">Season name</Label>
        <Input id="s-name" name="name" placeholder="2026 Spring" required />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="flex min-w-0 flex-col gap-1.5">
          <Label htmlFor="s-start">Start</Label>
          <Input id="s-start" name="startDate" type="date" required />
        </div>
        <div className="flex min-w-0 flex-col gap-1.5">
          <Label htmlFor="s-end">End</Label>
          <Input id="s-end" name="endDate" type="date" required />
        </div>
      </div>
      {state.error ? (
        <p className="text-sm text-destructive" role="alert">
          {state.error}
        </p>
      ) : null}
      <Button type="submit" disabled={pending} className="w-full">
        {pending ? "Adding…" : "Add season"}
      </Button>
    </form>
  );
}

// Rendered with key={`${id}-${version}`} by the host, so a successful save
// (which bumps `version`) remounts this row collapsed; errors keep it open.
export function SeasonRow({ season }: { season: SeasonView }) {
  const [editing, setEditing] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [state, action, pending] = useActionState(updateSeasonAction, INITIAL_STATE);

  if (editing) {
    return (
      <form action={action} className="flex flex-col gap-3 rounded-lg border bg-card p-4">
        <input type="hidden" name="seasonId" value={season.id} />
        <div className="flex flex-col gap-1.5">
          <Label htmlFor={`e-name-${season.id}`}>Name</Label>
          <Input id={`e-name-${season.id}`} name="name" defaultValue={season.name} required />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor={`e-start-${season.id}`}>Start</Label>
            <Input id={`e-start-${season.id}`} name="startDate" type="date" defaultValue={season.start} required />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor={`e-end-${season.id}`}>End</Label>
            <Input id={`e-end-${season.id}`} name="endDate" type="date" defaultValue={season.end} required />
          </div>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor={`e-status-${season.id}`}>Status</Label>
          <Select id={`e-status-${season.id}`} name="status" defaultValue={season.status}>
            {SEASON_STATUSES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </Select>
        </div>
        {state.error ? <p className="text-sm text-destructive" role="alert">{state.error}</p> : null}
        <div className="flex gap-2">
          <Button type="submit" size="sm" disabled={pending}>
            {pending ? "Saving…" : "Save"}
          </Button>
          <Button type="button" size="sm" variant="outline" onClick={() => setEditing(false)}>
            Cancel
          </Button>
        </div>
      </form>
    );
  }

  return (
    <>
      <div className="group flex items-center gap-3 rounded-xl border bg-card px-3 py-2.5 shadow-xs ring-1 ring-transparent transition-all hover:border-primary hover:shadow-sm hover:ring-primary/10">
        {/* Tapping the season opens its full details (names/dates truncate on
            small screens, so the dialog is the way to read them in full). */}
        <button
          type="button"
          onClick={() => setDetailsOpen(true)}
          className="flex min-w-0 flex-1 items-center gap-3 text-left"
          aria-label={`View ${season.name} details`}
        >
          <span
            aria-hidden
            className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary"
          >
            <CalendarRange className="size-4.5" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate font-sport text-sm font-bold text-foreground">{season.name}</p>
            <p className="truncate text-xs text-muted-foreground">
              {season.start} → {season.end}
            </p>
          </div>
        </button>
        <div className="flex shrink-0 items-center gap-2">
          <StatusBadge status={season.status} />
          <Button size="sm" variant="outline" onClick={() => setEditing(true)}>
            Edit
          </Button>
          {season.status !== "ARCHIVED" ? (
            <form action={archiveSeasonAction}>
              <input type="hidden" name="seasonId" value={season.id} />
              <Button size="sm" variant="ghost" type="submit" className="text-muted-foreground">
                Archive
              </Button>
            </form>
          ) : null}
        </div>
      </div>

      <Dialog open={detailsOpen} onOpenChange={setDetailsOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{season.name}</DialogTitle>
          </DialogHeader>
          <DialogBody className="flex flex-col gap-3 text-sm">
            <div className="flex items-center justify-between gap-3">
              <span className="text-muted-foreground">Status</span>
              <StatusBadge status={season.status} />
            </div>
            <div className="flex items-center justify-between gap-3">
              <span className="text-muted-foreground">Start date</span>
              <span className="font-medium tabular-nums text-foreground">{season.start}</span>
            </div>
            <div className="flex items-center justify-between gap-3">
              <span className="text-muted-foreground">End date</span>
              <span className="font-medium tabular-nums text-foreground">{season.end}</span>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="mt-1 self-start"
              onClick={() => {
                setDetailsOpen(false);
                setEditing(true);
              }}
            >
              Edit season
            </Button>
          </DialogBody>
        </DialogContent>
      </Dialog>
    </>
  );
}

export function StatusBadge({ status }: { status: string }) {
  const tone =
    status === "ACTIVE"
      ? "bg-primary/10 text-primary"
      : status === "ARCHIVED"
        ? "bg-muted text-muted-foreground"
        : "bg-secondary text-ink-2";
  return (
    <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold uppercase tracking-wide ${tone}`}>
      {status}
    </span>
  );
}
