import Link from "next/link";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requireRole } from "@/lib/auth-guards";
import { listTeams } from "@/modules/clubs/service";

import { EventForm } from "../event-form";

export default async function NewEventPage() {
  const ctx = await requireRole("MASTER_ADMIN", "CLUB_ADMIN", "COACH");
  if (!ctx.activeClubId) {
    return (
      <div className="mx-auto max-w-lg py-16 text-center">
        <h1 className="font-sport text-xl font-bold">No active club</h1>
      </div>
    );
  }

  const canClubWide = ctx.role === "MASTER_ADMIN" || ctx.role === "CLUB_ADMIN";
  const teams = await listTeams(ctx, ctx.activeClubId);
  const teamOptions = teams.filter((t) => t.status !== "ARCHIVED").map((t) => ({ id: t.id, name: t.name }));

  return (
    <div className="mx-auto max-w-2xl">
      <Link href="/schedule" className="text-sm text-muted-foreground underline-offset-4 hover:underline">
        ← Schedule
      </Link>
      <h1 className="mt-3 font-display text-3xl uppercase tracking-tight text-foreground">New event</h1>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle className="font-sport text-base">Event details</CardTitle>
        </CardHeader>
        <CardContent>
          <EventForm teams={teamOptions} canClubWide={canClubWide} />
        </CardContent>
      </Card>
    </div>
  );
}
