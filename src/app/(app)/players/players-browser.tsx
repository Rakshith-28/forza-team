"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Plus, Search } from "lucide-react";

import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  PageHeader,
  StatusBadge,
} from "@/components/console";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { PLAYER_POSITION_LABELS, PLAYER_POSITIONS } from "@/modules/roster/schemas";

import { CreatePlayerForm, type TeamOption } from "./player-create-form";

/** Lean, serializable player row for the client list (no PII beyond the roster view). */
export interface PlayerListItem {
  id: string;
  firstName: string;
  lastName: string;
  jerseyNumber: string | null;
  primaryPosition: string | null;
  teamNames: string[];
  playerCount: number;
  status: string;
  /** ISO date string, or null when unknown. */
  dateOfBirth: string | null;
}

/** Whole years between `dob` and today; null when the birth date is unknown. */
function ageFromDob(iso: string | null): number | null {
  if (!iso) return null;
  const dob = new Date(iso);
  if (Number.isNaN(dob.getTime())) return null;
  const now = new Date();
  let age = now.getFullYear() - dob.getFullYear();
  const m = now.getMonth() - dob.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < dob.getDate())) age -= 1;
  return age;
}

/**
 * Client roster browser: a search box by the heading, a filter panel + an "Add a
 * player" launcher in the right pane, and the matching players in a scrollable
 * left pane (so a long roster scrolls instead of stretching the page). All
 * filtering is client-side over the already-authorized roster the server sent.
 */
export function PlayersBrowser({
  players,
  description,
  canCreate,
  isCoach,
  teamOptions,
  teamRequired,
  emptyMessage,
}: {
  players: PlayerListItem[];
  description: string;
  canCreate: boolean;
  isCoach: boolean;
  teamOptions: TeamOption[];
  teamRequired: boolean;
  /** Overrides the zero-players message (e.g. a coach with no active team selected). */
  emptyMessage?: string;
}) {
  const [search, setSearch] = useState("");
  const [position, setPosition] = useState("");
  const [jersey, setJersey] = useState("");
  const [ageMin, setAgeMin] = useState("");
  const [ageMax, setAgeMax] = useState("");

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const j = jersey.trim().toLowerCase();
    const min = ageMin ? Number(ageMin) : null;
    const max = ageMax ? Number(ageMax) : null;
    return players.filter((p) => {
      if (q && !`${p.firstName} ${p.lastName}`.toLowerCase().includes(q)) return false;
      if (position && p.primaryPosition !== position) return false;
      if (j && !(p.jerseyNumber ?? "").toLowerCase().includes(j)) return false;
      if (min != null || max != null) {
        const age = ageFromDob(p.dateOfBirth);
        if (age == null) return false;
        if (min != null && age < min) return false;
        if (max != null && age > max) return false;
      }
      return true;
    });
  }, [players, search, position, jersey, ageMin, ageMax]);

  const filtersActive = Boolean(position || jersey || ageMin || ageMax);

  function clearFilters() {
    setPosition("");
    setJersey("");
    setAgeMin("");
    setAgeMax("");
  }

  const searchBox = (
    <div className="relative w-full">
      <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
      <Input
        type="search"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search players…"
        aria-label="Search players"
        className="border-muted-foreground/40 pl-9"
      />
    </div>
  );

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader title="Players" description={description} />

      <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
        {/* Left pane — search above a bordered roster container that stretches to
            match the sidebar height and scrolls internally as the roster grows. */}
        <div className="flex min-w-0 flex-col">
          {searchBox}
          <p className="mb-2 mt-3 text-xs text-muted-foreground">
            Showing {filtered.length} of {players.length}{" "}
            {players.length === 1 ? "player" : "players"}
          </p>
          <div data-glass className="overflow-hidden rounded-xl border border-muted-foreground/25 bg-transparent shadow-[inset_0_2px_5px_rgba(0,0,0,0.12),inset_0_-1px_2px_rgba(255,255,255,0.6)] lg:min-h-0 lg:flex-1">
            <div className="max-h-[calc(100vh-20rem)] overflow-y-auto p-3 sm:p-4 lg:max-h-none lg:h-full">
              <div className="flex flex-col gap-2.5">
              {players.length === 0 ? (
                <p className="rounded-lg border border-dashed bg-card p-8 text-center text-sm text-muted-foreground">
                  {emptyMessage ??
                    (canCreate ? "No players yet. Use the form to add your first player." : "No players to show.")}
                </p>
              ) : filtered.length === 0 ? (
                <p className="rounded-lg border border-dashed bg-card p-8 text-center text-sm text-muted-foreground">
                  No players match your search or filters.
                </p>
              ) : (
                filtered.map((p) => (
                  <Link
                    key={p.id}
                    href={`/players/${p.id}`}
                    className="group flex items-center gap-3 rounded-xl border bg-card px-3 py-2.5 shadow-xs ring-1 ring-transparent transition-all hover:border-primary hover:shadow-sm hover:ring-primary/10"
                  >
                    {/* Initial avatar */}
                    <span
                      aria-hidden
                      className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-bold text-primary-foreground"
                    >
                      {(p.firstName[0] ?? "?").toUpperCase()}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-sport text-sm font-bold text-foreground">
                        {p.firstName} {p.lastName}
                        {p.jerseyNumber ? <span className="ml-1.5 text-muted-foreground">#{p.jerseyNumber}</span> : null}
                      </p>
                      <p className="truncate text-xs text-muted-foreground">
                        {p.teamNames.length > 0 ? p.teamNames.join(", ") : "No team"}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-2.5">
                      {p.primaryPosition ? (
                        <span className="rounded-md bg-primary/10 px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide text-primary ring-1 ring-inset ring-primary/20">
                          {p.primaryPosition}
                        </span>
                      ) : null}
                      <span className="hidden text-xs text-muted-foreground sm:inline">
                        {p.playerCount} {p.playerCount === 1 ? "player" : "players"}
                      </span>
                      <StatusBadge status={p.status} />
                    </div>
                  </Link>
                ))
              )}
              </div>
            </div>
          </div>
        </div>

        {/* Right pane — filters on top, then the add-player launcher. */}
        <aside className="flex flex-col gap-6 self-start lg:sticky lg:top-20">
          <div data-glass className="overflow-hidden rounded-xl border bg-card shadow-sm">
            <div className="flex items-center justify-between border-b px-4 py-3">
              <h2 className="font-sport text-base font-bold text-foreground">Filter</h2>
              {filtersActive ? (
                <button
                  type="button"
                  onClick={clearFilters}
                  className="text-xs font-medium text-primary transition-colors hover:underline"
                >
                  Clear
                </button>
              ) : null}
            </div>
            <div className="flex flex-col gap-4 p-4">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="filter-position">Position</Label>
                <Select
                  id="filter-position"
                  value={position}
                  onChange={(e) => setPosition(e.target.value)}
                >
                  <option value="">All positions</option>
                  {PLAYER_POSITIONS.map((p) => (
                    <option key={p} value={p}>
                      {PLAYER_POSITION_LABELS[p]}
                    </option>
                  ))}
                </Select>
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="filter-jersey">Jersey number</Label>
                <Input
                  id="filter-jersey"
                  value={jersey}
                  onChange={(e) => setJersey(e.target.value)}
                  placeholder="e.g. 10"
                  inputMode="numeric"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label>Age</Label>
                <div className="flex items-center gap-2">
                  <Input
                    value={ageMin}
                    onChange={(e) => setAgeMin(e.target.value)}
                    placeholder="Min"
                    inputMode="numeric"
                    aria-label="Minimum age"
                  />
                  <span className="text-muted-foreground">–</span>
                  <Input
                    value={ageMax}
                    onChange={(e) => setAgeMax(e.target.value)}
                    placeholder="Max"
                    inputMode="numeric"
                    aria-label="Maximum age"
                  />
                </div>
              </div>
            </div>
          </div>

          {canCreate ? (
            <div data-glass className="rounded-xl border bg-card p-4 shadow-sm">
              <h2 className="font-sport text-base font-bold text-foreground">Add a player</h2>
              {isCoach && teamOptions.length === 0 ? (
                <p className="mt-2 text-sm text-muted-foreground">
                  You aren&apos;t assigned to any teams yet, so you can&apos;t add players.
                </p>
              ) : (
                <>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Register a new player to your roster.
                  </p>
                  <Dialog>
                    <DialogTrigger asChild>
                      <Button className="mt-3 w-full">
                        <Plus className="size-4" aria-hidden />
                        Add a player
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Add a player</DialogTitle>
                      </DialogHeader>
                      <DialogBody>
                        <CreatePlayerForm teams={teamOptions} teamRequired={teamRequired} />
                      </DialogBody>
                    </DialogContent>
                  </Dialog>
                </>
              )}
            </div>
          ) : null}
        </aside>
      </div>
    </div>
  );
}
