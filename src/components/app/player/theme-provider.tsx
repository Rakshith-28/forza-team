"use client";

import { createContext, useCallback, useContext, useState, useTransition } from "react";

import { setAppearanceThemeAction } from "@/app/(app)/me/appearance-actions";
import { type AppearanceTheme } from "@/lib/appearance";

/**
 * Player app theming. The wrapper carries `data-theme`, so the whole
 * surface re-themes instantly when `setTheme` flips client state (optimistic);
 * the change is written through to the user record in a transition (no save
 * button, no reload). The initial value is read server-side (no flash).
 *
 * Scope: only the player shell renders this — the Console never does.
 */
interface AppearanceCtx {
  theme: AppearanceTheme;
  setTheme: (t: AppearanceTheme) => void;
  pending: boolean;
}

const Ctx = createContext<AppearanceCtx | null>(null);

export function useAppearance(): AppearanceCtx {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useAppearance must be used within PlayerThemeProvider");
  return ctx;
}

export function PlayerThemeProvider({
  initialTheme,
  children,
}: {
  initialTheme: AppearanceTheme;
  children: React.ReactNode;
}) {
  const [theme, setThemeState] = useState<AppearanceTheme>(initialTheme);
  const [pending, startTransition] = useTransition();

  const setTheme = useCallback((next: AppearanceTheme) => {
    setThemeState(next); // instant, optimistic
    startTransition(async () => {
      try {
        await setAppearanceThemeAction(next);
      } catch {
        // Best-effort write-through; the optimistic UI stays. A reload would
        // re-read the persisted value.
      }
    });
  }, []);

  return (
    <Ctx.Provider value={{ theme, setTheme, pending }}>
      <div data-theme={theme} className="app-surface flex min-h-screen flex-col">
        {children}
      </div>
    </Ctx.Provider>
  );
}
