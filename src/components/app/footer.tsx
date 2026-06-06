import Link from "next/link";
import { Mail, MapPin, Phone } from "lucide-react";

/**
 * Global site footer — a black band rendered at the bottom of every page
 * (mounted once in the root layout). Reuses the Console chrome's near-black
 * neutral surface so the dark band reads consistently across all roles.
 *
 * NOTE: the Company / Resources / Legal links and the contact details are
 * placeholder ("dummy") content for the marketing chrome — wire them to real
 * pages/values when those exist.
 */

function FooterLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link href={href} className="text-neutral-400 transition-colors hover:text-white">
      {children}
    </Link>
  );
}

interface FooterColumn {
  title: string;
  links: { label: string; href: string }[];
}

const COLUMNS: FooterColumn[] = [
  {
    title: "Platform",
    links: [
      { label: "Dashboard", href: "/dashboard" },
      { label: "Schedule", href: "/schedule" },
      { label: "Attendance", href: "/attendance" },
      { label: "Announcements", href: "/announcements" },
    ],
  },
  {
    title: "Company",
    links: [
      { label: "About us", href: "#" },
      { label: "Careers", href: "#" },
      { label: "Press", href: "#" },
      { label: "Contact", href: "#" },
    ],
  },
  {
    title: "Resources",
    links: [
      { label: "Help center", href: "#" },
      { label: "Community", href: "#" },
      { label: "System status", href: "#" },
      { label: "Changelog", href: "#" },
    ],
  },
  {
    title: "Legal",
    links: [
      { label: "Privacy policy", href: "#" },
      { label: "Terms of service", href: "#" },
      { label: "Cookie settings", href: "#" },
      { label: "Child safety", href: "#" },
    ],
  },
];

export function Footer() {
  const year = new Date().getFullYear();

  return (
    <footer className="w-full bg-neutral-900 text-neutral-400">
      <div className="mx-auto w-full max-w-6xl px-6 py-12">
        <div className="grid grid-cols-2 gap-8 lg:grid-cols-6">
          {/* Brand + contact (spans full width on mobile, 2 cols on desktop) */}
          <div className="col-span-2">
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
            <ul className="mt-4 space-y-2 text-sm text-neutral-500">
              <li className="flex items-center gap-2">
                <MapPin className="size-4 shrink-0" aria-hidden />
                123 Stadium Way, Boston, MA 02115
              </li>
              <li className="flex items-center gap-2">
                <Mail className="size-4 shrink-0" aria-hidden />
                <a href="mailto:hello@forzateam.app" className="transition-colors hover:text-white">
                  hello@forzateam.app
                </a>
              </li>
              <li className="flex items-center gap-2">
                <Phone className="size-4 shrink-0" aria-hidden />
                <a href="tel:+15550123456" className="transition-colors hover:text-white">
                  +1 (555) 012-3456
                </a>
              </li>
            </ul>
          </div>

          {/* Link columns */}
          {COLUMNS.map((col) => (
            <nav key={col.title} aria-label={col.title}>
              <h2 className="text-xs font-semibold uppercase tracking-wider text-neutral-300">{col.title}</h2>
              <ul className="mt-3 space-y-2 text-sm">
                {col.links.map((link) => (
                  <li key={link.label}>
                    <FooterLink href={link.href}>{link.label}</FooterLink>
                  </li>
                ))}
              </ul>
            </nav>
          ))}
        </div>

        <div className="mt-10 flex flex-col items-center justify-between gap-3 border-t border-white/10 pt-6 text-xs text-neutral-500 sm:flex-row">
          <p>© {year} Forza Team. All rights reserved.</p>
          <nav aria-label="Social" className="flex items-center gap-4">
            <a href="#" className="transition-colors hover:text-white">Twitter</a>
            <a href="#" className="transition-colors hover:text-white">Instagram</a>
            <a href="#" className="transition-colors hover:text-white">Facebook</a>
          </nav>
        </div>
      </div>
    </footer>
  );
}
