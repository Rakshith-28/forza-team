import Link from "next/link";
import { ChevronRight, MessagesSquare } from "lucide-react";

import { requireAuthContext } from "@/lib/auth-guards";
import { listChatTeams } from "@/modules/comms/service";

export default async function ChatHomePage() {
  const ctx = await requireAuthContext();
  if (!ctx.activeClubId) {
    return (
      <div className="mx-auto max-w-lg py-16 text-center">
        <h1 className="font-sport text-xl font-bold">No active club</h1>
        <p className="mt-2 text-sm text-muted-foreground">Your account isn&apos;t scoped to a club yet.</p>
      </div>
    );
  }

  const teams = await listChatTeams(ctx);

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="font-display text-2xl uppercase tracking-tight text-foreground wrap-break-word sm:text-3xl">Team Chat</h1>
      <p className="mt-1 text-muted-foreground">Conversations for your teams.</p>

      <div className="mt-6 flex flex-col gap-2.5">
        {teams.length === 0 ? (
          <p className="rounded-xl border border-dashed bg-card p-8 text-center text-sm text-muted-foreground">
            No team conversations available to you yet.
          </p>
        ) : (
          teams.map((t) => (
            <Link
              key={t.id}
              href={`/chat/${t.id}`}
              className="group flex items-center gap-3 rounded-xl border bg-card px-3 py-2.5 shadow-xs ring-1 ring-transparent transition-all hover:border-primary hover:shadow-sm hover:ring-primary/10"
            >
              <span
                aria-hidden
                className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary"
              >
                <MessagesSquare className="size-5" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate font-sport text-sm font-bold text-foreground">{t.name}</p>
                <p className="truncate text-xs text-muted-foreground">Team conversation</p>
              </div>
              <ChevronRight className="size-4 shrink-0 text-muted-foreground transition-colors group-hover:text-primary" aria-hidden />
            </Link>
          ))
        )}
      </div>
    </div>
  );
}
