"use client";

import { useAppearance } from "@/components/app/parent/theme-provider";
import { APPEARANCE_BLURB, APPEARANCE_LABELS, APPEARANCE_THEMES, type AppearanceTheme } from "@/lib/appearance";

/**
 * Profile → Appearance: two preview tiles with a selected-ring state (not a
 * plain toggle). Picking one applies instantly via the provider (optimistic) and
 * writes through to the user record — no save button, no reload. Each tile is a
 * self-contained mini-preview hardcoded to its theme so both looks are visible
 * at once regardless of the active theme.
 */
export function AppearanceSwitcher() {
  const { theme, setTheme, pending } = useAppearance();

  return (
    <div>
      <div className="grid grid-cols-2 gap-3">
        {APPEARANCE_THEMES.map((t) => {
          const selected = theme === t;
          return (
            <button
              key={t}
              type="button"
              onClick={() => setTheme(t)}
              aria-pressed={selected}
              className={`rounded-2xl p-1 text-left outline-none transition ${
                selected ? "ring-2 ring-primary ring-offset-2 ring-offset-[var(--app-bg)]" : "opacity-90 hover:opacity-100"
              }`}
            >
              <ThemePreview theme={t} />
              <div className="px-1.5 pb-1 pt-2">
                <p className="font-sport text-sm font-bold uppercase text-foreground">
                  {APPEARANCE_LABELS[t]}
                  {selected ? " ✓" : ""}
                </p>
                <p className="text-[11px] leading-tight text-muted-foreground">{APPEARANCE_BLURB[t]}</p>
              </div>
            </button>
          );
        })}
      </div>
      <p className="mt-2 h-4 text-[11px] text-muted-foreground" role="status">
        {pending ? "Saving…" : ""}
      </p>
    </div>
  );
}

/** Hardcoded mini-preview per theme (independent of the active theme). */
function ThemePreview({ theme }: { theme: AppearanceTheme }) {
  if (theme === "vibrant") {
    return (
      <div
        className="flex h-24 flex-col gap-2 rounded-xl p-2.5"
        style={{ background: "#f6f1e6", border: "2.5px solid #1b2a22", boxShadow: "3px 3px 0 0 #1b2a22" }}
      >
        <div className="h-3 w-12 rounded-full" style={{ background: "#1E9E5A" }} />
        <div className="flex gap-1.5">
          {["#b6e23a", "#ff6b57", "#f6b73c", "#8b5cf6"].map((c) => (
            <span key={c} className="size-4 rounded-md" style={{ background: c, border: "2px solid #1b2a22" }} />
          ))}
        </div>
        <div className="mt-auto h-5 rounded-md" style={{ background: "#fff", border: "2.5px solid #1b2a22", boxShadow: "2px 2px 0 0 #1b2a22" }} />
      </div>
    );
  }
  return (
    <div
      className="flex h-24 flex-col gap-2 rounded-xl bg-white p-2.5"
      style={{ border: "1px solid #E6EBE7", boxShadow: "0 12px 26px -20px rgba(20,60,40,.45)" }}
    >
      <div className="h-3 w-12 rounded-full" style={{ background: "#1E9E5A" }} />
      <div className="flex gap-1.5">
        {["#1E9E5A", "#157A45", "#d9a93c"].map((c) => (
          <span key={c} className="size-2.5 rounded-full" style={{ background: c }} />
        ))}
      </div>
      <div className="mt-auto h-5 rounded-lg" style={{ background: "#F4F7F4", border: "1px solid #E6EBE7" }} />
    </div>
  );
}
