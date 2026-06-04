/**
 * Create a fresh set of directly-loginable TEST accounts (one per role) plus the
 * minimal scaffolding so each login is immediately useful. Passwords are set via
 * Better Auth's real signup endpoint (valid credentials — no forged hashes), then
 * roles / club / team / player links are granted in SQL.
 *
 * Env-driven (NO hardcoded URLs/creds):
 *   - BETTER_AUTH_URL : base URL of the running app (signups POST here). For the
 *                       live site this is your deployment URL.
 *   - DIRECT_URL / DATABASE_URL : the DB to grant roles/scaffolding in.
 *   - TEST_PASSWORD   : optional, default "Test1234!".
 *
 *   vercel env pull .env.production.local --environment=production
 *   node --env-file=.env.production.local scripts/seed-test-accounts.mjs
 *
 * Idempotent: re-running reuses existing users/club/team/players. Everything it
 * creates is namespaced (club short_code TESTCLUB, emails @test.local) so it's
 * easy to identify and remove later.
 */
import pg from "pg";

const BASE = (process.env.BETTER_AUTH_URL ?? "").replace(/\/$/, "");
const connectionString = process.env.DIRECT_URL ?? process.env.DATABASE_URL;
const PASSWORD = process.env.TEST_PASSWORD ?? "Test1234!";
if (!BASE) throw new Error("BETTER_AUTH_URL not set — needed to call the signup endpoint of the running app.");
if (!connectionString) throw new Error("DIRECT_URL/DATABASE_URL not set.");

const ACCOUNTS = [
  { email: "masteradmin@test.local", first: "Test", last: "Master", role: "MASTER_ADMIN" },
  { email: "clubmanager@test.local", first: "Test", last: "Manager", role: "CLUB_ADMIN" },
  { email: "coach@test.local", first: "Test", last: "Coach", role: "COACH" },
  { email: "parent1@test.local", first: "Test", last: "ParentOne", role: "PARENT" },
  { email: "parent2@test.local", first: "Test", last: "ParentTwo", role: "PARENT" },
];

/** Create a user via Better Auth signup; returns its id (reuses an existing one). */
async function signUp(client, a) {
  const res = await fetch(`${BASE}/api/auth/sign-up/email`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Origin: BASE },
    body: JSON.stringify({
      email: a.email,
      password: PASSWORD,
      name: `${a.first} ${a.last}`,
      firstName: a.first,
      lastName: a.last,
    }),
  });
  if (res.ok) {
    const data = await res.json().catch(() => ({}));
    if (data?.user?.id) return data.user.id;
  }
  // Already exists (or response didn't carry the id) — look it up.
  const row = await client.query(`SELECT id FROM users WHERE email = $1`, [a.email]);
  if (row.rows.length) return row.rows[0].id;
  const body = await res.text().catch(() => "");
  throw new Error(`Signup failed for ${a.email} (HTTP ${res.status}): ${body.slice(0, 200)}`);
}

const client = new pg.Client({ connectionString });
await client.connect();
try {
  console.log(`• App (signup):  ${BASE}`);
  console.log(`• Target DB:     ${new URL(connectionString).host}`);
  console.log(`• Password:      ${PASSWORD}\n`);

  // Roles must exist.
  for (const [code, name] of [
    ["MASTER_ADMIN", "Master Admin"],
    ["CLUB_ADMIN", "Club Manager"],
    ["COACH", "Coach"],
    ["PARENT", "Parent / Guardian"],
  ]) {
    await client.query(
      `INSERT INTO roles (code, name) VALUES ($1, $2) ON CONFLICT (code) DO NOTHING`,
      [code, name],
    );
  }
  const roleId = async (code) => (await client.query(`SELECT id FROM roles WHERE code = $1`, [code])).rows[0].id;

  // 1) Create all users (valid passwords via signup).
  const userId = {};
  for (const a of ACCOUNTS) {
    userId[a.email] = await signUp(client, a);
    console.log(`✓ user ${a.email}`);
  }

  // 2) Test club + settings + team + 2 players.
  const club = await client.query(
    `INSERT INTO clubs (name, short_code) VALUES ('Test Club', 'TESTCLUB')
     ON CONFLICT (short_code) DO UPDATE SET name = EXCLUDED.name RETURNING id`,
  );
  const clubId = club.rows[0].id;
  await client.query(`INSERT INTO club_settings (club_id) VALUES ($1) ON CONFLICT (club_id) DO NOTHING`, [clubId]);

  let team = await client.query(`SELECT id FROM teams WHERE club_id = $1 AND team_code = 'TEST1'`, [clubId]);
  if (team.rows.length === 0) {
    team = await client.query(
      `INSERT INTO teams (club_id, name, team_code, age_group) VALUES ($1, 'Test Team', 'TEST1', 'U12') RETURNING id`,
      [clubId],
    );
  }
  const teamId = team.rows[0].id;

  async function ensurePlayer(first, last) {
    const found = await client.query(
      `SELECT id FROM players WHERE club_id = $1 AND first_name = $2 AND last_name = $3 AND deleted_at IS NULL`,
      [clubId, first, last],
    );
    let pid = found.rows[0]?.id;
    if (!pid) {
      pid = (
        await client.query(
          `INSERT INTO players (club_id, first_name, last_name, primary_position, jersey_number)
           VALUES ($1, $2, $3, 'MID', '10') RETURNING id`,
          [clubId, first, last],
        )
      ).rows[0].id;
      await client.query(
        `INSERT INTO player_team_memberships (club_id, player_id, team_id, status) VALUES ($1, $2, $3, 'ACTIVE')`,
        [clubId, pid, teamId],
      );
    }
    return pid;
  }
  const player1 = await ensurePlayer("Player", "One");
  const player2 = await ensurePlayer("Player", "Two");

  // 3) Role assignments (idempotent).
  async function ensureAssignment(uid, code, club, teamIdOrNull) {
    const exists = await client.query(
      `SELECT 1 FROM user_role_assignments ura JOIN roles r ON r.id = ura.role_id
       WHERE ura.user_id = $1 AND r.code = $2 AND ura.club_id IS NOT DISTINCT FROM $3 AND ura.status = 'ACTIVE'`,
      [uid, code, club],
    );
    if (exists.rows.length === 0) {
      await client.query(
        `INSERT INTO user_role_assignments (user_id, role_id, club_id, team_id, is_primary, status)
         VALUES ($1, $2, $3, $4, true, 'ACTIVE')`,
        [uid, await roleId(code), club, teamIdOrNull],
      );
    }
  }
  await ensureAssignment(userId["masteradmin@test.local"], "MASTER_ADMIN", null, null);
  await ensureAssignment(userId["clubmanager@test.local"], "CLUB_ADMIN", clubId, null);
  await ensureAssignment(userId["coach@test.local"], "COACH", clubId, null);
  await ensureAssignment(userId["parent1@test.local"], "PARENT", clubId, null);
  await ensureAssignment(userId["parent2@test.local"], "PARENT", clubId, null);

  // 4) Coach → team; parents → parent profile + link to a player.
  await client.query(
    `INSERT INTO team_coaches (club_id, team_id, user_id, role_type, status)
     VALUES ($1, $2, $3, 'HEAD_COACH', 'ACTIVE') ON CONFLICT (team_id, user_id) DO NOTHING`,
    [clubId, teamId, userId["coach@test.local"]],
  );

  async function ensureParentLink(uid, first, last, email, playerId) {
    const p = await client.query(
      `INSERT INTO parents (club_id, user_id, first_name, last_name, email)
       VALUES ($1, $2, $3, $4, $5) ON CONFLICT (club_id, user_id) DO UPDATE SET first_name = EXCLUDED.first_name
       RETURNING id`,
      [clubId, uid, first, last, email],
    );
    await client.query(
      `INSERT INTO player_parent_links (club_id, player_id, parent_id, relationship_type, status)
       VALUES ($1, $2, $3, 'GUARDIAN', 'ACTIVE') ON CONFLICT (player_id, parent_id) DO NOTHING`,
      [clubId, playerId, p.rows[0].id],
    );
  }
  await ensureParentLink(userId["parent1@test.local"], "Test", "ParentOne", "parent1@test.local", player1);
  await ensureParentLink(userId["parent2@test.local"], "Test", "ParentTwo", "parent2@test.local", player2);

  console.log(`\n✓ Done. Test Club + team + 2 players ready; all accounts wired.\n`);
  console.log("LOGINS (email / password):");
  for (const a of ACCOUNTS) console.log(`  ${a.role.padEnd(12)}  ${a.email}  /  ${PASSWORD}`);
  console.log(`\nParent-safe roster check: sign in as parent1 → that team's roster shows Player Two with safe fields only.`);
} finally {
  await client.end();
}
