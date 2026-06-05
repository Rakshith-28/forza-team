import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { nextCookies } from "better-auth/next-js";

import { prisma } from "@/db/client";
import { env } from "@/lib/env";
import { passwordResetEmail, sendEmail } from "@/lib/email";

/**
 * Better Auth — AUTHENTICATION ONLY (identity, sessions, password).
 *
 * Tenancy and RBAC are NOT handled here: we deliberately do not use the
 * organization plugin. Club membership + the four scope-aware roles live in our
 * own `clubs` + `user_role_assignments` tables (see @docs/BUILD_PLAN.md §2 and
 * src/lib/rbac). Better Auth's `user` model is mapped onto our existing `users`
 * table; the credential password is stored in the `accounts` table.
 */
export const auth = betterAuth({
  baseURL: env.BETTER_AUTH_URL,
  secret: env.AUTH_SECRET,
  // In development `next dev` falls back to another port (3001/3002) when 3000 is
  // busy; the browser's Origin would then fail Better Auth's check ("Invalid
  // origin"). Trust the common localhost dev ports so sign-in works regardless of
  // which one the dev server picks. Production relies on baseURL only.
  ...(env.NODE_ENV === "development"
    ? {
        trustedOrigins: [
          "http://localhost:3000",
          "http://localhost:3001",
          "http://localhost:3002",
          "http://127.0.0.1:3000",
          "http://127.0.0.1:3001",
          "http://127.0.0.1:3002",
        ],
      }
    : {}),
  database: prismaAdapter(prisma, { provider: "postgresql" }),

  // Generate UUIDs so ids fit our `@db.Uuid` columns.
  advanced: { database: { generateId: "uuid" } },

  emailAndPassword: {
    enabled: true,
    // MVP: no email-verification gate (invitations already prove the address).
    requireEmailVerification: false,
    revokeSessionsOnPasswordReset: true,
    sendResetPassword: async ({ user, url }) => {
      const { subject, html, text } = passwordResetEmail({ url });
      await sendEmail({ to: user.email, subject, html, text });
    },
  },

  // Map Better Auth's user model onto our `users` table. `name`/`image` are
  // Better Auth's own columns; first/last name are domain fields we manage.
  user: {
    fields: { emailVerified: "isEmailVerified" },
    additionalFields: {
      firstName: { type: "string", required: true, input: true },
      lastName: { type: "string", required: true, input: true },
      phone: { type: "string", required: false, input: true },
      status: { type: "string", required: false, input: false },
    },
  },

  // Carry the active club (tenant context) on the session.
  session: {
    additionalFields: {
      activeClubId: { type: "string", required: false, input: false },
    },
  },

  // Must be last: writes Set-Cookie headers from Server Actions / route handlers.
  plugins: [nextCookies()],
});

export type Auth = typeof auth;
export type Session = Auth["$Infer"]["Session"];
