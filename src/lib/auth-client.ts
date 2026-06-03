"use client";

import { createAuthClient } from "better-auth/react";

/**
 * Browser-side Better Auth client. Base URL defaults to the current origin.
 * Sign-up is intentionally NOT exposed to the client — accounts are created
 * only through the server-side invitation-acceptance flow.
 */
export const authClient = createAuthClient();

export const { signIn, signOut, useSession, requestPasswordReset, resetPassword } =
  authClient;
