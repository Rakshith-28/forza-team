"use client";

import { useState } from "react";

import { StatusBadge } from "@/components/console";
import type { MasterClubListItem } from "@/modules/master/service";

import { ClubAdminBadge } from "../../clubs/admin-badge";
import { ClubDetailDrawer } from "../../clubs/club-detail-drawer";

function monogram(name: string): string {
  return (name.trim()[0] ?? "?").toUpperCase();
}

/** Dashboard Clubs panel: a responsive grid of compact club cards → detail drawer. */
export function ClubsPanel({ clubs }: { clubs: MasterClubListItem[] }) {
  const [selected, setSelected] = useState<string | null>(null);

  if (clubs.length === 0) {
    return (
      <p className="rounded-xl border border-dashed bg-card p-8 text-center text-sm text-muted-foreground">
        No clubs yet. Create the first one from the Clubs page.
      </p>
    );
  }

  return (
    <>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {clubs.map((club) => (
          <button
            key={club.id}
            type="button"
            onClick={() => setSelected(club.id)}
            className="flex flex-col gap-3 rounded-xl border bg-card p-4 text-left shadow-sm transition-colors hover:border-primary focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex min-w-0 items-center gap-3">
                {club.logoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element -- remote logo, matches app convention
                  <img src={club.logoUrl} alt="" className="size-10 shrink-0 rounded-full border object-cover" />
                ) : (
                  <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-secondary text-sm font-bold text-secondary-foreground">
                    {monogram(club.name)}
                  </span>
                )}
                <div className="min-w-0">
                  <p className="truncate font-sport text-base font-bold text-foreground">{club.name}</p>
                  <p className="truncate text-xs text-muted-foreground">{club.shortCode}</p>
                </div>
              </div>
              <div className="flex shrink-0 flex-col items-end gap-1">
                <StatusBadge status={club.status} />
                <ClubAdminBadge state={club.adminState} />
              </div>
            </div>
            <div className="flex items-center gap-4 text-xs text-muted-foreground">
              <span>
                <span className="font-semibold text-foreground">{club.teamCount}</span> teams
              </span>
              <span>
                <span className="font-semibold text-foreground">{club.playerCount}</span> players
              </span>
              {club.city || club.state ? (
                <span className="ml-auto truncate">{[club.city, club.state].filter(Boolean).join(", ")}</span>
              ) : null}
            </div>
          </button>
        ))}
      </div>

      <ClubDetailDrawer clubId={selected} onOpenChange={(open) => !open && setSelected(null)} />
    </>
  );
}
