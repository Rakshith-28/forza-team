import { AlertTriangle, Megaphone, Pin } from "lucide-react";

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

  const list =
    announcements.length === 0 ? (
      <p className="rounded-xl border border-dashed bg-card p-8 text-center text-sm text-muted-foreground">
        Nothing here yet.
      </p>
    ) : (
      <div className="overflow-hidden rounded-xl border border-muted-foreground/25 bg-transparent shadow-[inset_0_2px_5px_rgba(0,0,0,0.12),inset_0_-1px_2px_rgba(255,255,255,0.6)]">
        <div className="max-h-[calc(100vh-15rem)] overflow-y-auto p-3 sm:p-4">
          <div className="flex flex-col gap-2.5">
            {announcements.map((a) => (
              <article
                key={a.id}
                className="group rounded-xl border bg-card px-3 py-2.5 shadow-xs ring-1 ring-transparent transition-all hover:border-primary hover:shadow-sm hover:ring-primary/10"
              >
                <div className="flex items-start gap-3">
                  {/* Leading icon — amber when flagged important. */}
                  <span
                    aria-hidden
                    className={`flex size-9 shrink-0 items-center justify-center rounded-full ${
                      a.important ? "bg-destructive/10 text-destructive" : "bg-primary/10 text-primary"
                    }`}
                  >
                    <Megaphone className="size-4.5" />
                  </span>

                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <h2 className="truncate font-sport text-sm font-bold text-foreground">{a.title}</h2>
                      {a.pinned ? <Pin className="size-3.5 text-primary" aria-label="Pinned" /> : null}
                      {a.important ? (
                        <span className="inline-flex items-center gap-1 rounded-md bg-destructive/10 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-destructive ring-1 ring-inset ring-destructive/20">
                          <AlertTriangle className="size-3" aria-hidden /> Important
                        </span>
                      ) : null}
                    </div>
                    <p className="truncate text-[11px] uppercase tracking-wide text-muted-foreground">
                      {ANNOUNCEMENT_AUDIENCE_LABELS[a.audienceType as AnnouncementAudience] ?? a.audienceType}
                      {a.team ? ` · ${a.team.name}` : ""}
                      {a.publishedAt ? ` · ${a.publishedAt.toISOString().slice(0, 10)}` : ""}
                    </p>
                    <p className="mt-1 line-clamp-2 whitespace-pre-wrap text-sm text-foreground/80">{a.body}</p>
                  </div>

                  <StatusBadge status={a.status} />
                </div>

                {canManage && a.status !== "ARCHIVED" ? (
                  <div className="mt-2 flex gap-3 border-t pt-2 pl-12">
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
            ))}
          </div>
        </div>
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
