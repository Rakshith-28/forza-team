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

/**
 * Console navigation (admin/coach). Active-route aware via usePathname, with an
 * animated accent rail, hover nudge, per-item icons, and a one-time staggered
 * entrance. Motion is suppressed under prefers-reduced-motion.
 */
export function ConsoleSidebar({ items }: { items: NavItem[] }) {
  const pathname = usePathname();

  return (
    <nav className="hidden w-60 shrink-0 border-r bg-sidebar p-3 md:block">
      <ul className="flex flex-col gap-0.5">
        {items.map((item, i) => {
          const Icon = ICONS[item.label] ?? Building2;
          const style = { animationDelay: `${i * 35}ms` } as const;
          const enter =
            "motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-left-3 motion-safe:fill-mode-both motion-safe:duration-300";

          if (!item.href) {
            return (
              <li key={item.label} style={style} className={enter}>
                <span className="group/navitem relative flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-muted-foreground/70">
                  <Icon className="size-4 shrink-0 opacity-60" />
                  <span className="flex-1">{item.label}</span>
                  <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground/70">
                    soon
                  </span>
                </span>
              </li>
            );
          }

          const active = isActive(pathname, item.href);

          return (
            <li key={item.label} style={style} className={enter}>
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "group/navitem relative flex items-center gap-3 overflow-hidden rounded-lg px-3 py-2 text-sm font-medium transition-colors duration-200",
                  active
                    ? "bg-primary/10 text-primary"
                    : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                )}
              >
                {/* Accent rail: tall when active, grows from center on hover. */}
                <span
                  aria-hidden
                  className={cn(
                    "absolute left-0 top-1/2 w-1 -translate-y-1/2 rounded-r-full bg-primary transition-all duration-300 ease-out",
                    active ? "h-7" : "h-0 group-hover/navitem:h-4",
                  )}
                />
                <Icon
                  className={cn(
                    "size-4 shrink-0 transition-transform duration-200 ease-out group-hover/navitem:scale-110",
                    active && "text-primary",
                  )}
                />
                <span className="transition-transform duration-200 ease-out group-hover/navitem:translate-x-0.5">
                  {item.label}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
