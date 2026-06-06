import { redirect } from "next/navigation";

/**
 * The standalone parent team-roster page has been consolidated into the Squad
 * page, which now renders the roster inline. This route is kept only to redirect
 * old links/bookmarks to Squad with the same child + team preselected.
 */
export default async function LegacyParentRosterRedirect({
  params,
}: {
  params: Promise<{ playerId: string; teamId: string }>;
}) {
  const { playerId, teamId } = await params;
  redirect(`/squad?child=${playerId}&team=${teamId}`);
}
