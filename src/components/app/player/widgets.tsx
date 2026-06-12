import Link from "next/link";

import { cn } from "@/lib/utils";

/**
 * Presentational widgets for the player home (bento tiles, collectible
 * card, attendance ring, XP bar, stories strip). All styling is token-driven via
 * `.app-card` / `.app-pill` and the `--pop-*` palette, so Vibrant (thick ink
 * borders, hard shadows, rainbow) and Classic (hairline, soft, green-led) render
 * the same components with no per-theme code.
 */

export function AttendanceRing({ present, total }: { present: number; total: number }) {
  const pct = total > 0 ? Math.round((present / total) * 100) : 0;
  const r = 34;
  const circumference = 2 * Math.PI * r;
  const dash = (pct / 100) * circumference;
  return (
    <div className="relative grid size-22 place-items-center">
      <svg width="88" height="88" viewBox="0 0 88 88" className="-rotate-90">
        <circle cx="44" cy="44" r={r} fill="none" stroke="var(--secondary)" strokeWidth="9" />
        <circle
          cx="44"
          cy="44"
          r={r}
          fill="none"
          stroke="var(--primary)"
          strokeWidth="9"
          strokeLinecap="round"
          strokeDasharray={`${dash} ${circumference}`}
        />
      </svg>
      <div className="absolute text-center leading-none">
        <p className="font-sport text-xl font-extrabold text-foreground">{pct}%</p>
        <p className="text-[10px] text-muted-foreground">present</p>
      </div>
    </div>
  );
}

export function XpBar({ level, progress }: { level: number; progress: number }) {
  return (
    <div className="app-card p-3.5">
      <div className="flex items-center justify-between text-xs font-bold uppercase tracking-wide">
        <span className="text-foreground">Level {level}</span>
        <span className="text-muted-foreground">{progress}%</span>
      </div>
      <div className="mt-2 h-3 overflow-hidden rounded-full bg-secondary">
        <div
          className="h-full rounded-full bg-(--pop-1)"
          style={{ width: `${Math.max(4, progress)}%` }}
        />
      </div>
    </div>
  );
}

export interface CollectibleCardProps {
  name: string;
  jerseyNumber: string | null;
  position: string | null;
  teamName: string | null;
  photoUrl: string | null;
  href?: string;
}

export function CollectibleCard({ name, jerseyNumber, position, teamName, photoUrl, href }: CollectibleCardProps) {
  const inner = (
    <div
      className="app-card flex items-stretch gap-3 overflow-hidden p-0"
      style={{ background: "var(--card-premium)", color: "var(--card-premium-fg)", borderColor: "var(--border)" }}
    >
      <div className="flex w-20 shrink-0 flex-col items-center justify-center bg-black/10 py-4">
        <span className="font-display text-3xl leading-none">{jerseyNumber ?? "—"}</span>
        <span className="mt-1 text-[10px] font-semibold uppercase tracking-widest opacity-80">
          {position ?? "—"}
        </span>
      </div>
      <div className="flex flex-1 items-center gap-3 py-3 pr-3">
        {photoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={photoUrl} alt="" className="size-12 rounded-full object-cover ring-2 ring-white/40" />
        ) : (
          <span className="grid size-12 place-items-center rounded-full bg-white/15 font-sport text-lg font-bold">
            {name.slice(0, 1)}
          </span>
        )}
        <div className="min-w-0">
          <p className="truncate font-sport text-lg font-bold uppercase leading-tight">{name}</p>
          <p className="truncate text-xs opacity-80">{teamName ?? "No team yet"}</p>
        </div>
      </div>
    </div>
  );
  return href ? <Link href={href}>{inner}</Link> : inner;
}

export function StoriesStrip({ items }: { items: { id: string; title: string }[] }) {
  if (items.length === 0) return null;
  return (
    <div className="-mx-1 flex gap-3 overflow-x-auto px-1 pb-1">
      {items.map((s) => (
        <Link key={s.id} href="/announcements" className="flex w-16 shrink-0 flex-col items-center gap-1">
          <span
            className="app-pill grid size-16 place-items-center text-2xl"
            style={{ background: "var(--pop-3)", color: "var(--app-ink)" }}
          >
            📣
          </span>
          <span className="line-clamp-2 text-center text-[10px] font-medium text-muted-foreground">{s.title}</span>
        </Link>
      ))}
    </div>
  );
}

export function StatTile({
  label,
  value,
  accent = "var(--pop-1)",
  dot = true,
}: {
  label: string;
  value: string;
  accent?: string;
  /** Small accent dot above the value. Off for tiles where the number leads. */
  dot?: boolean;
}) {
  return (
    <div className="app-card p-3.5">
      {dot ? <span className="inline-block size-2.5 rounded-full" style={{ background: accent }} /> : null}
      <p className={cn("font-sport text-2xl font-extrabold text-foreground", dot && "mt-2")}>{value}</p>
      <p className="text-xs text-muted-foreground">{label}</p>
    </div>
  );
}
