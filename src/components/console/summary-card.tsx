import Link from "next/link";

import { cn } from "@/lib/utils";

export interface SummaryCardProps {
  label: string;
  value: React.ReactNode;
  /** Optional small caption under the value. */
  hint?: string;
  /** When set, the whole card is a link to this href. */
  href?: string;
  /** Where the label sits relative to the number. Default `bottom` (legacy). */
  labelPosition?: "top" | "bottom";
  /** Label emphasis. `green` = bold brand heading; `muted` = quiet caption (default). */
  labelTone?: "green" | "muted";
  className?: string;
}

/**
 * CONSOLE summary stat card. The Master Admin dashboard uses
 * `labelPosition="top" labelTone="green"` (bold green heading above a large
 * number); the default reproduces the prior "number then muted caption" look so
 * existing callers are unaffected.
 */
export function SummaryCard({
  label,
  value,
  hint,
  href,
  labelPosition = "bottom",
  labelTone = "muted",
  className,
}: SummaryCardProps) {
  const labelEl = (
    <p
      className={cn(
        labelTone === "green"
          ? "font-sport text-xs font-bold uppercase tracking-wide text-primary"
          : "text-sm text-muted-foreground",
      )}
    >
      {label}
    </p>
  );
  const valueEl = <p className="font-sport text-3xl font-extrabold leading-none text-foreground">{value}</p>;

  const body = (
    <div
      className={cn(
        "flex h-full flex-col gap-1.5 rounded-xl border bg-card p-5 shadow-sm transition-colors",
        href && "hover:border-primary",
        className,
      )}
    >
      {labelPosition === "top" ? (
        <>
          {labelEl}
          <div className="mt-1">{valueEl}</div>
        </>
      ) : (
        <>
          {valueEl}
          <div className="mt-1">{labelEl}</div>
        </>
      )}
      {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  );

  if (href) {
    return (
      <Link href={href} className="block focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 rounded-xl">
        {body}
      </Link>
    );
  }
  return body;
}
