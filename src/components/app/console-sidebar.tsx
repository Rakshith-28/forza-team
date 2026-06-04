"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import {
  BarChart3,
  Building2,
  Calendar,
  CalendarRange,
  ChevronRight,
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
 * Console navigation (admin/coach). A single translucent "pill" highlight
 * physically slides + resizes to the active item (measured from the DOM) with a
 * gentle spring, icon chips fill green when active, and the rows fan in once on
 * load. All motion is gated behind motion-safe for reduced-motion users.
 */
export function ConsoleSidebar({ items }: { items: NavItem[] }) {
  const pathname = usePathname();
  const listRef = useRef<HTMLUListElement>(null);
  const [indicator, setIndicator] = useState<{ top: number; height: number; ready: boolean }>({
    top: 0,
    height: 0,
    ready: false,
  });
  // Don't animate the highlight into place on first paint — only when it moves.
  const [armed, setArmed] = useState(false);

  useEffect(() => {
    const measure = () => {
      const ul = listRef.current;
      if (!ul) return;
      const el = ul.querySelector<HTMLElement>('[data-active="true"]');
      if (el) setIndicator({ top: el.offsetTop, height: el.offsetHeight, ready: true });
      else setIndicator((s) => ({ ...s, ready: false }));
    };
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [pathname, items]);

  useEffect(() => {
    const id = requestAnimationFrame(() => setArmed(true));
    return () => cancelAnimationFrame(id);
  }, []);

  return (
    <nav className="hidden w-60 shrink-0 border-r bg-sidebar p-3 md:block">
      <p className="px-2.5 pb-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground/60">
        Navigation
      </p>
      <ul ref={listRef} className="relative flex flex-col gap-0.5">
        {/* The sliding highlight — moves + resizes to the active row. */}
        <span
          aria-hidden
          className={cn(
            "pointer-events-none absolute inset-x-1 z-0 rounded-xl bg-primary/10 ring-1 ring-inset ring-primary/20",
            indicator.ready ? "opacity-100" : "opacity-0",
            armed &&
              "motion-safe:transition-[transform,height] motion-safe:duration-300 motion-safe:ease-[cubic-bezier(0.34,1.4,0.64,1)]",
          )}
          style={{ transform: `translateY(${indicator.top}px)`, height: indicator.ready ? indicator.height : 0 }}
        />

        {items.map((item, i) => {
          const Icon = ICONS[item.label] ?? Building2;
          const enter =
            "motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-left-3 motion-safe:fill-mode-both motion-safe:duration-300";
          const style = { animationDelay: `${i * 35}ms` } as const;

          if (!item.href) {
            return (
              <li key={item.label} className={cn("relative z-10", enter)} style={style}>
                <span className="group/navitem flex items-center gap-3 rounded-xl px-2.5 py-2 text-sm text-muted-foreground/70">
                  <span className="grid size-7 shrink-0 place-items-center rounded-lg bg-secondary/60 text-muted-foreground/60">
                    <Icon className="size-4" />
                  </span>
                  <span className="flex-1">{item.label}</span>
                  <Lock className="size-3.5 text-muted-foreground/50" />
                </span>
              </li>
            );
          }

          const active = isActive(pathname, item.href);

          return (
            <li
              key={item.label}
              data-active={active || undefined}
              className={cn("relative z-10", enter)}
              style={style}
            >
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "group/navitem flex items-center gap-3 rounded-xl px-2.5 py-2 text-sm transition-colors duration-200",
                  active ? "font-semibold text-primary" : "text-sidebar-foreground hover:text-foreground",
                )}
              >
                <span
                  className={cn(
                    "grid size-7 shrink-0 place-items-center rounded-lg transition-all duration-200 ease-out",
                    active
                      ? "bg-primary text-primary-foreground shadow-sm"
                      : "bg-secondary text-muted-foreground group-hover/navitem:scale-110 group-hover/navitem:text-foreground",
                  )}
                >
                  <Icon className="size-4" />
                </span>
                <span className="flex-1 transition-transform duration-200 ease-out group-hover/navitem:translate-x-0.5">
                  {item.label}
                </span>
                <ChevronRight
                  className={cn(
                    "size-4 text-primary transition-all duration-200 ease-out",
                    active ? "opacity-100" : "-translate-x-1 opacity-0",
                  )}
                />
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
