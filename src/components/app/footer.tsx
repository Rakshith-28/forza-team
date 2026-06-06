import Link from "next/link";

/**
 * Global site footer — a black band rendered at the bottom of every page
 * (mounted once in the root layout). Reuses the Console chrome's near-black
 * neutral surface so the dark band reads consistently across all roles.
 */
export function Footer() {
  const year = new Date().getFullYear();

  return (
    <footer className="bg-neutral-900 text-neutral-400">
      <div className="mx-auto flex w-full max-w-6xl flex-col items-center justify-between gap-2 px-6 py-6 text-sm sm:flex-row">
        <Link
          href="/"
          className="font-display text-base uppercase tracking-[0.2em] text-white transition-opacity hover:opacity-80"
        >
          Forza<span className="ml-[0.2em] text-primary">Team</span>
        </Link>
        <p className="text-xs text-neutral-500">© {year} Forza Team. All rights reserved.</p>
      </div>
    </footer>
  );
}
