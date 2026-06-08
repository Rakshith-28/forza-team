import Link from "next/link";

import { AccountMenu } from "@/components/app/account-menu";
import { AnnouncementsBell } from "@/components/app/announcements-bell";
import { IdentitySwitcher } from "@/components/app/identity-switcher";
import type { AppearanceTheme } from "@/lib/appearance";
import type { Identity } from "@/modules/identity/identities";

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
    <ParentThemeProvider initialTheme={theme}>
      <header className="sticky top-2 z-30 mx-3 mt-2 flex h-14 items-center justify-between gap-2 rounded-2xl border border-border/60 bg-card px-4 shadow-md">
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

      {/* Identity switcher: its own row below the navbar, above the page content. */}
      <div className="mx-auto w-full max-w-md px-4 pt-2">
        <IdentitySwitcher identities={identities} current={currentIdentity} />
      </div>

      <main className="mx-auto w-full max-w-md flex-1 px-4 pb-28 pt-1">{children}</main>

      <BottomTabBar />
      <SideRails unreadAnnouncements={unreadAnnouncements} />
    </ParentThemeProvider>
  );
}
