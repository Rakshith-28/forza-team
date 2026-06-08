"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { LogOut, Settings } from "lucide-react";

import { clearActiveIdentityAction } from "@/app/(app)/identity-actions";
import { signOut } from "@/lib/auth-client";

/**
 * Navbar account dropdown: an avatar button that opens a menu with the user's
 * personal "Profile settings" (→ /account) and "Sign out". Available to every
 * role. Club/system settings stay in the sidebar (admins only). Uses the
 * codebase's custom dropdown pattern (state + backdrop + absolute menu) rather
 * than a Radix dependency that isn't installed.
 */
export function AccountMenu({
  name,
  email,
  initial,
  roleLabel,
  profileHref = "/account",
}: {
  name: string;
  email: string;
  initial: string;
  roleLabel: string;
  /** Personal profile/settings destination (parents use /me, console roles use /account). */
  profileHref?: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  async function handleSignOut() {
    setPending(true);
    await clearActiveIdentityAction();
    await signOut();
    router.push("/sign-in");
    router.refresh();
  }

  return (
    <div className="relative">
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Account menu"
        onClick={() => setOpen((o) => !o)}
        className="flex size-9 items-center justify-center rounded-full bg-primary text-sm font-bold text-primary-foreground ring-2 ring-transparent transition-all hover:ring-primary/30 focus-visible:outline-none focus-visible:ring-primary"
      >
        {initial}
      </button>

      {open ? (
        <>
          <button
            type="button"
            aria-hidden
            tabIndex={-1}
            onClick={() => setOpen(false)}
            className="fixed inset-0 z-40 cursor-default"
          />
          <div
            role="menu"
            className="absolute right-0 z-50 mt-2 w-60 overflow-hidden rounded-xl border bg-card p-1.5 shadow-xl"
          >
            <div className="border-b px-3 py-2.5">
              <p className="truncate text-sm font-semibold text-foreground">{name}</p>
              <p className="truncate text-xs text-muted-foreground">{email}</p>
              <span className="mt-1.5 inline-block rounded-full bg-secondary px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-secondary-foreground">
                {roleLabel}
              </span>
            </div>

            <Link
              href={profileHref}
              role="menuitem"
              onClick={() => setOpen(false)}
              className="mt-1 flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-foreground transition-colors hover:bg-secondary"
            >
              <Settings className="size-4 text-muted-foreground" aria-hidden />
              Profile settings
            </Link>

            <button
              type="button"
              role="menuitem"
              disabled={pending}
              onClick={handleSignOut}
              className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm text-destructive transition-colors hover:bg-destructive/10 disabled:opacity-60"
            >
              <LogOut className="size-4" aria-hidden />
              {pending ? "Signing out…" : "Sign out"}
            </button>
          </div>
        </>
      ) : null}
    </div>
  );
}
