"use client";

import { ArrowRight, Bell, Search } from "lucide-react";
import { useState } from "react";

import { PlayerCard, type PlayerCardData } from "@/components/app/player-card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * Roster page — a showcase of the light/sporty theme (matches
 * design/forza-roster.html). Uses sample data; in Phase 3 this becomes a
 * data-backed, parent-safe roster inside the authenticated (app) shell.
 */

interface Team {
  id: string;
  label: string;
  total: number;
  players: PlayerCardData[];
}

const TEAMS: Team[] = [
  {
    id: "first",
    label: "First Team",
    total: 22,
    players: [
      { id: "1", name: "Léo Costa", jerseyNumber: "9", position: "Forward", country: "Brazil", countryFlag: "🇧🇷", stats: [{ value: "504′", label: "Played" }, { value: "11", label: "Goals" }, { value: "4", label: "Assists" }] },
      { id: "2", name: "M. Adebayo", jerseyNumber: "4", position: "Defender", country: "Nigeria", countryFlag: "🇳🇬", stats: [{ value: "720′", label: "Played" }, { value: "1", label: "Goals" }, { value: "2", label: "Assists" }] },
      { id: "3", name: "J. Rivera", jerseyNumber: "7", position: "Winger", country: "Spain", countryFlag: "🇪🇸", stats: [{ value: "410′", label: "Played" }, { value: "6", label: "Goals" }, { value: "9", label: "Assists" }] },
      { id: "4", name: "T. Novák", jerseyNumber: "1", position: "Goalkeeper", country: "Czechia", countryFlag: "🇨🇿", stats: [{ value: "900′", label: "Played" }, { value: "61", label: "Saves" }, { value: "5", label: "Clean" }] },
      { id: "5", name: "D. Ferreira", jerseyNumber: "10", position: "Midfielder", country: "Portugal", countryFlag: "🇵🇹", stats: [{ value: "650′", label: "Played" }, { value: "4", label: "Goals" }, { value: "7", label: "Assists" }] },
      { id: "6", name: "K. Müller", jerseyNumber: "21", position: "Full-back", country: "Germany", countryFlag: "🇩🇪", stats: [{ value: "540′", label: "Played" }, { value: "0", label: "Goals" }, { value: "3", label: "Assists" }] },
    ],
  },
  {
    id: "u16",
    label: "U16 Elite",
    total: 18,
    players: [
      { id: "7", name: "A. Bianchi", jerseyNumber: "8", position: "Midfielder", country: "Italy", countryFlag: "🇮🇹", stats: [{ value: "320′", label: "Played" }, { value: "3", label: "Goals" }, { value: "5", label: "Assists" }] },
      { id: "8", name: "S. Haaland", jerseyNumber: "11", position: "Forward", country: "Norway", countryFlag: "🇳🇴", stats: [{ value: "298′", label: "Played" }, { value: "9", label: "Goals" }, { value: "2", label: "Assists" }] },
      { id: "9", name: "Y. Tanaka", jerseyNumber: "5", position: "Defender", country: "Japan", countryFlag: "🇯🇵", stats: [{ value: "405′", label: "Played" }, { value: "0", label: "Goals" }, { value: "1", label: "Assists" }] },
    ],
  },
  {
    id: "u14",
    label: "U14",
    total: 16,
    players: [
      { id: "10", name: "P. Dubois", jerseyNumber: "14", position: "Winger", country: "France", countryFlag: "🇫🇷", stats: [{ value: "210′", label: "Played" }, { value: "5", label: "Goals" }, { value: "6", label: "Assists" }] },
      { id: "11", name: "O. Kelly", jerseyNumber: "6", position: "Midfielder", country: "Ireland", countryFlag: "🇮🇪", stats: [{ value: "260′", label: "Played" }, { value: "1", label: "Goals" }, { value: "4", label: "Assists" }] },
    ],
  },
  {
    id: "women",
    label: "Women",
    total: 20,
    players: [
      { id: "12", name: "C. Mbappé", jerseyNumber: "12", position: "Forward", country: "France", countryFlag: "🇫🇷", stats: [{ value: "610′", label: "Played" }, { value: "14", label: "Goals" }, { value: "3", label: "Assists" }] },
      { id: "13", name: "L. Andersson", jerseyNumber: "3", position: "Defender", country: "Sweden", countryFlag: "🇸🇪", stats: [{ value: "700′", label: "Played" }, { value: "2", label: "Goals" }, { value: "1", label: "Assists" }] },
      { id: "14", name: "R. Okoro", jerseyNumber: "17", position: "Midfielder", country: "Nigeria", countryFlag: "🇳🇬", stats: [{ value: "480′", label: "Played" }, { value: "5", label: "Goals" }, { value: "8", label: "Assists" }] },
    ],
  },
];

const NAV = ["Roster", "Schedule", "Attendance", "Evaluations", "Messages"];

export default function RosterPage() {
  const [activeTeamId, setActiveTeamId] = useState(TEAMS[0].id);
  const activeTeam = TEAMS.find((t) => t.id === activeTeamId) ?? TEAMS[0];

  return (
    <div className="relative z-[1] mx-auto w-full max-w-[1180px] px-7">
      {/* Header */}
      <header className="mb-2 flex items-center gap-8 py-[22px]">
        <div className="flex items-center gap-2.5">
          <div className="grid size-8 flex-none place-items-center rounded-[9px] bg-primary">
            <span className="font-sport text-[17px] font-extrabold text-primary-foreground">F</span>
          </div>
          <b className="font-sport text-[17px] font-extrabold tracking-tight">Forza Team</b>
        </div>

        <nav className="mx-auto hidden gap-[26px] md:flex">
          {NAV.map((item) => (
            <a
              key={item}
              href="#"
              className={cn(
                "text-sm font-medium text-ink-2 hover:text-primary-hover",
                item === "Roster" && "font-bold text-foreground",
              )}
            >
              {item}
            </a>
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-3.5 md:ml-0">
          <button
            type="button"
            aria-label="Search"
            className="grid size-[38px] place-items-center rounded-[10px] border bg-card text-ink-2 hover:text-primary-hover"
          >
            <Search className="size-[17px]" />
          </button>
          <button
            type="button"
            aria-label="Notifications"
            className="grid size-[38px] place-items-center rounded-[10px] border bg-card text-ink-2 hover:text-primary-hover"
          >
            <Bell className="size-[17px]" />
          </button>
        </div>
      </header>

      {/* Title */}
      <h1 className="my-[18px] mb-6 font-display text-4xl uppercase leading-[1.05] md:text-[42px]">
        Roster
      </h1>

      {/* Team tabs */}
      <div className="mb-[30px] inline-flex gap-1 rounded-[14px] border bg-card p-[5px]">
        {TEAMS.map((team) => {
          const active = team.id === activeTeamId;
          return (
            <button
              key={team.id}
              type="button"
              onClick={() => setActiveTeamId(team.id)}
              className={cn(
                "rounded-[10px] px-[18px] py-[9px] text-[13.5px] font-semibold transition-colors",
                active
                  ? "bg-foreground text-card"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {team.label}
            </button>
          );
        })}
      </div>

      {/* Grid */}
      <div className="grid grid-cols-1 gap-[22px] pb-[30px] md:grid-cols-2 lg:grid-cols-3">
        {activeTeam.players.map((player) => (
          <PlayerCard key={player.id} player={player} />
        ))}
      </div>

      {/* Footer */}
      <div className="flex justify-center px-0 pb-[50px] pt-1.5">
        <Button
          asChild
          variant="outline"
          className="h-auto rounded-xl px-[22px] py-[11px] text-[13px] font-bold shadow-none hover:border-primary hover:bg-card hover:text-primary-hover"
        >
          <a href="#">
            View all {activeTeam.total} players <ArrowRight className="size-3.5" />
          </a>
        </Button>
      </div>
    </div>
  );
}
