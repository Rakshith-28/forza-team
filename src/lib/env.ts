import { z } from "zod";

/**
 * Validated server environment.
 *
 * Validation is lazy: it runs the first time a variable is *read*, not at
 * import. That keeps `next build` and `tsc` working without a populated
 * environment (e.g. before Neon is provisioned), while still failing fast at
 * runtime if a required secret is missing. Set `SKIP_ENV_VALIDATION=1` to
 * bypass entirely (used only for tooling).
 *
 * This module is server-only — never import it into a client component.
 */
const serverEnvSchema = z.object({
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),

  // Neon Postgres. Pooled URL for the app, direct URL for migrations.
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
  DIRECT_URL: z.string().min(1, "DIRECT_URL is required"),

  // Better Auth secret (signs sessions/tokens). Required so deploys fail loudly.
  AUTH_SECRET: z.string().min(32, "AUTH_SECRET must be at least 32 characters"),
  // Base URL Better Auth builds links against (reset/invite emails).
  BETTER_AUTH_URL: z.string().min(1).default("http://localhost:3000"),

  // Rate limiting (Upstash). Optional — absent ⇒ auth routes are not limited
  // locally (a warning is logged once). See src/lib/rate-limit.ts.
  UPSTASH_REDIS_REST_URL: z.string().optional(),
  UPSTASH_REDIS_REST_TOKEN: z.string().optional(),

  // Email (Resend). Optional — absent ⇒ emails are logged to the console in
  // dev instead of sent. See src/lib/email.ts.
  RESEND_API_KEY: z.string().optional(),
  EMAIL_FROM: z.string().default("Forza Team <onboarding@resend.dev>"),

  LOG_LEVEL: z.enum(["debug", "info", "warn", "error"]).optional(),
});

export type ServerEnv = z.infer<typeof serverEnvSchema>;

let cached: ServerEnv | null = null;

function parseEnv(): ServerEnv {
  if (process.env.SKIP_ENV_VALIDATION) {
    return process.env as unknown as ServerEnv;
  }

  const parsed = serverEnvSchema.safeParse(process.env);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((i) => `  - ${i.path.join(".") || "(root)"}: ${i.message}`)
      .join("\n");
    throw new Error(`Invalid environment variables:\n${issues}`);
  }
  return parsed.data;
}

/** Memoized, validated env. Accessing any key triggers validation once. */
export const env: ServerEnv = new Proxy({} as ServerEnv, {
  get(_target, key: string) {
    cached ??= parseEnv();
    return cached[key as keyof ServerEnv];
  },
});
