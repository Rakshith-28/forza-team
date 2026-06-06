import Link from "next/link";

import { PageHeader, TwoPane } from "@/components/console";
import { requireAuthContext } from "@/lib/auth-guards";
import { can } from "@/lib/rbac";
import { listSeasons, listTeams } from "@/modules/clubs/service";

import { StatusBadge } from "../seasons/season-forms";
import { CreateTeamForm } from "./team-create-form";

export default async function TeamsPage() {
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
  const canManage = can(ctx, "teams.manage", { clubId });
  const [teams, seasons] = await Promise.all([
    listTeams(ctx, clubId),
    canManage ? listSeasons(ctx, clubId) : Promise.resolve([]),
  ]);

  const list = (
    <div className="flex flex-col gap-3">
      {teams.length === 0 ? (
        <p className="rounded-lg border border-dashed bg-card p-8 text-center text-sm text-muted-foreground">
          {canManage ? "No teams yet. Use the form to create your first team." : "You aren't assigned to any teams yet."}
        </p>
      ) : (
        teams.map((t) => (
          <Link
            key={t.id}
            href={`/teams/${t.id}`}
            className="flex items-center justify-between gap-4 rounded-lg border bg-card p-4 transition-colors hover:border-primary"
          >
            <div>
              <p className="font-sport text-base font-bold text-foreground">{t.name}</p>
              <p className="text-sm text-muted-foreground">
                {t.teamCode}
                {t.season ? ` · ${t.season.name}` : ""}
                {t.ageGroup ? ` · ${t.ageGroup}` : ""}
              </p>
            </div>
            <StatusBadge status={t.status} />
          </Link>
        ))
      )}
    </div>
  );

  if (!canManage) {
    return (
      <div className="mx-auto max-w-3xl">
        <PageHeader title="Teams" description="Teams you coach." />
        <div className="mt-6">{list}</div>
      </div>
    );
  }

  return (
    <TwoPane
      title="Teams"
      description="Create and manage your club's teams."
      formTitle="New team"
      form={
        <CreateTeamForm
          seasons={seasons.filter((s) => s.status !== "ARCHIVED").map((s) => ({ id: s.id, name: s.name }))}
        />
      }
    >
      {list}
    </TwoPane>
  );
}
