import { cn } from "@/lib/utils";

/**
 * CONSOLE status pill. Maps common status vocabularies to the three semantic
 * tones used across the platform: green (healthy/active), amber (attention),
 * red/muted (stopped/archived). Unknown values fall back to a neutral chip.
 */
const TONE: Record<string, string> = {
  // green
  ACTIVE: "bg-primary/10 text-primary",
  ACCEPTED: "bg-primary/10 text-primary",
  PAID: "bg-primary/10 text-primary",
  // amber
  PENDING: "bg-amber-100 text-amber-700",
  SUSPENDED: "bg-amber-100 text-amber-700",
  PARTIALLY_PAID: "bg-amber-100 text-amber-700",
  WAITLISTED: "bg-amber-100 text-amber-700",
  // red
  OVERDUE: "bg-destructive/10 text-destructive",
  SUSPENDED_HARD: "bg-destructive/10 text-destructive",
  // muted
  ARCHIVED: "bg-muted text-muted-foreground",
  INACTIVE: "bg-muted text-muted-foreground",
};

export function StatusBadge({ status, className }: { status: string; className?: string }) {
  const tone = TONE[status] ?? "bg-secondary text-ink-2";
  return (
    <span
      className={cn(
        "inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold uppercase tracking-wide",
        tone,
        className,
      )}
    >
      {status.replace(/_/g, " ")}
    </span>
  );
}
