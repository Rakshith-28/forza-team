import Link from "next/link";

import { AnnouncementsBell } from "@/components/app/announcements-bell";
import { ConsoleMobileNav } from "@/components/app/console-mobile-nav";
import { ConsoleSidebar } from "@/components/app/console-sidebar";
import { ParentAppShell } from "@/components/app/parent/parent-app-shell";
import { PlatformBanner } from "@/components/app/platform-banner";
import { requireUserAndContext } from "@/lib/auth-guards";
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
    { label: "Account", href: "/account" },
  ],
  CLUB_ADMIN: [
    { label: "Dashboard", href: "/dashboard/club" },
    { label: "Seasons", href: "/seasons" },
    { label: "Teams", href: "/teams" },
    { label: "Players", href: "/players" },
    { label: "Parents", href: "/parents" },
    { label: "Coaches", href: "/coaches" },
    { label: "Schedule", href: "/schedule" },
    { label: "Attendance", href: "/schedule" },
    { label: "Announcements", href: "/announcements" },
    { label: "Team Chat", href: "/chat" },
    { label: "Documents", href: "/documents" },
    { label: "Registration" },
    { label: "Payments" },
    { label: "Waivers" },
    { label: "Evaluations", href: "/evaluations" },
    { label: "Reports", href: "/dashboard/club" },
    { label: "Settings", href: "/settings" },
    { label: "Account", href: "/account" },
  ],
  COACH: [
    { label: "Dashboard", href: "/dashboard/coach" },
    { label: "Team Roster", href: "/players" },
    { label: "Announcements", href: "/announcements" },
    { label: "Team Chat", href: "/chat" },
    { label: "Documents", href: "/documents" },
    { label: "Schedule", href: "/schedule" },
    { label: "Attendance", href: "/schedule" },
    { label: "Evaluations", href: "/evaluations" },
    { label: "Development", href: "/development" },
    { label: "Account", href: "/account" },
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

  // Live platform broadcasts (WARNING/CRITICAL) surface as a banner in every shell.
  const banners = await getMyPlatformBanners(ctx);
  // Combined unread (platform + club) drives the navbar bell badge.
  const unreadAnnouncements = await getMyAnnouncementsUnreadCount(ctx);

  // Player/parent surface: the themed mobile app shell (Vibrant/Classic).
  // The Console (admin/coach) keeps its fixed look below — never themed.
  if (ctx.role === "PARENT") {
    const theme = await getAppearanceTheme(session.user.id);
    const initial = (session.user.name?.trim()?.[0] ?? session.user.email[0] ?? "U").toUpperCase();
    return (
      <ParentAppShell theme={theme} initial={initial} unreadAnnouncements={unreadAnnouncements}>
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
            className="truncate font-sport text-xl font-bold uppercase tracking-[0.32em] transition-opacity hover:opacity-80 sm:text-2xl"
          >
            <span className="text-foreground">Forza</span>
            <span className="ml-[0.32em] text-primary">Team</span>
          </Link>
        </div>
        <div className="flex items-center gap-3">
          <AnnouncementsBell initialCount={unreadAnnouncements} />
          <span className="rounded-full bg-secondary px-2.5 py-0.5 text-xs font-medium text-secondary-foreground">
            {ROLE_LABELS[ctx.role]}
          </span>
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
