import { NextRequest } from "next/server";

import { getSession } from "@/lib/auth-guards";
import { ForbiddenError } from "@/lib/rbac";
import { getFileForDownload } from "@/modules/files/service";
import { loadAuthContext, resolveActiveClubId } from "@/modules/identity/context";

/**
 * Permission-checked file proxy. Storage keys are never exposed; every request
 * re-runs the scope check in getFileForDownload (club / team-chat / linked-child
 * + the show_player_photos_to_parents setting) before any bytes are streamed.
 */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const session = await getSession();
  if (!session) return new Response("Unauthorized", { status: 401 });

  const activeClubId = session.session.activeClubId ?? (await resolveActiveClubId(session.user.id));
  const ctx = await loadAuthContext(session.user.id, activeClubId);
  if (!ctx) return new Response("Forbidden", { status: 403 });

  try {
    const file = await getFileForDownload(ctx, id);
    if (!file) return new Response("Not found", { status: 404 });
    const body = new Uint8Array(file.bytes);
    return new Response(body, {
      status: 200,
      headers: {
        "Content-Type": file.mimeType,
        "Content-Disposition": `inline; filename="${encodeURIComponent(file.originalName)}"`,
        "Cache-Control": "private, max-age=300",
      },
    });
  } catch (error) {
    if (error instanceof ForbiddenError) return new Response("Forbidden", { status: 403 });
    throw error;
  }
}
