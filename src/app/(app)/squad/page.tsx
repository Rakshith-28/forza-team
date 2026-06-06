import Link from "next/link";

import { requireRole } from "@/lib/auth-guards";
import { ForbiddenError } from "@/lib/rbac";
import { listLinkedChildren, listSafeTeamRoster } from "@/modules/roster/service";
import type { SafePlayer } from "@/modules/roster/projections";
import { CollectibleCard } from "@/components/app/parent/widgets";

import { ChildEditForm } from "../my-kids/[playerId]/child-edit-client";

/**
 * Squad tab — a single screen showing one linked child's identity card and that
 * child's team roster directly (no intermediate roster page). When the parent
 * has more than one child a switcher appears; when the selected child is on more
 * than one team, team chips appear. Selection is carried in the URL (?child&team)
 * so chips are plain links and the server re-renders the card + roster. The
 * parent-safe projection and privacy note are unchanged. Parent surface only.
 */
export default async function SquadPage({
  searchParams,
}: {
  searchParams: Promise<{ child?: string; team?: string }>;
}) {
  const ctx = await requireRole("PARENT");
  const children = await listLinkedChildren(ctx);
  const sp = await searchParams;

  if (children.length === 0) {
    return (
      <div className="flex flex-col gap-4 pt-2">
        <h1 className="font-display text-2xl uppercase text-foreground">Squad</h1>
        <p className="rounded-2xl border border-dashed bg-card p-8 text-center text-sm text-muted-foreground">
          No children linked yet.
        </p>
      </div>
    );
  }

  // Resolve the selected child + team from the URL, falling back to the first.
  const child = children.find((c) => c.id === sp.child) ?? children[0];
  const team = child.teams.find((t) => t.id === sp.team) ?? child.teams[0] ?? null;

  // Parent-safe roster for the selected team (identical projection + scope check).
  let roster: SafePlayer[] = [];
  if (team) {
    try {
      roster = await listSafeTeamRoster(ctx, team.id);
    } catch (e) {
      if (!(e instanceof ForbiddenError)) throw e;
    }
  }

  return (
    <div className="flex flex-col gap-4 pt-2">
      <h1 className="font-display text-2xl uppercase text-foreground">Squad</h1>

      {/* Child switcher — only when the parent has more than one child. */}
      {children.length > 1 ? (
        <div className="flex flex-wrap gap-2">
          {children.map((c) => {
            const active = c.id === child.id;
            return (
              <Link
                key={c.id}
                href={`/squad?child=${c.id}`}
                aria-current={active ? "true" : undefined}
                className={`app-pill px-3 py-1.5 text-xs font-semibold ${
                  active ? "bg-primary text-primary-foreground" : "bg-card text-foreground"
                }`}
              >
                {c.displayName}
              </Link>
            );
          })}
        </div>
      ) : null}

      {/* Child identity card (jersey, position, name, team) — links to full profile. */}
      <CollectibleCard
        name={child.displayName}
        jerseyNumber={child.jerseyNumber}
        position={child.primaryPosition}
        teamName={team?.name ?? child.teams[0]?.name ?? null}
        photoUrl={child.photoUrl}
        href={`/my-kids/${child.id}`}
      />

      {/* Edit My Child — parent self-service edit on their own child's card. */}
      <ChildEditForm child={child} />

      {/* Team roster, rendered directly on the page. */}
      <div className="flex flex-col gap-2">
        <h2 className="font-display text-xl uppercase tracking-tight text-foreground">Team Roster</h2>

        {team === null ? (
          <p className="rounded-2xl border border-dashed bg-card p-6 text-center text-sm text-muted-foreground">
            Not on any team yet.
          </p>
        ) : (
          <>
            {/* Team chips — only when the child is on more than one team. */}
            {child.teams.length > 1 ? (
              <div className="flex flex-wrap gap-2">
                {child.teams.map((t) => {
                  const active = t.id === team.id;
                  return (
                    <Link
                      key={t.id}
                      href={`/squad?child=${child.id}&team=${t.id}`}
                      aria-current={active ? "true" : undefined}
                      className={`app-pill px-3 py-1.5 text-xs font-semibold ${
                        active ? "bg-primary text-primary-foreground" : "bg-card text-foreground"
                      }`}
                    >
                      {t.name}
                    </Link>
                  );
                })}
              </div>
            ) : null}

            <p className="text-sm text-muted-foreground">
              {team.name} roster. Other families&apos; private details are not shown.
            </p>

            {roster.length === 0 ? (
              <p className="rounded-2xl border border-dashed bg-card p-6 text-center text-sm text-muted-foreground">
                No players on this team yet.
              </p>
            ) : (
              <ul className="flex flex-col gap-2">
                {roster.map((p) => (
                  <li key={p.id} className="flex items-center gap-3 rounded-lg border bg-card p-3">
                    {p.photoUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={p.photoUrl} alt="" className="h-9 w-9 rounded-full object-cover" />
                    ) : (
                      <span className="flex h-9 w-9 items-center justify-center rounded-full bg-secondary text-xs font-bold text-secondary-foreground">
                        {p.displayName.slice(0, 1)}
                      </span>
                    )}
                    <div>
                      <p className="font-medium text-foreground">
                        {p.displayName}
                        {p.jerseyNumber ? <span className="ml-2 text-muted-foreground">#{p.jerseyNumber}</span> : null}
                      </p>
                      {p.primaryPosition ? (
                        <p className="text-xs uppercase tracking-wide text-muted-foreground">{p.primaryPosition}</p>
                      ) : null}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
      </div>
    </div>
  );
}
