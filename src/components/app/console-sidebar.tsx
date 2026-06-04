"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BarChart3,
  Building2,
  Calendar,
  CalendarRange,
  ClipboardCheck,
  ClipboardList,
  CreditCard,
  FileSignature,
  FileText,
  LayoutDashboard,
  Lock,
  Megaphone,
  MessageSquare,
  ScrollText,
  Settings,
  Shield,
  TrendingUp,
  UserRound,
  Users,
  UsersRound,
  type LucideIcon,
} from "lucide-react";

import { cn } from "@/lib/utils";

export interface NavItem {
  label: string;
  href?: string;
}

export interface SidebarProfile {
  name: string;
  initial: string;
  roleLabel: string;
}

/** Icon per nav label (Console roles only). Falls back to a neutral glyph. */
const ICONS: Record<string, LucideIcon> = {
  Dashboard: LayoutDashboard,
  Clubs: Building2,
  Coaches: UsersRound,
  Users: Users,
  "Audit Logs": ScrollText,
  "System Settings": Settings,
  Seasons: CalendarRange,
  Teams: Shield,
  Players: Users,
  Parents: UserRound,
  Schedule: Calendar,
  Attendance: ClipboardCheck,
  Announcements: Megaphone,
  "Team Chat": MessageSquare,
  Documents: FileText,
  Registration: ClipboardList,
  Waivers: FileSignature,
  Payments: CreditCard,
  Evaluations: BarChart3,
  Reports: TrendingUp,
  Settings: Settings,
  "Team Roster": Users,
  Development: TrendingUp,
};

function isActive(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}

// Label reveal as the rail expands on hover/focus.
const LABEL =
  "min-w-0 whitespace-nowrap opacity-0 transition-opacity duration-200 group-hover/sb:opacity-100 group-focus-within/sb:opacity-100";

/**
 * Console navigation — a dark, floating panel that lives IN FLOW (reserves its
 * collapsed width, so expanding PUSHES content rather than overlapping it). It
 * expands from an icon rail to a labelled panel on hover/focus, hugs its content
 * height via `self-start` (capped to the viewport with internal scroll for long
 * menus), and sticks while the page scrolls. Collapsed icons show native
 * tooltips; the active route gets a white pill + a thin brand-green accent.
 */
export function ConsoleSidebar({ items, profile }: { items: NavItem[]; profile: SidebarProfile }) {
  const pathname = usePathname();

  return (
    <aside
      className={cn(
        "group/sb sticky top-2 my-2 ml-2 hidden max-h-[calc(100dvh-1rem)] w-16 shrink-0 flex-col self-start overflow-hidden rounded-2xl",
        "bg-neutral-900 text-neutral-400 ring-1 ring-white/10 shadow-xl",
        "transition-[width] duration-300 ease-out hover:w-60 focus-within:w-60 motion-reduce:transition-none md:flex",
      )}
    >
      {/* Profile */}
      <div className="flex h-16 shrink-0 items-center">
        <span className="grid size-16 shrink-0 place-items-center">
          <span className="grid size-9 place-items-center rounded-full bg-neutral-700 text-sm font-semibold text-white ring-2 ring-white/10">
            {profile.initial}
          </span>
        </span>
        <div className={cn(LABEL, "flex-1 pr-3")}>
          <p className="truncate text-sm font-semibold text-white">{profile.name}</p>
          <p className="truncate text-xs text-neutral-500">{profile.roleLabel}</p>
        </div>
      </div>

      <div className="mx-3 mb-1 border-t border-white/10" />

      {/* Nav (scrolls internally only when the menu is taller than the viewport) */}
      <nav className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden py-1">
        <ul className="flex flex-col gap-0.5">
          {items.map((item) => {
            const Icon = ICONS[item.label] ?? Building2;

            if (!item.href) {
              return (
                <li key={item.label}>
                  <span title={item.label} className="relative mx-2 flex h-11 items-center rounded-xl text-neutral-600">
                    <span className="grid size-12 shrink-0 place-items-center">
                      <Icon className="size-5" />
                    </span>
                    <span className={cn(LABEL, "flex-1 text-sm font-medium")}>{item.label}</span>
                    <Lock className={cn(LABEL, "mr-3 size-3.5")} />
                  </span>
                </li>
              );
            }

            const active = isActive(pathname, item.href);

            return (
              <li key={item.label}>
                <Link
                  href={item.href}
                  title={item.label}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "relative mx-2 flex h-11 items-center rounded-xl transition-colors duration-200",
                    active ? "bg-white/10 text-white" : "text-neutral-400 hover:bg-white/5 hover:text-white",
                  )}
                >
                  <span
                    aria-hidden
                    className={cn(
                      "absolute left-0 top-1/2 h-5 w-0.5 -translate-y-1/2 rounded-r-full bg-primary transition-opacity",
                      active ? "opacity-100" : "opacity-0",
                    )}
                  />
                  <span className="grid size-12 shrink-0 place-items-center">
                    <Icon className="size-5" />
                  </span>
                  <span className={cn(LABEL, "flex-1 text-sm font-medium")}>{item.label}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </aside>
  );
}
