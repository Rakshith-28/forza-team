import crypto from "node:crypto";

import pg from "pg";

// Standalone seed: self-contained (raw pg + process.env) so it doesn't depend
// on the app's `@/` path aliases. Run with `npm run db:seed`.
//
// Seeds: the four roles (required for auth/RBAC to function), a demo club, and
// a pending CLUB_ADMIN invitation — then prints the accept-invite URL so the
// full invite → sign-in → dashboard flow can be exercised end-to-end.

try {
  process.loadEnvFile();
} catch {
  // env already in the environment (CI / prisma config)
}

const { Client } = pg;

const ROLES: Array<[string, string, string]> = [
  ["MASTER_ADMIN", "Master Admin", "System-wide administrator across all clubs"],
  ["CLUB_ADMIN", "Club Admin", "Administrator of a single club"],
  ["COACH", "Coach", "Operational access to assigned teams"],
  ["PARENT", "Parent / Guardian", "Access to linked children"],
];

const DEMO_CLUB = { name: "Demo FC", shortCode: "DEMO" };
const DEMO_INVITE_EMAIL = "club-admin@demo.test";
const BASE_URL = process.env.BETTER_AUTH_URL ?? "http://localhost:3000";

async function main() {
  const connectionString = process.env.DIRECT_URL ?? process.env.DATABASE_URL;
  if (!connectionString) throw new Error("DIRECT_URL/DATABASE_URL not set");

  const client = new Client({ connectionString });
  await client.connect();
  try {
    for (const [code, name, description] of ROLES) {
      await client.query(
        `INSERT INTO roles (code, name, description) VALUES ($1, $2, $3)
         ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name, description = EXCLUDED.description`,
        [code, name, description],
      );
    }
    console.log(`✓ seeded ${ROLES.length} roles`);

    const club = await client.query<{ id: string }>(
      `INSERT INTO clubs (name, short_code) VALUES ($1, $2)
       ON CONFLICT (short_code) DO UPDATE SET name = EXCLUDED.name
       RETURNING id`,
      [DEMO_CLUB.name, DEMO_CLUB.shortCode],
    );
    const clubId = club.rows[0].id;
    console.log(`✓ demo club "${DEMO_CLUB.name}" (${clubId})`);

    // Reuse an existing pending invite if present; otherwise mint a new token.
    const existing = await client.query<{ id: string }>(
      `SELECT id FROM invitations WHERE club_id = $1 AND email = $2 AND status = 'PENDING'`,
      [clubId, DEMO_INVITE_EMAIL],
    );
    if (existing.rows.length > 0) {
      console.log(
        `• a pending CLUB_ADMIN invite for ${DEMO_INVITE_EMAIL} already exists ` +
          `(its token isn't recoverable — delete it to mint a fresh link)`,
      );
      return;
    }

    const token = crypto.randomBytes(32).toString("base64url");
    const tokenHash = crypto.createHash("sha256").update(token).digest("hex");
    const expiresAt = new Date(Date.now() + 72 * 3600 * 1000);
    const invite = await client.query<{ id: string }>(
      `INSERT INTO invitations (club_id, email, role_code, token_hash, expires_at, status)
       VALUES ($1, $2, 'CLUB_ADMIN', $3, $4, 'PENDING') RETURNING id`,
      [clubId, DEMO_INVITE_EMAIL, tokenHash, expiresAt],
    );

    const url = `${BASE_URL}/accept-invite?id=${invite.rows[0].id}&token=${token}`;
    console.log(`✓ demo CLUB_ADMIN invitation for ${DEMO_INVITE_EMAIL}`);
    console.log(`\n  Accept it (sets password, signs in, lands on the club dashboard):\n  ${url}\n`);
  } finally {
    await client.end();
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
