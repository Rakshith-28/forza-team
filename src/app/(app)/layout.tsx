import Link from "next/link";

import { AccountMenu } from "@/components/app/account-menu";
import { AnnouncementsBell } from "@/components/app/announcements-bell";
import { ConsoleMobileNav } from "@/components/app/console-mobile-nav";
import { ConsoleSidebar } from "@/components/app/console-sidebar";
import { IdentitySwitcher } from "@/components/app/identity-switcher";
import { ParentAppShell } from "@/components/app/parent/parent-app-shell";
import { PlatformBanner } from "@/components/app/platform-banner";
import { loadIdentitySwitcher, requireUserAndContext } from "@/lib/auth-guards";
import { ROLE_LABELS, type Role } from "@/lib/rbac";
import { getMyAnnouncementsUnreadCount } from "@/modules/announcements/inbox";
import { getMyPlatformBanners } from "@/modules/announcements/platform-service";
import { getAppearanceTheme } from "@/modules/identity/appearance";

/**
 * Authenticated application shell with role-aware navigation (RBAC matrix §8).
 * Items without an `href` are surfaces that land in later phases — shown so the
 * role's scope is legible, but not yet linkable.
 */
const NAV: Record<Role, { label: string; href?: string }[]> = {
  MASTER_ADMIN: [
    { label: "Dashboard", href: "/dashboard/admin" },
    { label: "Clubs", href: "/clubs" },
    { label: "Coaches", href: "/coaches" },
    { label: "Users", href: "/users" },
    { label: "Announcements", href: "/platform-announcements" },
    { label: "Audit Logs", href: "/audit-logs" },
    { label: "System Settings", href: "/system-settings" },
  ],
  CLUB_ADMIN: [
    { label: "Dashboard", href: "/dashboard/club" },
    { label: "Seasons", href: "/seasons" },
    { label: "Teams", href: "/teams" },
    { label: "Players", href: "/players" },
    { label: "Parents", href: "/parents" },
    { label: "Coaches", href: "/coaches" },
    { label: "Schedule", href: "/schedule" },
    { label: "Attendance", href: "/attendance" },
    { label: "Announcements", href: "/announcements" },
    { label: "Team Chat", href: "/chat" },
    { label: "Documents", href: "/documents" },
    { label: "Registration" },
    { label: "Payments" },
    { label: "Waivers" },
    { label: "Evaluations", href: "/evaluations" },
    { label: "Reports", href: "/dashboard/club" },
    { label: "Settings", href: "/settings" },
  ],
  COACH: [
    { label: "Dashboard", href: "/dashboard/coach" },
    { label: "Team Roster", href: "/players" },
    { label: "Announcements", href: "/announcements" },
    { label: "Team Chat", href: "/chat" },
    { label: "Documents", href: "/documents" },
    { label: "Schedule", href: "/schedule" },
    { label: "Attendance", href: "/attendance" },
    { label: "Evaluations", href: "/evaluations" },
    { label: "Development", href: "/development" },
  ],
  PARENT: [
    { label: "My Kids", href: "/dashboard/parent" },
    { label: "Child Profiles", href: "/dashboard/parent" },
    { label: "Announcements", href: "/announcements" },
    { label: "Team Chat", href: "/chat" },
    { label: "Documents", href: "/documents" },
    { label: "Schedule", href: "/schedule" },
    { label: "Team Roster" },
    { label: "Payments" },
    { label: "Waivers" },
    { label: "Development" },
  ],
};

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const { session, ctx } = await requireUserAndContext();
  const displayName = session.user.name || session.user.email;

  // Live platform broadcasts (WARNING/CRITICAL) surface as a banner in every
  // shell; the combined unread (platform + club) count drives the navbar bell
  // badge. The two are independent, so fetch them concurrently rather than
  // paying two serial Neon round-trips.
  const [banners, unreadAnnouncements, identitySwitcher] = await Promise.all([
    getMyPlatformBanners(ctx),
    getMyAnnouncementsUnreadCount(ctx),
    loadIdentitySwitcher(session.user.id),
  ]);

  // Player/parent surface: the themed mobile app shell (Vibrant/Classic).
  // The Console (admin/coach) keeps its fixed look below — never themed.
  if (ctx.role === "PARENT") {
    const theme = await getAppearanceTheme(session.user.id);
    const initial = (session.user.name?.trim()?.[0] ?? session.user.email[0] ?? "U").toUpperCase();
    return (
      <ParentAppShell
        theme={theme}
        initial={initial}
        name={displayName}
        email={session.user.email}
        unreadAnnouncements={unreadAnnouncements}
        identities={identitySwitcher.identities}
        currentIdentity={identitySwitcher.current}
      >
        <PlatformBanner items={banners} />
        {children}
      </ParentAppShell>
    );
  }

  const navItems = NAV[ctx.role];
  const initial = (session.user.name?.trim()?.[0] ?? session.user.email[0] ?? "U").toUpperCase();

  return (
    <div className="flex min-h-full flex-1 flex-col gap-2 p-2">
      <header className="sticky top-2 z-40 flex h-14 shrink-0 items-center justify-between rounded-2xl border bg-card px-4 shadow-xl">
        <div className="flex min-w-0 items-center gap-2">
          <ConsoleMobileNav
            items={navItems}
            profile={{ name: displayName, initial, roleLabel: ROLE_LABELS[ctx.role] }}
          />
          <Link
            href="/dashboard"
            className="hidden shrink-0 font-sport text-xl font-bold uppercase tracking-[0.32em] transition-opacity hover:opacity-80 sm:inline-block sm:text-2xl"
          >
            <span className="text-foreground">Forza</span>
            <span className="ml-[0.32em] text-primary">Team</span>
          </Link>
          <span className="hidden h-6 w-px bg-border sm:inline-block" aria-hidden />
          <IdentitySwitcher
            identities={identitySwitcher.identities}
            current={identitySwitcher.current}
          />
        </div>
        <div className="flex items-center gap-3">
          <AnnouncementsBell initialCount={unreadAnnouncements} />
          <AccountMenu
            name={displayName}
            email={session.user.email}
            initial={initial}
            roleLabel={ROLE_LABELS[ctx.role]}
          />
        </div>
      </header>

      <div className="flex flex-1 gap-2">
        <ConsoleSidebar
          items={navItems}
          profile={{ name: displayName, initial, roleLabel: ROLE_LABELS[ctx.role] }}
        />

        <main className="flex-1 p-4">
          <PlatformBanner items={banners} />
          {children}
        </main>
      </div>
    </div>
  );
}
