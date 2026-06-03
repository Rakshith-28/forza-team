import Link from "next/link";

import { SignOutButton } from "@/components/app/sign-out-button";
import { requireUserAndContext } from "@/lib/auth-guards";
import { ROLE_LABELS, type Role } from "@/lib/rbac";

/**
 * Authenticated application shell with role-aware navigation (RBAC matrix §8).
 * Items without an `href` are surfaces that land in later phases — shown so the
 * role's scope is legible, but not yet linkable.
 */
const NAV: Record<Role, { label: string; href?: string }[]> = {
  MASTER_ADMIN: [
    { label: "Dashboard", href: "/dashboard/admin" },
    { label: "Clubs", href: "/clubs" },
    { label: "Users" },
    { label: "Audit Logs" },
    { label: "System Settings" },
  ],
  CLUB_ADMIN: [
    { label: "Dashboard", href: "/dashboard/club" },
    { label: "Seasons", href: "/seasons" },
    { label: "Teams", href: "/teams" },
    { label: "Players", href: "/players" },
    { label: "Parents", href: "/parents" },
    { label: "Coaches" },
    { label: "Schedule" },
    { label: "Attendance" },
    { label: "Registration" },
    { label: "Payments" },
    { label: "Waivers" },
    { label: "Announcements" },
    { label: "Evaluations" },
    { label: "Reports" },
    { label: "Settings" },
  ],
  COACH: [
    { label: "Dashboard", href: "/dashboard/coach" },
    { label: "Team Roster", href: "/players" },
    { label: "Schedule" },
    { label: "Attendance" },
    { label: "Chat" },
    { label: "Announcements" },
    { label: "Evaluations" },
    { label: "Development" },
    { label: "Documents" },
  ],
  PARENT: [
    { label: "My Kids", href: "/dashboard/parent" },
    { label: "Child Profiles", href: "/dashboard/parent" },
    { label: "Schedule" },
    { label: "Team Roster" },
    { label: "Chat" },
    { label: "Announcements" },
    { label: "Payments" },
    { label: "Waivers" },
    { label: "Development" },
    { label: "Documents" },
  ],
};

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const { session, ctx } = await requireUserAndContext();
  const navItems = NAV[ctx.role];
  const displayName = session.user.name || session.user.email;

  return (
    <div className="flex min-h-full flex-1 flex-col">
      <header className="flex h-14 items-center justify-between border-b bg-card px-4">
        <Link href="/dashboard" className="font-semibold tracking-tight text-primary">
          Forza Team
        </Link>
        <div className="flex items-center gap-3">
          <span className="hidden text-sm text-muted-foreground sm:inline">{displayName}</span>
          <span className="rounded-full bg-secondary px-2.5 py-0.5 text-xs font-medium text-secondary-foreground">
            {ROLE_LABELS[ctx.role]}
          </span>
          <SignOutButton />
        </div>
      </header>

      <div className="flex flex-1">
        <nav className="hidden w-56 shrink-0 border-r bg-sidebar p-3 md:block">
          <ul className="flex flex-col gap-0.5">
            {navItems.map((item) =>
              item.href ? (
                <li key={item.label}>
                  <Link
                    href={item.href}
                    className="block rounded-md px-3 py-2 text-sm font-medium text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                  >
                    {item.label}
                  </Link>
                </li>
              ) : (
                <li
                  key={item.label}
                  className="flex items-center justify-between rounded-md px-3 py-2 text-sm text-muted-foreground"
                >
                  {item.label}
                  <span className="text-[10px] uppercase tracking-wide text-muted-foreground/60">soon</span>
                </li>
              ),
            )}
          </ul>
        </nav>

        <main className="flex-1 p-6">{children}</main>
      </div>
    </div>
  );
}
