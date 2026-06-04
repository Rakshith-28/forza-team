/**
 * Player/parent appearance themes (client-safe — no server-only imports).
 *
 * The Console (admin/coach) has no theme switcher. Only the player/parent
 * surface is themed, via `data-theme` on its app-shell root. New users default
 * to Classic (the official, restrained look).
 */
export const APPEARANCE_THEMES = ["vibrant", "classic"] as const;
export type AppearanceTheme = (typeof APPEARANCE_THEMES)[number];

export const DEFAULT_APPEARANCE: AppearanceTheme = "classic";

export const APPEARANCE_LABELS: Record<AppearanceTheme, string> = {
  vibrant: "Vibrant",
  classic: "Classic",
};

export const APPEARANCE_BLURB: Record<AppearanceTheme, string> = {
  vibrant: "Loud and playful — bold colors, thick outlines.",
  classic: "Official and clean — green-led, understated.",
};

export function isAppearanceTheme(value: unknown): value is AppearanceTheme {
  return typeof value === "string" && (APPEARANCE_THEMES as readonly string[]).includes(value);
}

/** Coerce any stored value to a valid theme (falls back to the default). */
export function toAppearanceTheme(value: unknown): AppearanceTheme {
  return isAppearanceTheme(value) ? value : DEFAULT_APPEARANCE;
}
