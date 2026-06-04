/**
 * Bootstrap a Master Admin by creating a MASTER_ADMIN invitation and printing the
 * accept-invite URL (the first admin can't be emailed — open the link directly).
 *
 * Env-driven (NO hardcoded URLs): reads DIRECT_URL/DATABASE_URL + BETTER_AUTH_URL
 * from the environment. Provide them yourself, e.g.:
 *   vercel env pull .env.production.local
 *   node --env-file=.env.production.local scripts/bootstrap-master.mjs you@example.com
 * The email may be passed as argv[1] or via MASTER_EMAIL.
 *
 * Idempotent + safe: if the email is already a Master Admin it reports and exits;
 * the invitation insert runs in a transaction. The user + MASTER_ADMIN role
 * assignment are created when you OPEN the printed link and set a password.
 */
import crypto from "node:crypto";
import pg from "pg";

const email = (process.argv[2] ?? process.env.MASTER_EMAIL ?? "").trim().toLowerCase();
const connectionString = process.env.DIRECT_URL ?? process.env.DATABASE_URL;
const baseUrl = process.env.BETTER_AUTH_URL;

if (!connectionString) throw new Error("DIRECT_URL/DATABASE_URL not set (pull prod env first).");
if (!email || !email.includes("@")) throw new Error("Provide an email: node ... bootstrap-master.mjs you@example.com");
if (!baseUrl) throw new Error("BETTER_AUTH_URL not set — the accept link must point at the live app.");

const client = new pg.Client({ connectionString });
await client.connect();
try {
  console.log(`• Target DB: ${new URL(connectionString).host}`);
  console.log(`• Accept links will use: ${baseUrl}\n`);

  const role = await client.query(`SELECT id FROM roles WHERE code = 'MASTER_ADMIN'`);
  if (role.rows.length === 0) {
    throw new Error("MASTER_ADMIN role is missing — run the role seed first (NODE_ENV=production npm run db:seed).");
  }

  const existingMaster = await client.query(
    `SELECT 1 FROM users u
     JOIN user_role_assignments ura ON ura.user_id = u.id AND ura.status = 'ACTIVE'
     JOIN roles r ON r.id = ura.role_id AND r.code = 'MASTER_ADMIN'
     WHERE u.email = $1`,
    [email],
  );
  if (existingMaster.rows.length > 0) {
    console.log(`✓ ${email} is already an active Master Admin — nothing to do (use "Forgot password" to sign in).`);
    process.exit(0);
  }

  const userExists = await client.query(`SELECT 1 FROM users WHERE email = $1`, [email]);
  if (userExists.rows.length > 0) {
    throw new Error(
      `A user with ${email} already exists but is not a Master Admin. ` +
        `Grant the role with an INSERT into user_role_assignments instead of an invite, or use a different email.`,
    );
  }

  const token = crypto.randomBytes(32).toString("base64url");
  const tokenHash = crypto.createHash("sha256").update(token).digest("hex");
  const expiresAt = new Date(Date.now() + 72 * 3600 * 1000);

  const id = await client.query(
    `WITH ins AS (
       INSERT INTO invitations (club_id, email, role_code, token_hash, expires_at, status)
       VALUES (NULL, $1, 'MASTER_ADMIN', $2, $3, 'PENDING') RETURNING id
     ) SELECT id FROM ins`,
    [email, tokenHash, expiresAt],
  );

  const url = `${baseUrl.replace(/\/$/, "")}/accept-invite?id=${id.rows[0].id}&token=${token}`;
  console.log(`✓ Master Admin invitation created for ${email} (system-scoped, club_id NULL).`);
  console.log(`\nACCEPT LINK (open in a browser, set a password):\n${url}\n`);
  console.log("After you accept, the user + MASTER_ADMIN role assignment exist; verify with:");
  console.log(`  SELECT u.email FROM users u JOIN user_role_assignments ura ON ura.user_id=u.id`);
  console.log(`  JOIN roles r ON r.id=ura.role_id AND r.code='MASTER_ADMIN' WHERE u.email='${email}';`);
} finally {
  await client.end();
}
