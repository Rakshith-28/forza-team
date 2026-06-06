"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Building2, LogOut, Menu, Settings, X } from "lucide-react";

import { signOut } from "@/lib/auth-client";
import { cn } from "@/lib/utils";

import { ICONS, type NavItem, type SidebarProfile } from "./console-sidebar";

function isActive(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}

/**
 * Mobile navigation for the Console (admin/coach) — a hamburger in the header
 * that opens a slide-in dark drawer with the full nav (the desktop sidebar is
 * hidden below md). Closes on navigation, route change, or Escape.
 */
export function ConsoleMobileNav({
  items,
  profile,
  profileHref = "/account",
}: {
  items: NavItem[];
  profile: SidebarProfile;
  profileHref?: string;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);

  async function handleSignOut() {
    setSigningOut(true);
    await signOut();
    setOpen(false);
    router.push("/sign-in");
    router.refresh();
  }

  // Lock body scroll + close on Escape while open.
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div className="md:hidden">
      <button
        type="button"
        aria-label="Open menu"
        aria-expanded={open}
        onClick={() => setOpen(true)}
        className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
      >
        <Menu className="size-5" />
      </button>

      {open ? (
        <div className="fixed inset-0 z-50">
          <div
            className="absolute inset-0 bg-black/50 motion-safe:animate-in motion-safe:fade-in"
            aria-hidden
            onClick={() => setOpen(false)}
          />
          <aside
            role="dialog"
            aria-modal="true"
            aria-label="Navigation"
            className="absolute inset-y-0 left-0 flex w-72 max-w-[85vw] flex-col bg-neutral-900 text-neutral-400 shadow-xl motion-safe:animate-in motion-safe:slide-in-from-left motion-safe:duration-300"
          >
            <div className="flex h-16 shrink-0 items-center gap-3 px-3">
              <span className="grid size-9 shrink-0 place-items-center rounded-full bg-neutral-700 text-sm font-semibold text-white ring-2 ring-white/10">
                {profile.initial}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-white">{profile.name}</p>
                <p className="truncate text-xs text-neutral-500">{profile.roleLabel}</p>
              </div>
              <button
                type="button"
                aria-label="Close menu"
                onClick={() => setOpen(false)}
                className="rounded-md p-1.5 text-neutral-400 transition-colors hover:bg-white/10 hover:text-white"
              >
                <X className="size-5" />
              </button>
            </div>

            <div className="mx-3 mb-1 border-t border-white/10" />

            <nav className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden py-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              <ul className="flex flex-col gap-0.5 px-2">
                {items.map((item) => {
                  const Icon = ICONS[item.label] ?? Building2;
                  if (!item.href) {
                    return (
                      <li key={item.label}>
                        <span className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-neutral-600">
                          <Icon className="size-5 shrink-0" />
                          <span className="flex-1">{item.label}</span>
                          <span className="text-[10px] uppercase tracking-wide">soon</span>
                        </span>
                      </li>
                    );
                  }
                  const active = isActive(pathname, item.href);
                  return (
                    <li key={item.label}>
                      <Link
                        href={item.href}
                        aria-current={active ? "page" : undefined}
                        onClick={() => setOpen(false)}
                        className={cn(
                          "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-colors",
                          active ? "bg-white/10 font-semibold text-white" : "text-neutral-300 hover:bg-white/5 hover:text-white",
                        )}
                      >
                        <Icon className="size-5 shrink-0" />
                        <span className="flex-1">{item.label}</span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </nav>

            {/* Account menu pinned to the bottom of the drawer (partition above). */}
            <div className="mx-3 mt-1 border-t border-white/10" />
            <div className="shrink-0 px-2 py-2">
              <Link
                href={profileHref}
                onClick={() => setOpen(false)}
                aria-current={isActive(pathname, profileHref) ? "page" : undefined}
                className={cn(
                  "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-colors",
                  isActive(pathname, profileHref)
                    ? "bg-white/10 font-semibold text-white"
                    : "text-neutral-300 hover:bg-white/5 hover:text-white",
                )}
              >
                <Settings className="size-5 shrink-0" />
                <span className="flex-1">Profile settings</span>
              </Link>
              <button
                type="button"
                onClick={handleSignOut}
                disabled={signingOut}
                className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm text-neutral-300 transition-colors hover:bg-white/5 hover:text-white disabled:opacity-60"
              >
                <LogOut className="size-5 shrink-0" />
                <span className="flex-1">{signingOut ? "Signing out…" : "Sign out"}</span>
              </button>
            </div>
          </aside>
        </div>
      ) : null}
    </div>
  );
}
