import { PageHeader } from "@/components/console";
import { requireRole } from "@/lib/auth-guards";
import { listDevelopmentGoals, listGoalPlayerOptions } from "@/modules/evaluations/development-service";

import { DevelopmentClient } from "./development-client";

export default async function DevelopmentPage() {
  const ctx = await requireRole("COACH", "CLUB_ADMIN", "MASTER_ADMIN");
  if (!ctx.activeClubId) {
    return (
      <div className="mx-auto max-w-lg py-16 text-center">
        <h1 className="font-sport text-xl font-bold">No active club</h1>
        <p className="mt-2 text-sm text-muted-foreground">Your account isn&apos;t scoped to a club yet.</p>
      </div>
    );
  }

  const [goals, players] = await Promise.all([
    listDevelopmentGoals(ctx, ctx.activeClubId),
    listGoalPlayerOptions(ctx, ctx.activeClubId),
  ]);

  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader title="Development" description="Player development goals and progress." />
      <div className="mt-6">
        <DevelopmentClient goals={goals} players={players} />
      </div>
    </div>
  );
}
