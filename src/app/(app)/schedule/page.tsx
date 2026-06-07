import Link from "next/link";

import { Button } from "@/components/ui/button";
import { ParentSchedule, type ParentChildRsvp } from "@/components/schedule/parent-schedule";
import { ScheduleView } from "@/components/schedule/schedule-view";
import { requireAuthContext } from "@/lib/auth-guards";
import { can } from "@/lib/rbac";
import { getClubTimezone, listParentSchedule, listScheduleEvents } from "@/modules/events/service";
import { scheduleWindow } from "@/modules/events/schedule-window";

export default async function SchedulePage() {
  const ctx = await requireAuthContext();
  if (!ctx.activeClubId) {
    return (
      <div className="mx-auto max-w-lg py-16 text-center">
        <h1 className="font-sport text-xl font-bold">No active club</h1>
        <p className="mt-2 text-sm text-muted-foreground">Your account isn&apos;t scoped to a club yet.</p>
      </div>
    );
  }

  const clubId = ctx.activeClubId;

  // ---- Parent / player: themed calendar + per-child RSVP rail ----
  if (ctx.role === "PARENT") {
    if (ctx.linkedPlayerIds.length === 0) {
      return (
        <div>
          <h1 className="font-display text-2xl uppercase tracking-tight text-foreground">Schedule</h1>
          <p className="mt-6 rounded-lg border border-dashed bg-card p-8 text-center text-sm text-muted-foreground">
            No children are linked to your account yet.
          </p>
        </div>
      );
    }

    const tz = await getClubTimezone(ctx, clubId);
    const { todayKey, month, from, to } = scheduleWindow(new Date(), tz);
    const [events, schedule] = await Promise.all([
      listScheduleEvents({ actor: ctx, from, to }),
      listParentSchedule(ctx),
    ]);
    // Map each event → this parent's participating children + their RSVP.
    const childrenByEvent: Record<string, ParentChildRsvp[]> = {};
    for (const s of schedule) childrenByEvent[s.event.id] = s.children;

    return (
      <div>
        <h1 className="font-display text-2xl uppercase tracking-tight text-foreground">Schedule</h1>
        <p className="mt-1 text-sm text-muted-foreground">Events across all your children, with RSVP.</p>
        <div className="mt-6">
          <ParentSchedule
            events={events}
            childrenByEvent={childrenByEvent}
            today={todayKey}
            month={month}
            selectedDate={todayKey}
          />
        </div>
      </div>
    );
  }

  // ---- Admin / Coach: the calendar is the primary view ----
  const canManage = can(ctx, "events.manage", { clubId });
  const tz = await getClubTimezone(ctx, clubId);
  const { todayKey, month, from, to } = scheduleWindow(new Date(), tz);
  const events = await listScheduleEvents({ actor: ctx, from, to });

  return (
    <div className="mx-auto max-w-6xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-3xl uppercase tracking-tight text-foreground">Schedule</h1>
          <p className="mt-1 text-muted-foreground">
            {ctx.role === "COACH" ? "Events for the teams you coach." : "Club and team events."}
          </p>
        </div>
        {canManage ? (
          <Button asChild>
            <Link href="/schedule/new">New event</Link>
          </Button>
        ) : null}
      </div>

      <div className="mt-6">
        <ScheduleView
          events={events}
          today={todayKey}
          initialMonth={month}
          initialSelectedDate={todayKey}
          detailHref={(id) => `/schedule/${id}`}
        />
      </div>
    </div>
  );
}
