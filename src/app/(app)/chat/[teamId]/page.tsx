import Link from "next/link";
import { notFound } from "next/navigation";

import { requireAuthContext } from "@/lib/auth-guards";
import { can } from "@/lib/rbac";
import { getTeam } from "@/modules/clubs/service";

import { ChatThread } from "./chat-thread";

export default async function TeamChatPage({ params }: { params: Promise<{ teamId: string }> }) {
  const { teamId } = await params;
  const ctx = await requireAuthContext();

  // getTeam asserts teams.view scope (coach=assigned, player=child team, admin=club).
  const team = await getTeam(ctx, teamId);
  if (!team) notFound();

  const canModerate = can(ctx, "chat.moderate_team", { clubId: team.clubId, teamId });

  return (
    <div className="mx-auto max-w-2xl">
      <Link href="/chat" className="text-sm text-muted-foreground underline-offset-4 hover:underline">
        ← All conversations
      </Link>
      <h1 className="mt-3 font-display text-2xl uppercase tracking-tight text-foreground wrap-break-word sm:text-3xl">{team.name}</h1>
      <p className="mb-4 mt-1 text-sm text-muted-foreground">Team conversation</p>

      <ChatThread teamId={teamId} currentUserId={ctx.userId} canModerate={canModerate} />
    </div>
  );
}
