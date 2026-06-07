import { setActiveRoleAction } from "@/app/(app)/account/role-actions";
import { ROLE_LABELS, type Role } from "@/lib/rbac/roles";
import { cn } from "@/lib/utils";

/**
 * Account-settings control letting a user who holds more than one role in their
 * club (e.g. a coach who is also a parent of a player on the team) switch which
 * role they're acting as. Renders nothing for single-role users. The server
 * action re-validates the choice, so this only ever switches among held roles.
 */
export function RoleSwitcher({ roles, current }: { roles: Role[]; current: Role }) {
  if (roles.length < 2) return null;

  return (
    <section className="rounded-xl border bg-card p-4 shadow-sm">
      <h2 className="font-sport text-base font-bold text-foreground">Active role</h2>
      <p className="mt-0.5 text-sm text-muted-foreground">
        You hold more than one role in this club — switch which one you&apos;re using.
      </p>
      <form action={setActiveRoleAction} className="mt-3 flex flex-wrap gap-2">
        {roles.map((r) => (
          <button
            key={r}
            type="submit"
            name="role"
            value={r}
            disabled={r === current}
            aria-current={r === current ? "true" : undefined}
            className={cn(
              "rounded-md border px-3 py-1.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50",
              r === current
                ? "border-primary bg-primary/10 text-primary"
                : "bg-background hover:border-primary hover:text-primary",
            )}
          >
            {ROLE_LABELS[r]}
            {r === current ? " · current" : ""}
          </button>
        ))}
      </form>
    </section>
  );
}
