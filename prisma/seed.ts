import crypto from "node:crypto";

import pg from "pg";

// Standalone seed: self-contained (raw pg + process.env) so it doesn't depend
// on the app's `@/` path aliases. Run with `npm run db:seed`.
//
// Seeds the four roles, a realistic demo club ("Demo FC") — settings, a season,
// two teams, a coach, players, player accounts linked to children, a few events with
// RSVPs/attendance, a published announcement, and an evaluation cycle with
// sample scores — then a pending CLUB_ADMIN invitation whose accept-link is
// printed so the full invite → sign-in → dashboard flow works end-to-end.
//
// Idempotent: roles/club/settings upsert; the demo dataset is inserted only if
// the club has no players yet (re-running is safe and won't duplicate).

try {
  process.loadEnvFile();
} catch {
  // env already in the environment (CI / prisma config)
}

const { Client } = pg;
type DB = InstanceType<typeof pg.Client>;

const ROLES: Array<[string, string, string]> = [
  ["MASTER_ADMIN", "Master Admin", "System-wide administrator across all clubs"],
  ["CLUB_ADMIN", "Club Manager", "Administrator of a single club"],
  ["COACH", "Coach", "Operational access to assigned teams"],
  ["PLAYER", "Player", "Access to linked children"],
];

const DEMO_CLUB = { name: "Demo FC", shortCode: "DEMO" };
const DEMO_INVITE_EMAIL = "club-admin@demo.test";
const BASE_URL = process.env.BETTER_AUTH_URL ?? "http://localhost:3000";

async function roleId(client: DB, code: string): Promise<string> {
  const r = await client.query<{ id: string }>(`SELECT id FROM roles WHERE code = $1`, [code]);
  return r.rows[0].id;
}

/** Insert a user (by unique email) and return its id. */
async function ensureUser(client: DB, email: string, firstName: string, lastName: string): Promise<string> {
  const r = await client.query<{ id: string }>(
    `INSERT INTO users (email, first_name, last_name) VALUES ($1, $2, $3)
     ON CONFLICT (email) DO UPDATE SET first_name = EXCLUDED.first_name
     RETURNING id`,
    [email, firstName, lastName],
  );
  return r.rows[0].id;
}

async function seedDemoData(client: DB, clubId: string): Promise<void> {
  const playerCount = await client.query<{ count: string }>(
    `SELECT count(*)::text AS count FROM players WHERE club_id = $1`,
    [clubId],
  );
  if (Number(playerCount.rows[0].count) > 0) {
    console.log("• demo dataset already present — skipping data insert");
    return;
  }

  // Settings (defaults are fine; create explicitly so the Settings page has a row).
  await client.query(`INSERT INTO club_settings (club_id) VALUES ($1) ON CONFLICT (club_id) DO NOTHING`, [clubId]);

  // Season + two teams.
  const season = await client.query<{ id: string }>(
    `INSERT INTO seasons (club_id, name, start_date, end_date) VALUES ($1, '2026 Spring', '2026-03-01', '2026-06-30') RETURNING id`,
    [clubId],
  );
  const seasonId = season.rows[0].id;
  const mkTeam = async (name: string, code: string, age: string) =>
    (
      await client.query<{ id: string }>(
        `INSERT INTO teams (club_id, season_id, name, team_code, age_group) VALUES ($1, $2, $3, $4, $5) RETURNING id`,
        [clubId, seasonId, name, code, age],
      )
    ).rows[0].id;
  const teamU12 = await mkTeam("U12 Lions", "U12L", "U12");
  const teamU14 = await mkTeam("U14 Eagles", "U14E", "U14");

  // Coach (user + COACH role assignment + team_coaches on both teams).
  const coachUserId = await ensureUser(client, "coach@demo.test", "Casey", "Coach");
  const coachRole = await roleId(client, "COACH");
  await client.query(
    `INSERT INTO user_role_assignments (user_id, role_id, club_id, is_primary, status) VALUES ($1, $2, $3, true, 'ACTIVE')`,
    [coachUserId, coachRole, clubId],
  );
  for (const teamId of [teamU12, teamU14]) {
    await client.query(
      `INSERT INTO team_coaches (club_id, team_id, user_id, role_type, status) VALUES ($1, $2, $3, 'HEAD_COACH', 'ACTIVE')
       ON CONFLICT (team_id, user_id) DO NOTHING`,
      [clubId, teamId, coachUserId],
    );
  }

  // Players (3 per team).
  const mkPlayer = async (first: string, last: string, pos: string, jersey: string) =>
    (
      await client.query<{ id: string }>(
        `INSERT INTO players (club_id, first_name, last_name, primary_position, jersey_number, date_of_birth)
         VALUES ($1, $2, $3, $4, $5, '2014-05-01') RETURNING id`,
        [clubId, first, last, pos, jersey],
      )
    ).rows[0].id;
  const players = {
    u12: [await mkPlayer("Alex", "Stone", "MID", "8"), await mkPlayer("Bo", "Reyes", "FWD", "9"), await mkPlayer("Cam", "Lee", "DEF", "4")],
    u14: [await mkPlayer("Dia", "Khan", "GK", "1"), await mkPlayer("Eli", "Park", "MID", "6"), await mkPlayer("Fin", "Ng", "FWD", "11")],
  };
  const membership = async (playerId: string, teamId: string) =>
    client.query(
      `INSERT INTO player_team_memberships (club_id, player_id, team_id, season_id, status) VALUES ($1, $2, $3, $4, 'ACTIVE')`,
      [clubId, playerId, teamId, seasonId],
    );
  for (const p of players.u12) await membership(p, teamU12);
  for (const p of players.u14) await membership(p, teamU14);

  // Two player accounts, each linked to children (one is a multi-child account across teams).
  const playerRole = await roleId(client, "PLAYER");
  const mkPlayerAccount = async (email: string, first: string, last: string, childIds: string[]) => {
    const userId = await ensureUser(client, email, first, last);
    await client.query(
      `INSERT INTO user_role_assignments (user_id, role_id, club_id, is_primary, status) VALUES ($1, $2, $3, true, 'ACTIVE')`,
      [userId, playerRole, clubId],
    );
    const playerAccount = await client.query<{ id: string }>(
      `INSERT INTO player_accounts (club_id, user_id, first_name, last_name, email) VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (club_id, user_id) DO UPDATE SET first_name = EXCLUDED.first_name RETURNING id`,
      [clubId, userId, first, last, email],
    );
    for (const childId of childIds) {
      await client.query(
        `INSERT INTO player_account_links (club_id, player_id, player_account_id, relationship_type, status) VALUES ($1, $2, $3, 'GUARDIAN', 'ACTIVE')
         ON CONFLICT (player_id, player_account_id) DO NOTHING`,
        [clubId, childId, playerAccount.rows[0].id],
      );
    }
  };
  // Player 1 has a child on each team (multi-child across teams).
  await mkPlayerAccount("player1@demo.test", "Pat", "Stone", [players.u12[0], players.u14[0]]);
  await mkPlayerAccount("player2@demo.test", "Sam", "Reyes", [players.u12[1]]);

  // Events: an upcoming practice + game for U12, plus a club-wide event.
  const day = (n: number) => new Date(Date.now() + n * 86_400_000);
  const mkEvent = async (
    teamId: string | null,
    type: string,
    title: string,
    startDays: number,
    durH: number,
  ) =>
    (
      await client.query<{ id: string }>(
        `INSERT INTO events (club_id, team_id, event_type, title, start_at, end_at, timezone, status)
         VALUES ($1, $2, $3, $4, $5, $6, 'America/New_York', 'SCHEDULED') RETURNING id`,
        [clubId, teamId, type, title, day(startDays), new Date(day(startDays).getTime() + durH * 3_600_000)],
      )
    ).rows[0].id;
  const practice = await mkEvent(teamU12, "PRACTICE", "U12 Practice", 2, 1.5);
  const pastGame = await mkEvent(teamU12, "GAME", "U12 vs Rivals", -3, 2);
  await mkEvent(null, "CLUB_EVENT", "Club Family Picnic", 10, 4);

  // RSVPs for the upcoming practice; attendance for the past game.
  await client.query(
    `INSERT INTO event_rsvps (club_id, event_id, player_id, responded_by_user_id, response_status) VALUES ($1, $2, $3, $4, 'GOING')`,
    [clubId, practice, players.u12[0], coachUserId],
  );
  await client.query(
    `INSERT INTO attendance_records (club_id, event_id, player_id, recorded_by_user_id, attendance_status) VALUES ($1, $2, $3, $4, 'PRESENT')`,
    [clubId, pastGame, players.u12[0], coachUserId],
  );

  // A published team announcement.
  await client.query(
    `INSERT INTO announcements (club_id, team_id, title, body, audience_type, status, published_at)
     VALUES ($1, $2, 'Welcome to the season!', 'Practices start next week — check the schedule.', 'TEAM_ONLY', 'PUBLISHED', now())`,
    [clubId, teamU12],
  );

  // Evaluation template + criteria + a cycle + one sample evaluation with scores.
  const template = await client.query<{ id: string }>(
    `INSERT INTO evaluation_templates (club_id, name) VALUES ($1, 'Default Player Evaluation') RETURNING id`,
    [clubId],
  );
  const templateId = template.rows[0].id;
  const critCodes = [
    ["WORK_RATE", "Work Rate"],
    ["PASSING", "Passing"],
    ["DRIBBLING", "Dribbling"],
  ];
  const critIds: string[] = [];
  for (let i = 0; i < critCodes.length; i++) {
    const c = await client.query<{ id: string }>(
      `INSERT INTO evaluation_criteria (template_id, code, label, sort_order, min_score, max_score) VALUES ($1, $2, $3, $4, 0, 10) RETURNING id`,
      [templateId, critCodes[i][0], critCodes[i][1], i],
    );
    critIds.push(c.rows[0].id);
  }
  const cycle = await client.query<{ id: string }>(
    `INSERT INTO evaluation_cycles (club_id, team_id, name, cycle_type, starts_at, ends_at, status)
     VALUES ($1, $2, '2026 Mid-season', 'MIDSEASON', now() - interval '1 day', now() + interval '30 days', 'ACTIVE') RETURNING id`,
    [clubId, teamU12],
  );
  const sampleScores = [7, 8, 6];
  const overall = sampleScores.reduce((a, b) => a + b, 0) / sampleScores.length;
  const evaluation = await client.query<{ id: string }>(
    `INSERT INTO player_evaluations (club_id, team_id, player_id, evaluation_cycle_id, template_id, position_code, overall_score, summary_comment, player_visible_notes, coach_only_notes)
     VALUES ($1, $2, $3, $4, $5, 'MID', $6, 'Strong term, great attitude.', 'Keep working on first touch.', 'Consider for select squad trial.') RETURNING id`,
    [clubId, teamU12, players.u12[0], cycle.rows[0].id, templateId, overall],
  );
  for (let i = 0; i < critIds.length; i++) {
    await client.query(
      `INSERT INTO player_evaluation_scores (player_evaluation_id, criterion_id, raw_score, weighted_score) VALUES ($1, $2, $3, $3)`,
      [evaluation.rows[0].id, critIds[i], sampleScores[i]],
    );
  }

  console.log("✓ seeded demo dataset: 1 season, 2 teams, 1 coach, 6 players, 2 player accounts, 3 events, 1 announcement, 1 evaluation");
}

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

    // PRODUCTION SAFETY: the four roles are the only data production needs (auth
    // requires them). The Demo FC club + its data must NEVER land in production —
    // it's a dev/demo fixture. Refuse unless explicitly allowed.
    const allowDemo = process.env.NODE_ENV !== "production" || process.env.SEED_DEMO === "1";
    if (!allowDemo) {
      console.log("• production environment — seeded roles only; skipping Demo FC (set SEED_DEMO=1 to override).");
      return;
    }

    const club = await client.query<{ id: string }>(
      `INSERT INTO clubs (name, short_code) VALUES ($1, $2)
       ON CONFLICT (short_code) DO UPDATE SET name = EXCLUDED.name
       RETURNING id`,
      [DEMO_CLUB.name, DEMO_CLUB.shortCode],
    );
    const clubId = club.rows[0].id;
    console.log(`✓ demo club "${DEMO_CLUB.name}" (${clubId})`);

    await seedDemoData(client, clubId);

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
