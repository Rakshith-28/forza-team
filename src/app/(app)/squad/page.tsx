import Link from "next/link";

import { requireRole } from "@/lib/auth-guards";
import { listLinkedChildren } from "@/modules/roster/service";
import { CollectibleCard } from "@/components/app/parent/widgets";

/**
 * Squad tab — the parent's linked children as collectible cards, each linking to
 * the child profile (and from there the safe team roster). Player/parent surface
 * only; themed via the shell.
 */
export default async function SquadPage() {
  const ctx = await requireRole("PARENT");
  const children = await listLinkedChildren(ctx);

  return (
    <div className="flex flex-col gap-4 pt-2">
      <h1 className="font-display text-2xl uppercase text-foreground">Squad</h1>

      {children.length === 0 ? (
        <p className="rounded-2xl border border-dashed bg-card p-8 text-center text-sm text-muted-foreground">
          No children linked yet.
        </p>
      ) : (
        children.map((c) => (
          <div key={c.id} className="flex flex-col gap-2">
            <CollectibleCard
              name={c.displayName}
              jerseyNumber={c.jerseyNumber}
              position={c.primaryPosition}
              teamName={c.teams[0]?.name ?? null}
              photoUrl={c.photoUrl}
              href={`/my-kids/${c.id}`}
            />
            {c.teams.length > 0 ? (
              <div className="flex flex-wrap gap-2 px-1">
                {c.teams.map((t) => (
                  <Link
                    key={t.id}
                    href={`/my-kids/${c.id}/roster/${t.id}`}
                    className="app-pill bg-card px-3 py-1.5 text-xs font-semibold text-foreground"
                  >
                    {t.name} roster
                  </Link>
                ))}
              </div>
            ) : null}
          </div>
        ))
      )}
    </div>
  );
}
