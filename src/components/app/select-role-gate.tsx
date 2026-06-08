import { setActiveIdentityAction } from "@/app/(app)/identity-actions";
import type { Identity } from "@/modules/identity/identities";

/**
 * Post-login "Select role" gate (TeamSnap-style): a modal card floating over a
 * blurred view of the dashboard the user would land on. Rendered by the app
 * shell — on top of the real (default) dashboard — whenever the user holds 2+
 * identities and hasn't chosen one this session, so the background is a live,
 * blurred render of their role rather than an empty page. Each row submits the
 * re-validated `setActiveIdentityAction`.
 */
export function SelectRoleGate({ identities }: { identities: Identity[] }) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Select role"
      className="fixed inset-0 z-70 flex items-center justify-center overflow-y-auto bg-background/30 p-4 backdrop-blur-md"
    >
      <div className="w-full max-w-md overflow-hidden rounded-2xl border bg-card shadow-2xl">
        <div className="h-1.5 w-full bg-linear-to-r from-primary via-primary/70 to-primary/40" />
        <div className="p-6">
          <h1 className="font-sport text-2xl font-bold tracking-tight text-foreground">Select role</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            You hold more than one role. Choose who you&apos;d like to continue as — you can switch
            anytime from the top bar.
          </p>

          <ul className="mt-5 flex flex-col gap-2">
            {identities.map((i) => {
              const sub = [i.roleLabel, i.clubName].filter(Boolean).join(" · ");
              return (
                <li key={i.key}>
                  <form action={setActiveIdentityAction}>
                    <input type="hidden" name="identity" value={i.key} />
                    <button
                      type="submit"
                      className="flex w-full items-center gap-3 rounded-xl border bg-background px-4 py-3 text-left transition-colors hover:border-primary hover:bg-secondary focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
                    >
                      <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary text-base font-bold text-primary-foreground">
                        {i.roleLabel.trim().slice(0, 1).toUpperCase() || "•"}
                      </span>
                      <span className="flex min-w-0 flex-col leading-tight">
                        <span className="truncate text-base font-semibold text-foreground">
                          {i.contextLabel}
                        </span>
                        <span className="truncate text-sm text-muted-foreground">{sub}</span>
                      </span>
                    </button>
                  </form>
                </li>
              );
            })}
          </ul>
        </div>
      </div>
    </div>
  );
}
