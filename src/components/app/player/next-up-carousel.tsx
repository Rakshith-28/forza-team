"use client";

import { useRef, useState } from "react";

import { RsvpControl } from "@/app/(app)/schedule/rsvp-control";
import { cn } from "@/lib/utils";

export interface NextUpSlide {
  id: string;
  title: string;
  /** Pre-formatted "time · team" line (formatted server-side). */
  subtitle: string;
  children: { playerId: string; name: string; rsvpStatus: string | null }[];
}

/**
 * "Next up" sessions as a horizontal swipe carousel. Each session is one
 * full-width snap slide; dots below track the active slide, and the
 * "Swipe for more" hint hides once the last slide is reached.
 */
export function NextUpCarousel({ slides }: { slides: NextUpSlide[] }) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(0);
  const multiple = slides.length > 1;

  function handleScroll() {
    const el = scrollRef.current;
    if (!el) return;
    // Each slide is exactly the scroll container's width, so the active index
    // is the rounded ratio of scroll offset to slide width.
    const idx = Math.round(el.scrollLeft / el.clientWidth);
    setActive(Math.max(0, Math.min(slides.length - 1, idx)));
  }

  return (
    <div className="app-card p-4">
      <div className="flex items-center justify-between">
        <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Next up</p>
        {multiple && active < slides.length - 1 ? (
          <p className="text-[11px] font-medium text-muted-foreground">Swipe for more →</p>
        ) : null}
      </div>

      <div
        ref={scrollRef}
        onScroll={handleScroll}
        className="-mx-4 mt-1 flex snap-x snap-mandatory overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {slides.map((s) => (
          <div key={s.id} className="w-full shrink-0 snap-start px-4">
            <p className="font-sport text-lg font-bold text-foreground">{s.title}</p>
            <p className="text-sm text-muted-foreground">{s.subtitle}</p>
            <div className="mt-3 flex flex-col gap-1.5 border-t pt-3">
              {s.children.map((c) => (
                <RsvpControl
                  key={c.playerId}
                  eventId={s.id}
                  playerId={c.playerId}
                  playerName={c.name}
                  current={c.rsvpStatus}
                />
              ))}
            </div>
          </div>
        ))}
      </div>

      {multiple ? (
        <div className="mt-3 flex justify-center gap-1.5" aria-hidden>
          {slides.map((s, i) => (
            <span
              key={s.id}
              className={cn(
                "size-1.5 rounded-full transition-colors",
                i === active ? "bg-primary" : "bg-muted-foreground/30",
              )}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}
