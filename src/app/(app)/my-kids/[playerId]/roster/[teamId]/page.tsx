import { redirect } from "next/navigation";

/**
 * The standalone player team-roster page has been consolidated into the Squad
 * page, which now renders the roster inline. This route is kept only to redirect
 * old links/bookmarks to Squad with the same child + team preselected.
 */
export default async function LegacyPlayerRosterRedirect({
  params,
}: {
  params: Promise<{ playerId: string; teamId: string }>;
}) {
  const { playerId, teamId } = await params;
  redirect(`/squad?child=${playerId}&team=${teamId}`);
}
