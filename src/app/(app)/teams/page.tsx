import Link from "next/link";
import { ChevronRight, Shield } from "lucide-react";

import { AddModal, ListContainer, PageHeader } from "@/components/console";
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

  const list =
    teams.length === 0 ? (
      <p className="rounded-xl border border-dashed bg-card p-8 text-center text-sm text-muted-foreground">
        {canManage ? "No teams yet. Use the form to create your first team." : "You aren't assigned to any teams yet."}
      </p>
    ) : (
      <ListContainer>
        {teams.map((t) => (
          <Link
            key={t.id}
            href={`/teams/${t.id}`}
            className="group flex items-center gap-3 rounded-xl border bg-card px-3 py-2.5 shadow-xs ring-1 ring-transparent transition-all hover:border-primary hover:shadow-sm hover:ring-primary/10"
          >
            <span
              aria-hidden
              className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary"
            >
              <Shield className="size-4.5" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate font-sport text-sm font-bold text-foreground">{t.name}</p>
              <p className="truncate text-xs text-muted-foreground">
                {t.teamCode}
                {t.season ? ` · ${t.season.name}` : ""}
                {t.ageGroup ? ` · ${t.ageGroup}` : ""}
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <StatusBadge status={t.status} />
              <ChevronRight className="size-4 text-muted-foreground transition-colors group-hover:text-primary" aria-hidden />
            </div>
          </Link>
        ))}
      </ListContainer>
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
    <div className="mx-auto max-w-5xl">
      <PageHeader
        title="Teams"
        description="Create and manage your club's teams."
        actions={
          <AddModal label="Add Team" title="New team" description="Create a team for your club.">
            <CreateTeamForm
              seasons={seasons.filter((s) => s.status !== "ARCHIVED").map((s) => ({ id: s.id, name: s.name }))}
            />
          </AddModal>
        }
      />
      <div className="mt-6">{list}</div>
    </div>
  );
}
