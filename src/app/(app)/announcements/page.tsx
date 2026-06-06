import { PageHeader, TwoPane } from "@/components/console";
import { requireAuthContext } from "@/lib/auth-guards";
import { can } from "@/lib/rbac";
import { listTeams } from "@/modules/clubs/service";
import { archiveAnnouncementAction, publishAnnouncementAction } from "@/modules/comms/actions";
import { listAnnouncements } from "@/modules/comms/service";
import { ANNOUNCEMENT_AUDIENCE_LABELS, type AnnouncementAudience } from "@/modules/comms/schemas";

import { StatusBadge } from "../seasons/season-forms";
import { CreateAnnouncementForm } from "./announcement-forms";

export default async function AnnouncementsPage() {
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
  const canPublishTeam = can(ctx, "announcements.publish_team", { clubId });
  const canPublishClub = can(ctx, "announcements.publish_club", { clubId });
  const canManage = canPublishTeam || canPublishClub;

  const [announcements, teams] = await Promise.all([
    listAnnouncements(ctx, clubId),
    canManage ? listTeams(ctx, clubId) : Promise.resolve([]),
  ]);
  const teamOptions = teams.filter((t) => t.status !== "ARCHIVED").map((t) => ({ id: t.id, name: t.name }));

  const list = (
    <div className="flex flex-col gap-3">
      {announcements.length === 0 ? (
        <p className="rounded-lg border border-dashed bg-card p-8 text-center text-sm text-muted-foreground">
          Nothing here yet.
        </p>
      ) : (
        announcements.map((a) => (
          <article key={a.id} className="rounded-lg border bg-card p-4">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <h2 className="font-sport text-base font-bold text-foreground">{a.title}</h2>
                <p className="text-xs uppercase tracking-wide text-muted-foreground">
                  {ANNOUNCEMENT_AUDIENCE_LABELS[a.audienceType as AnnouncementAudience] ?? a.audienceType}
                  {a.team ? ` · ${a.team.name}` : ""}
                  {a.publishedAt ? ` · ${a.publishedAt.toISOString().slice(0, 10)}` : ""}
                </p>
              </div>
              <StatusBadge status={a.status} />
            </div>
            <p className="mt-2 whitespace-pre-wrap text-sm text-foreground">{a.body}</p>

            {canManage && a.status !== "ARCHIVED" ? (
              <div className="mt-3 flex gap-3 border-t pt-3">
                {a.status === "DRAFT" ? (
                  <form action={publishAnnouncementAction}>
                    <input type="hidden" name="id" value={a.id} />
                    <button type="submit" className="text-sm font-medium text-primary hover:underline">
                      Publish
                    </button>
                  </form>
                ) : null}
                <form action={archiveAnnouncementAction}>
                  <input type="hidden" name="id" value={a.id} />
                  <button type="submit" className="text-sm font-medium text-muted-foreground hover:text-destructive">
                    Archive
                  </button>
                </form>
              </div>
            ) : null}
          </article>
        ))
      )}
    </div>
  );

  if (!canManage) {
    return (
      <div className="mx-auto max-w-3xl">
        <PageHeader title="Announcements" description="Updates from your club and teams." />
        <div className="mt-6">{list}</div>
      </div>
    );
  }

  return (
    <TwoPane
      title="Announcements"
      description="Post and publish updates for your club and teams."
      formTitle="New announcement"
      form={<CreateAnnouncementForm teams={teamOptions} canClubWide={canPublishClub} />}
    >
      {list}
    </TwoPane>
  );
}
