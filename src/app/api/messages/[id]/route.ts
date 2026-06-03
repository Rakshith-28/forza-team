import { NextRequest } from "next/server";

import { getApiContext } from "@/lib/auth-guards";
import { ForbiddenError } from "@/lib/rbac";
import { deleteMessage } from "@/modules/comms/service";

/** Delete a chat message (own message within the grace window, or a moderator). */
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await getApiContext();
  if (!ctx) return new Response("Unauthorized", { status: 401 });
  try {
    await deleteMessage(ctx, id);
    return Response.json({ ok: true });
  } catch (error) {
    if (error instanceof ForbiddenError) return new Response("Forbidden", { status: 403 });
    throw error;
  }
}
