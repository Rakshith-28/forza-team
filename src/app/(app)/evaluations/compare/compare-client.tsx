"use client";

import { useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import type { RadarComparison } from "@/modules/evaluations/comparison-service";

import { loadRadarComparisonAction } from "./actions";
import { RADAR_COLORS, RadarChart } from "./radar-chart";

export function CompareClient({ players }: { players: { playerId: string; name: string }[] }) {
  const [selected, setSelected] = useState<string[]>([]);
  const [data, setData] = useState<RadarComparison | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function toggle(id: string) {
    setSelected((prev) => {
      if (prev.includes(id)) return prev.filter((x) => x !== id);
      if (prev.length >= 4) return prev; // max 4
      return [...prev, id];
    });
  }

  function compare() {
    setError(null);
    if (selected.length < 2) {
      setError("Pick at least 2 players to compare.");
      return;
    }
    startTransition(async () => {
      const res = await loadRadarComparisonAction(selected);
      if (res.series.length === 0) setError("None of the selected players have evaluation data yet.");
      setData(res);
    });
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[18rem_1fr]">
      {/* Player picker */}
      <section className="rounded-xl border bg-card p-5 shadow-sm">
        <h2 className="font-sport text-base font-bold text-foreground">Players</h2>
        <p className="mt-0.5 text-xs text-muted-foreground">Select 2–4 players to compare.</p>
        {players.length === 0 ? (
          <p className="mt-3 text-sm text-muted-foreground">No players in your scope.</p>
        ) : (
          <div className="mt-3 max-h-72 overflow-y-auto pr-1">
            {players.map((p) => (
              <label key={p.playerId} className="flex items-center gap-2 py-1 text-sm">
                <input
                  type="checkbox"
                  className="size-4"
                  checked={selected.includes(p.playerId)}
                  disabled={!selected.includes(p.playerId) && selected.length >= 4}
                  onChange={() => toggle(p.playerId)}
                />
                {p.name}
              </label>
            ))}
          </div>
        )}
        {error ? (
          <p className="mt-2 text-sm text-destructive" role="alert">
            {error}
          </p>
        ) : null}
        <div className="mt-3">
          <Button type="button" disabled={pending} onClick={compare}>
            {pending ? "Loading…" : "Compare"}
          </Button>
        </div>
      </section>

      {/* Chart + table */}
      <section className="rounded-xl border bg-card p-5 shadow-sm">
        {!data || data.series.length === 0 ? (
          <p className="py-16 text-center text-sm text-muted-foreground">
            Select players and press Compare to see their latest evaluations side by side.
          </p>
        ) : (
          <>
            <RadarChart axes={data.axes} series={data.series} maxValue={data.maxValue} />
            <div className="mt-4 flex flex-wrap justify-center gap-4">
              {data.series.map((s, i) => (
                <span key={s.name} className="flex items-center gap-1.5 text-sm">
                  <span className="size-3 rounded-full" style={{ backgroundColor: RADAR_COLORS[i % RADAR_COLORS.length] }} />
                  {s.name}
                </span>
              ))}
            </div>

            <div className="mt-5 overflow-x-auto">
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="px-2 py-1.5 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">Criterion</th>
                    {data.series.map((s) => (
                      <th key={s.name} className="px-2 py-1.5 text-right text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        {s.name}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {data.axes.map((axis, ai) => (
                    <tr key={axis} className="border-b last:border-0">
                      <td className="px-2 py-1.5 text-foreground">{axis}</td>
                      {data.series.map((s) => (
                        <td key={s.name} className="px-2 py-1.5 text-right tabular-nums text-foreground">
                          {s.values[ai]}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </section>
    </div>
  );
}
