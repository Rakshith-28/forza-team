import Link from "next/link";

import { AnnouncementsBell } from "@/components/app/announcements-bell";
import type { AppearanceTheme } from "@/lib/appearance";

import { BottomTabBar } from "./bottom-tab-bar";
import { SideRails } from "./side-rails";
import { ParentThemeProvider } from "./theme-provider";

/**
 * The player/parent mobile app shell: a themed full-bleed surface with a slim
 * top wordmark, a centered mobile content column, and the floating bottom tab
 * bar. Rendered ONLY for the PARENT role (see (app)/layout.tsx) — admins/coaches
 * keep the Console shell, untouched.
 */
export function ParentAppShell({
  theme,
  initial,
  unreadAnnouncements = 0,
  children,
}: {
  theme: AppearanceTheme;
  initial: string;
  unreadAnnouncements?: number;
  children: React.ReactNode;
}) {
  return (
    <ParentThemeProvider initialTheme={theme}>
      <header className="sticky top-0 z-30 flex h-14 items-center justify-between bg-(--app-bg) px-4">
        <Link href="/dashboard/parent" className="font-display text-lg uppercase tracking-tight text-primary">
          Forza
        </Link>
        <div className="flex items-center gap-2">
          <AnnouncementsBell initialCount={unreadAnnouncements} />
          <Link
            href="/me"
            aria-label="Profile"
            className="app-pill flex size-9 items-center justify-center bg-primary text-sm font-bold text-primary-foreground"
          >
            {initial}
          </Link>
        </div>
      </header>

      <main className="mx-auto w-full max-w-md flex-1 px-4 pb-28 pt-1">{children}</main>

      <BottomTabBar />
      <SideRails unreadAnnouncements={unreadAnnouncements} />
    </ParentThemeProvider>
  );
}
