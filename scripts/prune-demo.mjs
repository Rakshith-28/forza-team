/**
 * Remove the Demo FC club + all its dependent rows and the @demo.test user
 * accounts from a database. DRY RUN by default — pass --apply to delete (in a
 * single transaction). Touches ONLY the Demo FC club (short_code 'DEMO') and
 * users whose email ends in @demo.test; never roles or other clubs/users.
 *
 * Env-driven (NO hardcoded URLs):
 *   vercel env pull .env.production.local
 *   node --env-file=.env.production.local scripts/prune-demo.mjs           # dry run
 *   node --env-file=.env.production.local scripts/prune-demo.mjs --apply   # delete
 */
import pg from "pg";

const APPLY = process.argv.includes("--apply");
const connectionString = process.env.DIRECT_URL ?? process.env.DATABASE_URL;
if (!connectionString) throw new Error("DIRECT_URL/DATABASE_URL not set (pull prod env first).");

const UUID = /^[0-9a-f-]{36}$/i;
const DEMO_USERS = `(SELECT id FROM users WHERE email LIKE '%@demo.test')`;

const client = new pg.Client({ connectionString });
await client.connect();
try {
  console.log(`• Target DB: ${new URL(connectionString).host}`);
  console.log(`• Mode: ${APPLY ? "APPLY (will delete)" : "DRY RUN (no changes)"}\n`);

  const clubRes = await client.query(`SELECT id FROM clubs WHERE short_code = 'DEMO'`);
  if (clubRes.rows.length === 0) {
    console.log("No Demo FC club (short_code 'DEMO') found — nothing to prune.");
    process.exit(0);
  }
  const clubId = clubRes.rows[0].id;
  if (!UUID.test(clubId)) throw new Error(`Unexpected club id: ${clubId}`);

  const demoUsers = await client.query(`SELECT email FROM users WHERE email LIKE '%@demo.test' ORDER BY email`);
  console.log(`Demo FC club id: ${clubId}`);
  console.log(`@demo.test users (${demoUsers.rows.length}): ${demoUsers.rows.map((r) => r.email).join(", ") || "none"}\n`);

  const C = `'${clubId}'`;
  // "table + WHERE" fragments, ordered dependents → referenced rows. $C is the Demo club id.
  const steps = [
    // chat
    `message_attachments WHERE message_id IN (SELECT id FROM messages WHERE chat_id IN (SELECT id FROM chats WHERE club_id = ${C}))`,
    `messages WHERE chat_id IN (SELECT id FROM chats WHERE club_id = ${C})`,
    `chat_members WHERE chat_id IN (SELECT id FROM chats WHERE club_id = ${C})`,
    `chats WHERE club_id = ${C}`,
    `announcements WHERE club_id = ${C}`,
    // events
    `event_attachments WHERE event_id IN (SELECT id FROM events WHERE club_id = ${C})`,
    `event_rsvps WHERE club_id = ${C}`,
    `attendance_records WHERE club_id = ${C}`,
    `events WHERE club_id = ${C}`,
    // evaluations + (phase-2) weights/dev goals
    `player_evaluation_scores WHERE player_evaluation_id IN (SELECT id FROM player_evaluations WHERE club_id = ${C})`,
    `player_evaluations WHERE club_id = ${C}`,
    `position_weight_profile_items WHERE profile_id IN (SELECT id FROM position_weight_profiles WHERE club_id = ${C})`,
    `position_weight_profiles WHERE club_id = ${C}`,
    `evaluation_criteria WHERE template_id IN (SELECT id FROM evaluation_templates WHERE club_id = ${C})`,
    `evaluation_templates WHERE club_id = ${C}`,
    `development_goal_updates WHERE goal_id IN (SELECT id FROM development_goals WHERE club_id = ${C})`,
    `development_goals WHERE club_id = ${C}`,
    `evaluation_cycles WHERE club_id = ${C}`,
    // registration / billing / waivers (defensive; empty in MVP)
    `registration_answers WHERE submission_id IN (SELECT id FROM registration_submissions WHERE club_id = ${C})`,
    `registration_submissions WHERE club_id = ${C}`,
    `registration_forms WHERE club_id = ${C}`,
    `registration_programs WHERE club_id = ${C}`,
    `payment_plan_installments WHERE payment_plan_id IN (SELECT id FROM payment_plans WHERE invoice_id IN (SELECT id FROM invoices WHERE club_id = ${C}))`,
    `payment_plans WHERE invoice_id IN (SELECT id FROM invoices WHERE club_id = ${C})`,
    `refunds WHERE club_id = ${C}`,
    `payments WHERE club_id = ${C}`,
    `invoice_items WHERE invoice_id IN (SELECT id FROM invoices WHERE club_id = ${C})`,
    `invoices WHERE club_id = ${C}`,
    `discounts WHERE club_id = ${C}`,
    `waiver_acceptances WHERE club_id = ${C}`,
    `waiver_versions WHERE waiver_id IN (SELECT id FROM waivers WHERE club_id = ${C})`,
    `waivers WHERE club_id = ${C}`,
    `family_accounts WHERE club_id = ${C}`,
    // roster
    `player_account_links WHERE club_id = ${C}`,
    `player_team_memberships WHERE club_id = ${C}`,
    `files WHERE club_id = ${C}`,
    `player_accounts WHERE club_id = ${C}`,
    `players WHERE club_id = ${C}`,
    `team_coaches WHERE club_id = ${C}`,
    // access + structure
    `invitations WHERE club_id = ${C}`,
    `user_role_assignments WHERE club_id = ${C}`,
    `audit_logs WHERE club_id = ${C}`,
    `notifications WHERE club_id = ${C}`,
    `seasons WHERE club_id = ${C}`,
    `teams WHERE club_id = ${C}`,
    `club_settings WHERE club_id = ${C}`,
    `clubs WHERE id = ${C}`,
    // @demo.test user accounts (their club data is gone above)
    `notification_preferences WHERE user_id IN ${DEMO_USERS}`,
    `notifications WHERE user_id IN ${DEMO_USERS}`,
    `password_reset_tokens WHERE user_id IN ${DEMO_USERS}`,
    `sessions WHERE user_id IN ${DEMO_USERS}`,
    `accounts WHERE user_id IN ${DEMO_USERS}`,
    `user_role_assignments WHERE user_id IN ${DEMO_USERS}`,
    `player_accounts WHERE user_id IN ${DEMO_USERS}`,
    `team_coaches WHERE user_id IN ${DEMO_USERS}`,
    `users WHERE email LIKE '%@demo.test'`,
  ];

  if (!APPLY) {
    console.log("Rows that WOULD be deleted (dry run):");
    let total = 0;
    for (const s of steps) {
      const table = s.split(" ")[0];
      const { rows } = await client.query(`SELECT count(*)::int AS n FROM ${s}`);
      const n = rows[0].n;
      total += n;
      if (n > 0) console.log(`  ${String(n).padStart(4)}  ${table}`);
    }
    console.log(`\nTotal rows: ${total}. Re-run with --apply to delete.`);
    process.exit(0);
  }

  // APPLY — single transaction.
  await client.query("BEGIN");
  try {
    const deleted = {};
    for (const s of steps) {
      const table = s.split(" ")[0];
      const res = await client.query(`DELETE FROM ${s}`);
      if (res.rowCount > 0) deleted[table] = (deleted[table] ?? 0) + res.rowCount;
    }
    await client.query("COMMIT");
    console.log("✓ Deleted (committed):");
    let total = 0;
    for (const [t, n] of Object.entries(deleted)) {
      total += n;
      console.log(`  ${String(n).padStart(4)}  ${t}`);
    }
    console.log(`\nTotal rows deleted: ${total}. Demo FC + @demo.test users removed.`);
  } catch (e) {
    await client.query("ROLLBACK");
    console.error("Rolled back — nothing deleted. Error:", e.message);
    process.exit(1);
  }
} finally {
  await client.end();
}
