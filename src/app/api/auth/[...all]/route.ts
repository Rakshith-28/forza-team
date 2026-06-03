import { toNextJsHandler } from "better-auth/next-js";

import { auth } from "@/lib/auth";

// Better Auth mounts all its endpoints (sign-in, sign-out, reset-password, …)
// under /api/auth/*. Rate limiting is layered on in middleware (see middleware.ts).
export const { GET, POST } = toNextJsHandler(auth);
