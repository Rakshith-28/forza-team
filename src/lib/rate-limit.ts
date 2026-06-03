import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

import { env } from "@/lib/env";
import { logger } from "@/lib/logger";

/**
 * Auth-route rate limiting via Upstash Redis.
 *
 * Degrades gracefully: if UPSTASH_REDIS_REST_URL/TOKEN are absent (e.g. local
 * dev), every check passes and a one-time warning is logged — so local auth is
 * never blocked. In production with Upstash configured, sensitive auth
 * endpoints are limited per client IP.
 */
let limiter: Ratelimit | null = null;
let resolved = false;
let warned = false;

function getLimiter(): Ratelimit | null {
  if (resolved) return limiter;
  resolved = true;

  if (!env.UPSTASH_REDIS_REST_URL || !env.UPSTASH_REDIS_REST_TOKEN) {
    if (!warned) {
      logger.warn("Upstash not configured — auth routes are NOT rate-limited (dev fallback)");
      warned = true;
    }
    return null;
  }

  limiter = new Ratelimit({
    redis: new Redis({
      url: env.UPSTASH_REDIS_REST_URL,
      token: env.UPSTASH_REDIS_REST_TOKEN,
    }),
    limiter: Ratelimit.slidingWindow(10, "60 s"),
    prefix: "forza:auth",
    analytics: false,
  });
  return limiter;
}

/** Returns false when the caller has exceeded the limit. No-op (true) if unconfigured. */
export async function checkRateLimit(identifier: string): Promise<boolean> {
  const l = getLimiter();
  if (!l) return true;
  try {
    const { success } = await l.limit(identifier);
    return success;
  } catch (error) {
    // Never let a rate-limit backend outage lock users out.
    logger.error("rate limit check failed — allowing request", { error });
    return true;
  }
}
