import { describe, expect, it } from "vitest";

import {
  APPEARANCE_THEMES,
  DEFAULT_APPEARANCE,
  isAppearanceTheme,
  toAppearanceTheme,
} from "@/lib/appearance";

/**
 * Player/parent appearance theme constants. The Console has no theme; only the
 * two player/parent themes exist, and new users default to Classic.
 */
describe("appearance themes", () => {
  it("offers exactly Vibrant and Classic", () => {
    expect([...APPEARANCE_THEMES].sort()).toEqual(["classic", "vibrant"]);
  });

  it("defaults to Classic", () => {
    expect(DEFAULT_APPEARANCE).toBe("classic");
  });

  it("validates theme values", () => {
    expect(isAppearanceTheme("vibrant")).toBe(true);
    expect(isAppearanceTheme("classic")).toBe(true);
    expect(isAppearanceTheme("console")).toBe(false);
    expect(isAppearanceTheme(undefined)).toBe(false);
  });

  it("coerces unknown/null stored values to the default (Classic)", () => {
    expect(toAppearanceTheme("vibrant")).toBe("vibrant");
    expect(toAppearanceTheme(null)).toBe("classic");
    expect(toAppearanceTheme("bogus")).toBe("classic");
  });
});
