import Link from "next/link";

import { AccountMenu } from "@/components/app/account-menu";
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
  name,
  email,
  unreadAnnouncements = 0,
  children,
}: {
  theme: AppearanceTheme;
  initial: string;
  name: string;
  email: string;
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
          <AccountMenu
            name={name}
            email={email}
            initial={initial}
            roleLabel="Parent / Guardian"
            profileHref="/me"
          />
        </div>
      </header>

      <main className="mx-auto w-full max-w-md flex-1 px-4 pb-28 pt-1">{children}</main>

      <BottomTabBar />
      <SideRails unreadAnnouncements={unreadAnnouncements} />
    </ParentThemeProvider>
  );
}
