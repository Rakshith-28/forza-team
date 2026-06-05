import Link from "next/link";

import { PageHeader } from "@/components/console";
import { requireRole } from "@/lib/auth-guards";
import { listGoalPlayerOptions } from "@/modules/evaluations/development-service";

import { CompareClient } from "./compare-client";

export default async function ComparePage() {
  const ctx = await requireRole("COACH", "CLUB_ADMIN", "MASTER_ADMIN");
  if (!ctx.activeClubId) {
    return (
      <div className="mx-auto max-w-lg py-16 text-center">
        <h1 className="font-sport text-xl font-bold">No active club</h1>
        <p className="mt-2 text-sm text-muted-foreground">Your account isn&apos;t scoped to a club yet.</p>
      </div>
    );
  }

  const players = await listGoalPlayerOptions(ctx, ctx.activeClubId);

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader
        title="Compare players"
        description="Radar comparison of players' latest evaluations."
        actions={
          <Link href="/evaluations" className="text-sm font-medium text-primary hover:underline">
            ← Evaluations
          </Link>
        }
      />
      <div className="mt-6">
        <CompareClient players={players.map((p) => ({ playerId: p.playerId, name: p.name }))} />
      </div>
    </div>
  );
}
