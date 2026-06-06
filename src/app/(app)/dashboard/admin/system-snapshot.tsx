"use client";

import { useState } from "react";
import Link from "next/link";
import { ChevronDown } from "lucide-react";

import { cn } from "@/lib/utils";

export interface SnapshotItem {
  label: string;
  value: number;
  href?: string;
}

/** Rows shown before the "Show more" toggle reveals the rest. */
const INITIAL_COUNT = 4;

/**
 * "System snapshot" rows for the Master Admin dashboard. Shows the first few
 * counts and collapses the remainder behind a Show more / Show less toggle so
 * the panel doesn't become a tall wall of rows (especially on mobile).
 */
export function SystemSnapshot({ items }: { items: SnapshotItem[] }) {
  const [expanded, setExpanded] = useState(false);
  const visible = expanded ? items : items.slice(0, INITIAL_COUNT);
  const hiddenCount = items.length - INITIAL_COUNT;

  return (
    <>
      <dl className="mt-4 grid gap-x-8 gap-y-1 sm:grid-cols-2 lg:grid-cols-3">
        {visible.map((s) => {
          const row = (
            <div className="flex items-center justify-between border-b border-border/60 py-2">
              <dt className="text-sm text-muted-foreground">{s.label}</dt>
              <dd className="font-sport text-lg font-bold tabular-nums text-foreground">{s.value}</dd>
            </div>
          );
          return s.href ? (
            <Link
              key={s.label}
              href={s.href}
              className="rounded-md transition-colors hover:text-primary [&_dt]:hover:text-primary"
            >
              {row}
            </Link>
          ) : (
            <div key={s.label}>{row}</div>
          );
        })}
      </dl>

      {hiddenCount > 0 ? (
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          aria-expanded={expanded}
          className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-primary transition-colors hover:underline focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 rounded-md"
        >
          {expanded ? "Show less" : `Show more (${hiddenCount})`}
          <ChevronDown className={cn("size-4 transition-transform", expanded && "rotate-180")} aria-hidden />
        </button>
      ) : null}
    </>
  );
}
