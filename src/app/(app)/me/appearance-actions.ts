"use server";

import { requireUser } from "@/lib/auth-guards";
import { isAppearanceTheme, type AppearanceTheme } from "@/lib/appearance";
import { setAppearanceTheme } from "@/modules/identity/appearance";

/**
 * Write-through for the player appearance switcher. The client applies
 * the theme instantly (optimistic) and calls this to persist; we re-validate the
 * value server-side. Returns the saved theme (or throws on an invalid value).
 */
export async function setAppearanceThemeAction(theme: string): Promise<{ ok: boolean; theme: AppearanceTheme }> {
  const session = await requireUser();
  if (!isAppearanceTheme(theme)) throw new Error("Invalid appearance theme");
  await setAppearanceTheme(session.user.id, theme);
  return { ok: true, theme };
}
