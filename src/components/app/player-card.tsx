import { ArrowUpRight, Star } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export interface PlayerStat {
  value: string;
  label: string;
}

/**
 * Display data for a PlayerCard. `name` / `jerseyNumber` / `position` /
 * `photoUrl` line up with `SafePlayer` from src/modules/roster/projections.ts
 * (displayName, jerseyNumber, primaryPosition, photoUrl); `country`/`stats` are
 * presentational extras supplied by the caller.
 */
export interface PlayerCardData {
  id: string;
  name: string;
  jerseyNumber: string | null;
  position: string | null;
  country?: string | null;
  countryFlag?: string | null;
  photoUrl?: string | null;
  stats?: PlayerStat[];
}

export interface PlayerCardProps extends React.ComponentProps<"div"> {
  player: PlayerCardData;
  viewProfileHref?: string;
  evaluateHref?: string;
}

const PHOTO_BG =
  "radial-gradient(120% 80% at 50% 120%, rgba(30,158,90,.18), transparent 60%), linear-gradient(180deg,#EEF3EF,#E2EAE4)";

export function PlayerCard({
  player,
  viewProfileHref = "#",
  evaluateHref = "#",
  className,
  ...props
}: PlayerCardProps) {
  return (
    <div
      data-slot="player-card"
      className={cn(
        "flex flex-col overflow-hidden rounded-xl border bg-card",
        "shadow-[var(--shadow-card)] transition duration-200",
        "hover:-translate-y-1 hover:border-primary hover:shadow-[var(--shadow-card-hover)]",
        className,
      )}
      {...props}
    >
      {/* Photo slot — jersey number top-left over a light photo area. */}
      <div
        className="relative flex h-[230px] items-end justify-center overflow-hidden"
        style={{ background: PHOTO_BG }}
      >
        {player.jerseyNumber ? (
          <span className="absolute left-[18px] top-[14px] font-display text-[34px] leading-none text-primary">
            {player.jerseyNumber}
          </span>
        ) : null}

        {player.photoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- arbitrary remote photo, no fixed dimensions
          <img src={player.photoUrl} alt="" className="h-full w-full object-cover" />
        ) : (
          <div className="relative h-[200px] w-[150px] rounded-t-[90px] bg-gradient-to-b from-[#BFD2C6] to-[#9DB7A8] saturate-[.7]">
            <span className="absolute left-1/2 top-6 size-16 -translate-x-1/2 rounded-full bg-[#AEC3B6]" />
          </div>
        )}
      </div>

      {/* Body */}
      <div className="flex flex-1 flex-col px-5 pb-5 pt-[18px]">
        <h3 className="font-sport text-[22px] font-bold leading-tight">{player.name}</h3>

        <div className="mt-[7px] flex items-center gap-2 font-body text-[11px] font-bold uppercase tracking-[0.1em] text-muted-foreground">
          {player.position ? <span>{player.position}</span> : null}
          {player.position && (player.country || player.countryFlag) ? (
            <span className="text-border">·</span>
          ) : null}
          {player.country || player.countryFlag ? (
            <span>
              {player.countryFlag ? `${player.countryFlag} ` : ""}
              {player.country}
            </span>
          ) : null}
        </div>

        {player.stats && player.stats.length > 0 ? (
          <div className="my-[18px] grid grid-cols-3 gap-2">
            {player.stats.slice(0, 3).map((stat) => (
              <div key={stat.label} className="rounded-[11px] bg-secondary px-1.5 py-3 text-center">
                <b className="block font-sport text-[19px] font-extrabold tracking-tight">
                  {stat.value}
                </b>
                <span className="mt-[3px] block text-[10.5px] text-muted-foreground">
                  {stat.label}
                </span>
              </div>
            ))}
          </div>
        ) : null}

        <div className="mt-auto flex gap-2.5">
          <Button
            asChild
            variant="outline"
            className="h-auto flex-1 rounded-[11px] py-[11px] text-[13px] shadow-none hover:border-primary hover:bg-card hover:text-primary-hover"
          >
            <a href={viewProfileHref}>
              View profile <ArrowUpRight className="size-3.5" />
            </a>
          </Button>
          <Button
            asChild
            className="h-auto flex-1 rounded-[11px] bg-primary py-[11px] text-[13px] shadow-none hover:bg-primary-hover"
          >
            <a href={evaluateHref}>
              Evaluate <Star className="size-3.5" />
            </a>
          </Button>
        </div>
      </div>
    </div>
  );
}
