import { TwoPane } from "@/components/console";
import { requireRole } from "@/lib/auth-guards";
import { listSeasons } from "@/modules/clubs/service";

import { CreateSeasonForm, SeasonRow, type SeasonView } from "./season-forms";

function ymd(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export default async function SeasonsPage() {
  const ctx = await requireRole("CLUB_ADMIN", "MASTER_ADMIN");
  if (!ctx.activeClubId) {
    return <NoClub />;
  }
  const seasons = await listSeasons(ctx, ctx.activeClubId);
  const views: SeasonView[] = seasons.map((s) => ({
    id: s.id,
    name: s.name,
    start: ymd(s.startDate),
    end: ymd(s.endDate),
    status: s.status,
    version: s.updatedAt.toISOString(),
  }));

  return (
    <TwoPane
      title="Seasons"
      description="Define the seasons your teams play in."
      formTitle="New season"
      form={<CreateSeasonForm />}
    >
      <div className="flex flex-col gap-3">
        {views.length === 0 ? (
          <p className="rounded-lg border border-dashed bg-card p-8 text-center text-sm text-muted-foreground">
            No seasons yet. Use the form to add your first season.
          </p>
        ) : (
          views.map((s) => <SeasonRow key={`${s.id}-${s.version}`} season={s} />)
        )}
      </div>
    </TwoPane>
  );
}

function NoClub() {
  return (
    <div className="mx-auto max-w-lg py-16 text-center">
      <h1 className="font-sport text-xl font-bold">No active club</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Your account isn&apos;t scoped to a club yet.
      </p>
    </div>
  );
}
