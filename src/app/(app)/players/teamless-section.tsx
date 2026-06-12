import Link from "next/link";

import { Select } from "@/components/ui/select";
import { assignTeamlessPlayerAction } from "@/modules/roster/actions";
import type { SafePlayer } from "@/modules/roster/projections";

/**
 * "Unassigned / No team" pool — players with zero active memberships (e.g. after
 * a team was deleted). Player-safe fields only. Admins assign to any team; coaches
 * add to their active team. Server-rendered forms post to assignTeamlessPlayerAction.
 */
export function TeamlessSection({
  players,
  mode,
  teamOptions,
  coachTeam,
}: {
  players: SafePlayer[];
  mode: "admin" | "coach";
  teamOptions: { id: string; name: string }[];
  coachTeam?: { id: string; name: string } | null;
}) {
  if (players.length === 0) return null;

  return (
    <section className="mx-auto mt-8 min-w-0 max-w-6xl">
      <div className="rounded-2xl border border-amber-300/40 bg-amber-50/40 p-5">
        <div className="min-w-0">
          <h2 className="font-sport text-base font-bold text-foreground">Unassigned / No team</h2>
          <p className="mt-1 text-sm text-muted-foreground break-words">
            {mode === "coach"
              ? `Players in your club not on any team. Add them to ${coachTeam?.name ?? "your team"}.`
              : "Players not on any team yet. Assign each to a team to bring them back onto a roster."}
          </p>
        </div>

        <ul className="mt-4 flex flex-col gap-2">
          {players.map((p) => (
            <li
              key={p.id}
              className="flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-card p-3"
            >
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium text-foreground">{p.displayName}</p>
                <p className="truncate text-xs uppercase tracking-wide text-muted-foreground">
                  {p.jerseyNumber ? `#${p.jerseyNumber}` : "No number"}
                  {p.primaryPosition ? ` · ${p.primaryPosition}` : ""}
                </p>
              </div>

              {mode === "admin" ? (
                <div className="flex shrink-0 items-center gap-2">
                  <Link
                    href={`/players/${p.id}`}
                    className="text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
                  >
                    View
                  </Link>
                  <form action={assignTeamlessPlayerAction} className="flex items-center gap-2">
                    <input type="hidden" name="playerId" value={p.id} />
                    <Select name="teamId" defaultValue="" aria-label={`Assign ${p.displayName} to a team`} required>
                      <option value="" disabled>
                        Assign to team…
                      </option>
                      {teamOptions.map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.name}
                        </option>
                      ))}
                    </Select>
                    <button
                      type="submit"
                      className="shrink-0 rounded-md bg-primary px-3 py-1.5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
                    >
                      Assign
                    </button>
                  </form>
                </div>
              ) : coachTeam ? (
                <form action={assignTeamlessPlayerAction} className="shrink-0">
                  <input type="hidden" name="playerId" value={p.id} />
                  <input type="hidden" name="teamId" value={coachTeam.id} />
                  <button
                    type="submit"
                    className="rounded-md bg-primary px-3 py-1.5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
                  >
                    Add to my team
                  </button>
                </form>
              ) : null}
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
