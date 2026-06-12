import Link from "next/link";

import { AccountMenu } from "@/components/app/account-menu";
import { AnnouncementsBell } from "@/components/app/announcements-bell";
import { DashboardIdentityRow } from "@/components/app/dashboard-identity-row";
import type { AppearanceTheme } from "@/lib/appearance";
import type { Identity } from "@/modules/identity/identities";

import { BottomTabBar } from "./bottom-tab-bar";
import { SideRails } from "./side-rails";
import { PlayerThemeProvider } from "./theme-provider";

/**
 * The player mobile app shell: a themed full-bleed surface with a slim
 * top wordmark, a centered mobile content column, and the floating bottom tab
 * bar. Rendered ONLY for the PLAYER role (see (app)/layout.tsx) — admins/coaches
 * keep the Console shell, untouched.
 */
export function PlayerAppShell({
  theme,
  initial,
  name,
  email,
  unreadAnnouncements = 0,
  identities,
  currentIdentity,
  children,
}: {
  theme: AppearanceTheme;
  initial: string;
  name: string;
  email: string;
  unreadAnnouncements?: number;
  identities: Identity[];
  currentIdentity: Identity | null;
  children: React.ReactNode;
}) {
  return (
    <PlayerThemeProvider initialTheme={theme}>
      <header className="app-card sticky top-2 z-30 mx-3 mt-2 flex h-14 items-center justify-between gap-2 px-4">
        <Link href="/dashboard/player" className="font-display text-lg uppercase tracking-tight text-primary">
          Forza
        </Link>
        <div className="flex items-center gap-2">
          <AnnouncementsBell initialCount={unreadAnnouncements} />
          <AccountMenu
            name={name}
            email={email}
            initial={initial}
            roleLabel="Player"
            profileHref="/me"
            identities={identities}
            current={currentIdentity}
          />
        </div>
      </header>

      {/* Identity switcher: its own row below the navbar, above the page content,
          shown only on the dashboard (DashboardIdentityRow gates it). Widens to
          the full content area on desktop (lg) like the Console; the extra lg
          padding keeps content clear of the floating side rails. */}
      <DashboardIdentityRow
        identities={identities}
        current={currentIdentity}
        className="mx-auto w-full max-w-md px-4 pt-2 lg:max-w-6xl lg:px-24"
      />

      <main className="mx-auto w-full min-w-0 max-w-md flex-1 px-4 pb-28 pt-1 lg:max-w-6xl lg:px-24">
        {children}
      </main>

      <BottomTabBar />
      <SideRails unreadAnnouncements={unreadAnnouncements} />
    </PlayerThemeProvider>
  );
}
