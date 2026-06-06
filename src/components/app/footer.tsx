import Link from "next/link";

/**
 * Global site footer — a black band rendered at the bottom of every page
 * (mounted once in the root layout). Reuses the Console chrome's near-black
 * neutral surface so the dark band reads consistently across all roles.
 */

function FooterLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link href={href} className="text-neutral-400 transition-colors hover:text-white">
      {children}
    </Link>
  );
}

export function Footer() {
  const year = new Date().getFullYear();

  return (
    <footer className="bg-neutral-900 text-neutral-400">
      <div className="mx-auto w-full max-w-6xl px-6 py-10">
        <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
          {/* Brand + tagline */}
          <div className="lg:col-span-2">
            <Link
              href="/"
              className="font-display text-lg uppercase tracking-[0.2em] text-white transition-opacity hover:opacity-80"
            >
              Forza<span className="ml-[0.2em] text-primary">Team</span>
            </Link>
            <p className="mt-3 max-w-xs text-sm text-neutral-500">
              Multi-tenant soccer club management — rosters, schedules, attendance, and team
              communication in one place.
            </p>
          </div>

          {/* Platform links (real app routes) */}
          <nav aria-label="Platform">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-neutral-300">Platform</h2>
            <ul className="mt-3 space-y-2 text-sm">
              <li><FooterLink href="/dashboard">Dashboard</FooterLink></li>
              <li><FooterLink href="/schedule">Schedule</FooterLink></li>
              <li><FooterLink href="/attendance">Attendance</FooterLink></li>
              <li><FooterLink href="/announcements">Announcements</FooterLink></li>
            </ul>
          </nav>

          {/* Secondary links (real app routes) */}
          <nav aria-label="More">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-neutral-300">More</h2>
            <ul className="mt-3 space-y-2 text-sm">
              <li><FooterLink href="/documents">Documents</FooterLink></li>
              <li><FooterLink href="/evaluations">Evaluations</FooterLink></li>
              <li><FooterLink href="/account">Account</FooterLink></li>
            </ul>
          </nav>
        </div>

        <div className="mt-8 flex flex-col items-center justify-between gap-2 border-t border-white/10 pt-6 text-xs text-neutral-500 sm:flex-row">
          <p>© {year} Forza Team. All rights reserved.</p>
          <p>Built for clubs, coaches, players &amp; parents.</p>
        </div>
      </div>
    </footer>
  );
}
