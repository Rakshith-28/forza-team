import Link from "next/link";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { requireRole } from "@/lib/auth-guards";
import { listLinkedChildren } from "@/modules/roster/service";
import { listParentSchedule } from "@/modules/events/service";
import { formatEventTime } from "@/modules/events/format";

export default async function ParentDashboard() {
  const ctx = await requireRole("PARENT");
  const [children, schedule] = await Promise.all([
    listLinkedChildren(ctx),
    listParentSchedule(ctx, { upcomingOnly: true, limit: 5 }),
  ]);
  const upcoming = schedule.filter((s) => s.event.status !== "CANCELLED");

  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="font-display text-3xl uppercase tracking-tight text-foreground">My Kids</h1>
      <p className="mt-1 text-muted-foreground">
        Your linked children and their teams. Select a child to see their profile.
      </p>

      {children.length === 0 ? (
        <p className="mt-6 rounded-lg border border-dashed bg-card p-8 text-center text-sm text-muted-foreground">
          No children are linked to your account yet. Your club admin links children to your profile.
        </p>
      ) : (
        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          {children.map((c) => (
            <Link key={c.id} href={`/my-kids/${c.id}`}>
              <Card className="h-full transition-colors hover:border-primary">
                <CardHeader>
                  <CardTitle className="font-sport text-base">{c.displayName}</CardTitle>
                  <CardDescription>
                    {c.jerseyNumber ? `#${c.jerseyNumber}` : "No number"}
                    {c.primaryPosition ? ` · ${c.primaryPosition}` : ""}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">
                    {c.teams.length > 0 ? c.teams.map((t) => t.name).join(", ") : "No team yet"}
                  </p>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}

      <h2 className="mt-8 font-sport text-sm font-bold uppercase tracking-wide text-muted-foreground">
        Upcoming events
      </h2>
      <div className="mt-3 flex flex-col gap-2">
        {upcoming.length === 0 ? (
          <p className="rounded-lg border border-dashed bg-card p-6 text-center text-sm text-muted-foreground">
            Nothing scheduled. <Link href="/schedule" className="underline">View schedule</Link>.
          </p>
        ) : (
          upcoming.map(({ event, children: kids }) => {
            const rsvpNeeded = kids.some((k) => k.rsvpStatus == null);
            return (
              <Link
                key={event.id}
                href={`/schedule/${event.id}`}
                className="flex items-center justify-between gap-3 rounded-lg border bg-card p-3 transition-colors hover:border-primary"
              >
                <div>
                  <p className="font-medium text-foreground">{event.title}</p>
                  <p className="text-xs text-muted-foreground">
                    {formatEventTime(event.startAt, event.timezone)}
                    {event.teamName ? ` · ${event.teamName}` : ""}
                  </p>
                </div>
                {rsvpNeeded ? (
                  <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-semibold text-primary">
                    RSVP needed
                  </span>
                ) : null}
              </Link>
            );
          })
        )}
      </div>
    </div>
  );
}
