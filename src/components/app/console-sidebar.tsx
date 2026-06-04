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
  Payments: CreditCard,
  Waivers: FileSignature,
  Evaluations: BarChart3,
  Reports: TrendingUp,
  Settings: Settings,
  "Team Roster": Users,
  Development: TrendingUp,
};

function isActive(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}

// Shared transition for the label reveal as the rail expands.
const LABEL = "min-w-0 whitespace-nowrap opacity-0 transition-opacity duration-200 group-hover/sb:opacity-100 group-focus-within/sb:opacity-100";

/**
 * Console navigation — a dark, floating icon rail that expands to a labelled
 * panel on hover/focus (overlaying content, no reflow). Collapsed it shows
 * centered icons + the profile avatar with native tooltips; expanded it reveals
 * the name, role, and item labels. Active route highlighted with a white pill.
 */
export function ConsoleSidebar({ items, profile }: { items: NavItem[]; profile: SidebarProfile }) {
  const pathname = usePathname();

  return (
    // Spacer reserves the collapsed rail's footprint so content doesn't shift
    // when the panel expands over it.
    <div className="relative hidden w-20 shrink-0 md:block">
      <aside
        className={cn(
          "group/sb absolute inset-y-2 left-2 z-30 flex w-16 flex-col overflow-hidden rounded-2xl",
          "bg-neutral-900 text-neutral-400 ring-1 ring-white/10 shadow-2xl",
          "transition-[width] duration-300 ease-out hover:w-60 focus-within:w-60 motion-reduce:transition-none",
        )}
      >
        {/* Profile */}
        <div className="flex h-16 shrink-0 items-center">
          <span className="grid size-16 shrink-0 place-items-center">
            <span className="grid size-9 place-items-center rounded-full bg-neutral-700 text-sm font-semibold text-white ring-2 ring-white/10">
              {profile.initial}
            </span>
          </span>
          <div className={cn(LABEL, "pr-3")}>
            <p className="truncate text-sm font-semibold text-white">{profile.name}</p>
            <p className="truncate text-xs text-neutral-500">{profile.roleLabel}</p>
          </div>
        </div>

        <div className="mx-3 mb-1 border-t border-white/10" />

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto overflow-x-hidden py-1">
          <ul className="flex flex-col gap-0.5">
            {items.map((item) => {
              const Icon = ICONS[item.label] ?? Building2;

              if (!item.href) {
                return (
                  <li key={item.label}>
                    <span
                      title={item.label}
                      className="group/item relative mx-2 flex h-11 items-center rounded-xl text-neutral-600"
                    >
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
                      "group/item relative mx-2 flex h-11 items-center rounded-xl transition-colors duration-200",
                      active ? "bg-white/10 text-white" : "text-neutral-400 hover:bg-white/5 hover:text-white",
                    )}
                  >
                    {/* Brand accent rail on the active item. */}
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
    </div>
  );
}
