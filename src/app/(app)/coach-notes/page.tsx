import { requireRole } from "@/lib/auth-guards";
import { listMyChildRemarks } from "@/modules/remarks/service";

/**
 * Parent "Coach Notes" — the private, one-way remarks a coach has shared about
 * the parent's own linked children, grouped per child (newest first). This is
 * where a bell remark notification deep-links. Read-only; parent-safe by
 * construction (the service restricts to the parent's linked, shared remarks).
 */
export default async function CoachNotesPage() {
  const ctx = await requireRole("PARENT");
  const groups = await listMyChildRemarks(ctx);

  return (
    <div className="flex flex-col gap-4 pt-2">
      <h1 className="font-display text-2xl uppercase text-foreground">Coach Notes</h1>

      {groups.length === 0 ? (
        <p className="rounded-2xl border border-dashed bg-card p-8 text-center text-sm text-muted-foreground">
          No notes from your coach yet. When a coach shares a note about your child, it&apos;ll appear here.
        </p>
      ) : (
        groups.map((g) => (
          <section key={g.playerId} className="flex flex-col gap-2">
            <h2 className="font-display text-lg uppercase tracking-tight text-foreground">{g.childName}</h2>
            <ul className="flex flex-col gap-2">
              {g.remarks.map((r) => (
                <li key={r.id} className="rounded-2xl border bg-card p-4">
                  <p className="whitespace-pre-wrap text-sm text-foreground">{r.body}</p>
                  <p className="mt-2 text-[11px] text-muted-foreground">
                    {new Date(r.createdAt).toLocaleDateString(undefined, {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                    })}
                  </p>
                </li>
              ))}
            </ul>
          </section>
        ))
      )}
    </div>
  );
}
