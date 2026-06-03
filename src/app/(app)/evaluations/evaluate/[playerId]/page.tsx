import Link from "next/link";
import { notFound } from "next/navigation";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requireRole } from "@/lib/auth-guards";
import { listCycles, listPlayerEvaluations, listTemplates } from "@/modules/evaluations/service";
import { getPlayer } from "@/modules/roster/service";

import { PlayerEvaluationForm } from "./eval-form";

export default async function EvaluatePlayerPage({ params }: { params: Promise<{ playerId: string }> }) {
  const { playerId } = await params;
  const ctx = await requireRole("MASTER_ADMIN", "CLUB_ADMIN", "COACH");

  const player = await getPlayer(ctx, playerId);
  if (!player) notFound();
  const clubId = player.clubId;

  const [templates, cycles, existing] = await Promise.all([
    listTemplates(ctx, clubId),
    listCycles(ctx, clubId),
    listPlayerEvaluations(ctx, clubId, { playerId }),
  ]);

  // Teams the caller may evaluate this player within (coach → assigned only).
  const playerTeams = player.teamMemberships.map((m) => ({ id: m.team.id, name: m.team.name }));
  const teams = ctx.role === "COACH" ? playerTeams.filter((t) => ctx.coachTeamIds.includes(t.id)) : playerTeams;

  return (
    <div className="mx-auto max-w-2xl">
      <Link href={`/players/${playerId}`} className="text-sm text-muted-foreground underline-offset-4 hover:underline">
        ← {player.firstName} {player.lastName}
      </Link>
      <h1 className="mt-3 font-display text-3xl uppercase tracking-tight text-foreground">Evaluate</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        {player.firstName} {player.lastName}
      </p>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle className="font-sport text-base">New / update evaluation</CardTitle>
        </CardHeader>
        <CardContent>
          <PlayerEvaluationForm
            playerId={playerId}
            teams={teams}
            cycles={cycles.map((c) => ({ id: c.id, name: c.name }))}
            templates={templates.map((t) => ({
              id: t.id,
              name: t.name,
              criteria: t.criteria
                .filter((c) => c.isActive)
                .map((c) => ({ id: c.id, label: c.label, minScore: Number(c.minScore), maxScore: Number(c.maxScore) })),
            }))}
          />
        </CardContent>
      </Card>

      <Card className="mt-4">
        <CardHeader>
          <CardTitle className="font-sport text-base">Past evaluations</CardTitle>
        </CardHeader>
        <CardContent>
          {existing.length === 0 ? (
            <p className="text-sm text-muted-foreground">No evaluations yet.</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {existing.map((e) => (
                <li key={e.id} className="flex items-center justify-between rounded-lg border bg-card p-3 text-sm">
                  <span className="text-foreground">{e.evaluationCycle.name}</span>
                  <span className="font-sport font-bold text-foreground">{Number(e.overallScore).toFixed(1)}</span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
