import { toNextJsHandler } from "better-auth/next-js";

import { auth } from "@/lib/auth";
import { checkRateLimit } from "@/lib/rate-limit";

// Better Auth mounts all its endpoints (sign-in, sign-out, reset-password, …)
// under /api/auth/*.
const handlers = toNextJsHandler(auth);

export const GET = handlers.GET;

// Sensitive credential endpoints are rate-limited per client IP (Upstash).
// Other auth endpoints pass through untouched.
const RATE_LIMITED = ["/sign-in", "/sign-up", "/forget-password", "/reset-password"];

function clientIp(req: Request): string {
  const fwd = req.headers.get("x-forwarded-for");
  return fwd?.split(",")[0]?.trim() || req.headers.get("x-real-ip") || "unknown";
}

export async function POST(req: Request): Promise<Response> {
  const path = new URL(req.url).pathname;
  if (RATE_LIMITED.some((p) => path.includes(p))) {
    const allowed = await checkRateLimit(`${clientIp(req)}:${path}`);
    if (!allowed) {
      return Response.json(
        { error: "Too many requests. Please try again in a minute." },
        { status: 429 },
      );
    }
  }
  return handlers.POST(req);
}
