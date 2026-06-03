import { NextRequest } from "next/server";

import { getApiContext } from "@/lib/auth-guards";
import { ForbiddenError } from "@/lib/rbac";
import { listMessages, postMessage } from "@/modules/comms/service";
import { postMessageSchema } from "@/modules/comms/schemas";

/**
 * Team chat endpoint. GET lists recent messages (the client polls this);
 * POST sends a message. Both run through the comms service, which enforces
 * team-chat scope. Transport-agnostic so a push layer can replace polling later.
 */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ teamId: string }> }) {
  const { teamId } = await params;
  const ctx = await getApiContext();
  if (!ctx) return new Response("Unauthorized", { status: 401 });
  try {
    const messages = await listMessages(ctx, teamId, { limit: 100 });
    return Response.json({ messages, currentUserId: ctx.userId });
  } catch (error) {
    if (error instanceof ForbiddenError) return new Response("Forbidden", { status: 403 });
    throw error;
  }
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ teamId: string }> }) {
  const { teamId } = await params;
  const ctx = await getApiContext();
  if (!ctx) return new Response("Unauthorized", { status: 401 });

  const json = await req.json().catch(() => null);
  const parsed = postMessageSchema.safeParse(json);
  if (!parsed.success) {
    return Response.json({ error: parsed.error.issues[0]?.message ?? "Invalid input" }, { status: 400 });
  }
  try {
    await postMessage(ctx, teamId, parsed.data);
    return Response.json({ ok: true }, { status: 201 });
  } catch (error) {
    if (error instanceof ForbiddenError) return new Response("Forbidden", { status: 403 });
    throw error;
  }
}
