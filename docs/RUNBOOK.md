# Forza Team — Pilot Runbook

Operational guide to configure, deploy, seed, and QA the MVP. Pairs with
`CLAUDE.md` (rules) and `docs/BUILD_PLAN.md` (architecture).

---

## 1. Environment variables

All env is validated at boot by a single fail-fast zod schema
([src/lib/env.ts](../src/lib/env.ts)). Missing/invalid required vars throw on
first access. Required vs optional:

| Var | Required | Purpose |
| --- | --- | --- |
| `DATABASE_URL` | ✅ | **Pooled** Neon connection — used by the serverless app (driver adapter). |
| `DIRECT_URL` | ✅ | **Direct** (non-pooled) Neon connection — used by Prisma CLI / migrations. |
| `AUTH_SECRET` | ✅ | Better Auth session/token signing secret (≥ 32 chars). |
| `BETTER_AUTH_URL` | default `http://localhost:3000` | Base URL for invite/reset links. **Set to the deploy URL in prod.** |
| `RESEND_API_KEY` | optional | When set, emails send via Resend; absent ⇒ links log to the console (dev). |
| `EMAIL_FROM` | default `Forza Team <onboarding@resend.dev>` | From address for emails. |
| `STORAGE_DRIVER` | optional (`local` \| `blob`) | `blob` required on serverless (no writable disk). Default: `local` in dev, `blob` if a token is present. |
| `BLOB_READ_WRITE_TOKEN` | required when `STORAGE_DRIVER=blob` | Vercel Blob read/write token. |
| `UPSTASH_REDIS_REST_URL` / `_TOKEN` | optional | Rate limiting on auth routes; absent ⇒ not limited (warned once). |
| `LOG_LEVEL` | optional | `debug`/`info`/`warn`/`error`. |

> **Node:** use **Node 22 LTS** (`.nvmrc` / `.node-version` pin `22`; `engines`
> in package.json). Odd releases (e.g. 23.x) fail Prisma's install guard.

### Neon + Prisma + Vercel connection model (the common gotcha)
- App runtime ([src/db/client.ts](../src/db/client.ts)) connects through the
  **pooled** `DATABASE_URL` (Neon pooler, `-pooler` host) via the `pg` driver
  adapter — correct for serverless.
- Migrations ([prisma.config.ts](../prisma.config.ts)) use the **direct**
  `DIRECT_URL` (non-pooled host) — pooled connections can't run DDL reliably.
- In Vercel, set both env vars; point `DATABASE_URL` at the pooled string and
  `DIRECT_URL` at the direct string from the Neon dashboard.

---

## 2. Local setup

```bash
nvm use                 # Node 22 (from .nvmrc)
npm install
cp .env.example .env     # then fill DATABASE_URL / DIRECT_URL / AUTH_SECRET
npm run db:deploy        # apply migrations to the DB
npm run db:seed          # seed roles + the Demo FC club (prints an accept link)
npm run dev
```

Open the printed `accept-invite` link → set a password → land on the Club Manager
dashboard. With no `RESEND_API_KEY`, all invite/reset emails are **logged to the
server console** (look for the `──── EMAIL (dev fallback) ────` block).

---

## 3. Migrate & seed

- `npm run db:deploy` — apply committed migrations (prod-safe; uses `DIRECT_URL`).
- `npm run db:migrate -- --name <x>` — create a new dev migration.
- `npm run db:seed` — idempotent demo seed (roles + `Demo FC`: settings, season,
  2 teams, a coach, 6 players, 2 parents linked to children, 3 events with an
  RSVP + attendance, a published announcement, an evaluation cycle with sample
  scores). Re-running is safe (the dataset is inserted only when the club has no
  players yet). Prints a fresh `CLUB_ADMIN` accept link.

To exercise Coach / Parent logins, sign in as Club Manager and **invite** a coach
and a parent from the UI (Parents page / coach assignment); with the console
email provider the accept links appear in the server logs.

---

## 4. Deploy to Vercel

1. Set Vercel **Node version = 22** (Project → Settings → General).
2. Add env vars (Section 1): pooled `DATABASE_URL`, direct `DIRECT_URL`,
   `AUTH_SECRET`, `BETTER_AUTH_URL` (= deploy URL), `RESEND_API_KEY` + verified
   `EMAIL_FROM`, `STORAGE_DRIVER=blob` + `BLOB_READ_WRITE_TOKEN`.
3. Build runs `next build`. Apply migrations against the prod/preview DB with
   `npm run db:deploy` (Neon branch per preview pairs well with this).
4. Verify: sign-in, upload a player photo (Blob + proxy), open `/api/files/[id]`
   only while authorized.

Errors never leak stack traces to clients — the app error boundary shows a
generic message + a digest ref; API routes return generic status text.

---

## 5. Tests

- `npm test` — guard-level unit + RBAC regression (no DB needed). Includes the
  RBAC/privacy matrix (`tests/rbac/matrix.test.ts`), parent-safe projection, and
  the decoupled accept→link grant logic (`tests/identity/invitation-grants.test.ts`).
- `npm run test:integration` — DB-backed integration tests. **Gated + guarded**:
  skips unless `TEST_DATABASE_URL` is set, and **refuses to run** if that URL
  resolves to the same database as the app's `DATABASE_URL`/`DIRECT_URL` (fails
  fast — never touches production). Point it at an **isolated** DB — a Neon test
  branch (preferred) or local Postgres:

  ```bash
  docker run -e POSTGRES_PASSWORD=pw -p 5433:5432 -d postgres:16
  export TEST_DATABASE_URL=postgresql://postgres:pw@localhost:5433/postgres
  npx prisma migrate deploy            # apply schema to the test DB
  npm run test:integration             # RSVP/attendance/eval upserts, parent
                                       # multi-child aggregation + club scoping,
                                       # parent-safe roster, eval gating
  ```

Always run `npm run typecheck && npm run lint && npm test && npm run build`
before shipping.

---

## 6. Per-role manual QA — mapped to the 8 MVP success criteria

Seed first (`npm run db:seed`), accept the Club Manager invite, then:

### Master Admin
- [ ] **(1 Auth/RBAC)** Sign in → lands on `/dashboard/admin`; sees system
      counts (clubs/teams/players). Cannot be reached by other roles.
- [ ] **(2 Clubs)** Can view/manage clubs at `/clubs`.

### Club Manager (`club-admin@demo.test`)
- [ ] **(2 Clubs/Seasons/Teams)** Dashboard shows teams/players/seasons; create a
      team & season.
- [ ] **(3 Players & Parents)** Players list populated; open a player (full
      detail incl. medical/emergency). Parents list shows linked counts; invite a
      parent (link appears in console).
- [ ] **(4 Announcements/Files)** Publish a club announcement; upload a club &
      team document on `/documents`; they download via the proxy.
- [ ] **(5 Schedule)** See events; create one; record attendance.
- [ ] **(6 Dashboards)** "Needs attention" + upcoming panels render.
- [ ] **(7 Evaluations)** Configure a template/cycle; an evaluation summary shows.
- [ ] **(Settings)** Toggle **Share evaluations with parents** on `/settings`; the
      parent's evaluation visibility flips live (criterion below).

### Coach (`coach@demo.test`, via UI invite)
- [ ] **(RBAC scope)** Sees only assigned teams' players/events; cannot reach
      another team. Dashboard shows attendance-needed + evaluations-to-complete.
- [ ] **(4 Chat)** Open a team chat thread; post a message (5s polling updates).
- [ ] **(5 Attendance)** Take attendance via quick-entry for an assigned team.
- [ ] **(7 Evaluations)** Evaluate an assigned-team player (scores + notes).

### Parent (`parent1@demo.test`, via UI invite — multi-child)
- [ ] **(3 Parent-safe)** "My Kids" shows both linked children; the team roster
      view hides other families' PII (and photos when the setting is off).
- [ ] **(5 RSVP)** Aggregated schedule across both children; submit a per-child
      RSVP; "RSVP needed" clears.
- [ ] **(7 Eval gating)** Child **Evaluations** link appears only after the admin
      enables sharing; shows summary + parent-visible notes, **never** coach-only
      notes.
- [ ] **(4 Announcements)** Sees relevant announcements; never `COACHES_ONLY` or
      drafts.

### Child-safety / tenant isolation (cross-cutting)
- [ ] A parent cannot edit another child or see another club's data.
- [ ] File reads go through `/api/files/[id]` (no public URLs); an out-of-scope
      file returns 403.

---

## 7. Production seed & first-deploy verification

### Production seed safety
`npm run db:seed` seeds the four **roles** (auth needs them) and, **only outside
production**, the **Demo FC** demo dataset. In production the seed prints
"seeded roles only; skipping Demo FC" and stops — Demo FC can never reach prod
(override intentionally with `SEED_DEMO=1`, not recommended). Production schema is
applied via `npm run db:deploy` (`prisma migrate deploy`), never `migrate dev`.

Minimal production bootstrap:
```bash
npm run db:deploy        # apply migrations
NODE_ENV=production npm run db:seed   # roles only (no Demo FC)
# then create the first Master Admin + a real club via your admin path
```

### First-deploy verification checklist
After the first deploy to a fresh environment, confirm:

- [ ] **Migrations applied** — `prisma migrate deploy` reports all migrations applied; `prisma migrate status` is clean.
- [ ] **Env present & validated** — app boots without env errors (the zod schema in `src/lib/env.ts` fails fast on missing required vars).
- [ ] **Connection model** — `DATABASE_URL` is the **pooled** Neon string, `DIRECT_URL` the **direct** one; serverless functions don't exhaust connections under load.
- [ ] **Roles seeded, Demo FC absent** — `roles` has 4 rows; no `clubs` row with `short_code = 'DEMO'`.
- [ ] **Login works** — sign-in + session persists; `BETTER_AUTH_URL` matches the deploy origin.
- [ ] **Invite email sends** — with `RESEND_API_KEY` set, an invite delivers a working accept link (dev without a key logs the link to the server console).
- [ ] **File upload works** — `STORAGE_DRIVER=blob` + `BLOB_READ_WRITE_TOKEN`; a player-photo upload round-trips and renders via the permission-checked proxy `/api/files/[id]` (no public URLs).
- [ ] **No secrets in the client bundle** — `grep` the built client chunks for `AUTH_SECRET` / `BLOB_READ_WRITE_TOKEN` / `RESEND_API_KEY` → no matches (env is server-only; never `NEXT_PUBLIC_*`).
- [ ] **Health check** — `GET /api/health` returns OK.
- [ ] **No client console errors** on the dashboards (admin + parent).
- [ ] **Smoke the cascade** — run the §6 per-role QA checklist once.
