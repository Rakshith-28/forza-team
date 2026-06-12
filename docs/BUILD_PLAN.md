# Forza Team — Build Plan (Fresh Start, 2026)

A multi-tenant soccer club management platform. This document defines the
**technology stack, architecture, UI/UX process, and a phased build roadmap**
for building it from scratch. It is written to be handed directly to Claude Code
as the source of truth for the build.

> **Scope reminder.** MVP covers: auth + RBAC, club/season/team management,
> players, rosters, announcements + messaging, events with
> RSVP/attendance, dashboards, basic evaluations, and basic file storage.
> Deferred to Phase 2+: payments, waivers, advanced evaluations, AI features,
> push/SMS, native mobile apps, enterprise admin.

---

## 1. Technology stack

Chosen for current performance, developer velocity, and — because this platform
stores **minors' personal data** — strong data ownership (no third-party
identity vendor holding child records).

| Layer | Choice | Why |
| --- | --- | --- |
| Framework | **Next.js 16.2** (App Router) | Turbopack is the default dev bundler; ~10x faster HMR. Full-stack via Route Handlers + Server Actions. Deploys cleanly to Vercel. |
| UI runtime | **React 19.2** | View Transitions, `useEffectEvent`, and the **stable React Compiler** (auto-memoization, no manual `useMemo`). |
| Language | **TypeScript** (strict) | Non-negotiable for a schema this size. |
| Database | **PostgreSQL on Neon** | Serverless Postgres, branching for preview deploys, generous free tier. Already provisioned. |
| ORM | **Prisma 7** | Perf gap with Drizzle now closed (Rust engine removed, ~90% smaller bundle, edge-ready). Schema-first workflow, integrated migrations, and Prisma Studio win on a 51-table relational schema. **See decision note below.** |
| Auth | **Better Auth** | Self-hosted, TypeScript-first. Built-in **organizations (multi-tenancy)**, **RBAC**, 2FA, passkeys, sessions. All user data stays in your Postgres. |
| Styling | **Tailwind CSS v4** | CSS-first config, faster engine. |
| Components | **shadcn/ui** (Radix primitives) | Copy-paste components you own outright; accessible by default; AI tooling is fluent in it. |
| Forms | **React Hook Form + Zod** | Zod schemas double as API validation and TS types. |
| Server state | **TanStack Query** (where needed) | For client-side cache/refetch beyond what RSC covers. |
| Email | **Resend** + React Email | Invites, password resets, event notifications. |
| File storage | **Vercel Blob** (or Cloudflare R2) | Player docs, team files. R2 if egress cost matters later. |
| Rate limiting | **Upstash Redis** (`@upstash/ratelimit`) | Auth routes are **not** rate-limited by default — this is required, not optional. |
| Error monitoring | **Sentry** | Server + client. |
| Hosting | **Vercel** | Matches the framework; Neon branching pairs with preview deploys. |
| Package manager | **npm** | Standard, zero-setup, ships with Node; lockfile committed as `package-lock.json`. |

### Decision note — ORM (resolved: Prisma 7)

Both Prisma 7 and Drizzle are production-grade in 2026. The call here is
**Prisma 7**, for this specific situation:

- The "fastest" concern is no longer a real differentiator — Prisma 7 removed the
  Rust engine, shrank the bundle ~90%, and now performs comparably to Drizzle for
  typical web app workloads on serverless. The cold-start gap is milliseconds.
- The schema is the deciding factor: **51 tables, heavy relations, audit columns,
  player account/profile linkage.** Prisma's single-file `schema.prisma` as a source of
  truth, integrated `migrate + generate`, and **Prisma Studio** for inspecting
  data pay off repeatedly across a 7-phase build.

Drizzle would have been the pick for an edge-heavy app with a lean schema. This
isn't that — so Prisma 7 it is.

### Decision note — realtime messaging (resolved: deferred)

Comms (announcements/chat) is **built last in the MVP sequence** (see Phase 4
placement), and the realtime transport is **decided then, not now**. When we get
there the default will be the simplest thing that works — server actions + short
polling or SSE — with a managed push layer (Pusher/Ably) only if push semantics
turn out to be needed. The self-hosted Redis + WebSocket gateway from the old
architecture stays a Phase 2+ concern.

---

## 2. Architecture

### Shape: modular monolith on Next.js

One Next.js app, organized into clear domain modules with enforced boundaries —
not microservices. This honors the MVP stack exactly and keeps the option open to
extract a service later if scale ever demands it.

### Multi-tenancy model

- **Tenant = Club.** Every tenant-owned row carries a `club_id`.
- **Decision (Phase 1): we do NOT use the Better Auth organization plugin.**
  Better Auth handles **authentication only** (identity, sessions, password).
  Club membership and the user→club mapping are modeled by our own
  `clubs` + `user_role_assignments(club_id, team_id)` tables — which already
  encode the four scope-aware roles, something the org plugin's
  owner/admin/member model cannot. A user can belong to multiple clubs via
  multiple role assignments; the active club is tracked on the session.
- **Enforce tenant isolation in a single data-access layer**, not scattered across
  routes. Every query is scoped by the caller's active `club_id`; cross-tenant
  reads are impossible by construction, not by discipline.

### Authorization: layered, defense-in-depth

Four roles — `MASTER_ADMIN`, `CLUB_ADMIN`, `COACH`, `PLAYER` — with scopes
`SYSTEM` / `CLUB` / `TEAM` / `CHILD`.

1. **Middleware gate** — verifies a valid session exists; redirects anonymous users.
2. **Route/action guard** — `requireUser()`, `requireRole()`.
3. **Service-layer scope assertions** — `assertClubScope`, `assertTeamScope`,
   `assertChildScope`. This is the authoritative layer; never trust the UI or
   middleware alone.

### Child-safety as a first-class constraint

Because the platform holds data on minors, these are **architectural
requirements, not features**:

- **Player-safe projections.** A `PLAYER` only ever sees their own linked
  player profiles and team-public information. Roster/contact queries for player
  accounts run through dedicated projections that strip other families' PII —
  enforced in the data layer.
- **No open contact exposure.** Coaches/players communicate through the platform;
  raw phone/email of other members is never returned to non-privileged roles.
- **Audit trail** on sensitive actions (child linkage, role grants, data exports).
- **Data minimization & retention** policy from day one; explicit consent records.

### Repository structure

```
forza-team/
├── src/
│   ├── app/
│   │   ├── (auth)/                # login, reset, accept-invite — public
│   │   ├── (app)/                 # authenticated shell + dashboards
│   │   └── api/                   # route handlers (webhooks, health, auth)
│   ├── modules/                   # domain modules (the real boundaries)
│   │   ├── identity/              # users, roles, sessions (Better Auth glue)
│   │   ├── clubs/                 # clubs, seasons, teams, coach assignments
│   │   ├── roster/                # players, player accounts, profile linkage
│   │   ├── comms/                 # announcements, chat, documents
│   │   ├── schedule/              # events, RSVP, attendance
│   │   ├── evaluations/           # player evals, development tracking
│   │   └── reporting/             # dashboards
│   ├── db/                        # prisma client, generated types, seed
│   ├── lib/                       # auth, rbac, validation, http helpers
│   ├── components/ui/             # shadcn primitives
│   └── components/                # composed app components
├── prisma/                        # schema.prisma + migrations
├── tests/
└── .github/workflows/             # CI: lint, typecheck, test, build
```

Each module owns its schema slice, service layer, and validators; modules talk to
each other through service functions, never by reaching into each other's tables.

---

## 3. UI/UX stages

Run the design track **slightly ahead** of the build track so each phase has
specs ready before engineering starts it.

### Stage A — Foundations (before any feature work)
- **Design tokens** in Tailwind v4: color (a soccer-pitch palette + semantic
  roles), typography scale, spacing, radii, shadows, motion.
- **Light/dark** support decided up front.
- **Accessibility baseline**: WCAG 2.2 AA targets, focus states, contrast,
  keyboard nav. Non-negotiable on a platform players and families use.

### Stage B — Component system
- Install shadcn/ui primitives; theme them with the tokens.
- Build the composed components the app reuses everywhere: data table, form field,
  empty state, page header, role-aware nav, modal/sheet patterns, toast.
- Storybook (or a `/dev/components` route) to review them in isolation.

### Stage C — Information architecture & flows
- Sitemap per role (the four roles see different navigation).
- Key user flows mapped as diagrams: **onboarding/invite acceptance**, **create
  club→season→team**, **link player account to profile**, **post announcement**, **create
  event → RSVP → take attendance**, **record evaluation**.
- Define the **role-aware dashboard** for each of the four roles — this is the
  landing surface and sets the tone.

### Stage D — Page specs (per feature, just-in-time)
For each feature phase, produce a one-page spec before building: states (loading,
empty, error, success), permissions per role, validation rules, and responsive
behavior. **Mobile-first** — players and coaches live on phones.

### Stage E — Polish & QA
- Motion/transitions (lean on React 19 View Transitions).
- Cross-device testing, real-content review (long names, many teams, edge cases).
- Accessibility audit pass.

---

## 4. Phased build roadmap

Each phase ends with something deployable and testable. Tackle them in order;
don't start a phase until the prior one is green in CI.

### Phase 0 — Foundation
- `create-next-app` (TS, Tailwind, ESLint, App Router, Turbopack, npm).
- Prisma 7 + Neon wired; env validation; singleton client; structured logger.
- shadcn/ui installed and themed (Stage A + B design tokens).
- CI: lint + typecheck + test + build. Health-check endpoint.
- **Exit:** app boots, connects to DB, CI passes on every PR.

### Phase 1 — Identity, auth & RBAC
- Better Auth: email+password, sessions, password reset, invite acceptance.
- Organizations (club tenancy) + the four roles and scope helpers.
- Layered guards (middleware → route guard → service scope assertions).
- Rate limiting on auth routes (Upstash).
- Role-aware authenticated shell + a placeholder dashboard per role.
- **Exit:** users can be invited, sign in, and land on a role-correct dashboard;
  cross-tenant access is provably blocked.

### Phase 2 — Clubs, seasons, teams
- Club CRUD (master/club manager), seasons, teams, coach assignments.
- Tenant scoping verified end-to-end.
- **Exit:** an admin can build out a club's structure for a season.

### Phase 3 — Players & player accounts
- Player records, player accounts, **player account↔profile linkage**.
- Player-safe roster projections (the child-safety layer from §2).
- **Exit:** player accounts see only their own profiles + team-public info; PII isolation holds.

### Phase 4 — Communications
- Announcements (team/club scoped), basic messaging/chat, document uploads.
- Realtime transport decided here (default: polling/SSE; managed push only if needed).
- **Exit:** a coach can announce to a team; players receive it; files attach.

### Phase 5 — Schedule
- Events, RSVP, attendance tracking.
- Calendar views; reminders via email (Resend).
- **Exit:** create event → players RSVP → coach records attendance.

### Phase 6 — Dashboards & reporting
- Per-role dashboards filled with real data (attendance rates, upcoming events,
  roster health, unread announcements).
- **Exit:** each role's landing page is genuinely useful.

### Phase 7 — Evaluations & development
- Basic player evaluations, position weights, comparison views, development goals.
- **Exit:** a coach can evaluate a player and track progress over a season.

> **Phase 2+ (post-MVP):** payments (Stripe), waivers, advanced evaluations, AI
> features, push/SMS, native apps, enterprise admin, and — if scale demands —
> extracting realtime/heavy modules into a dedicated service.

---

## 5. Cross-cutting practices

- **Testing.** Vitest for unit/service tests (especially RBAC and player-safety
  scoping — these get the heaviest coverage). Playwright for critical E2E flows
  (auth, invite, RSVP). Aim to test authorization boundaries as a priority.
- **Migrations.** Prisma Migrate (`migrate dev` locally, `migrate deploy` in CI);
  migrations reviewed in PRs. Use Neon branching so each preview deploy gets an
  isolated DB branch. Prisma Studio for data inspection during development.
- **Validation.** One Zod schema per input, shared between client form and server
  action/route. Never trust client input at the service layer.
- **Secrets/config.** Validated env at startup; no secret ever reaches the client
  bundle. `AUTH_SECRET`, `DATABASE_URL`, `DIRECT_URL`, provider keys.
- **Observability.** Sentry for errors; structured JSON logs; audit log for
  sensitive mutations.
- **Performance.** Lean on RSC + the React Compiler; keep client bundles small;
  stream where it helps; index foreign keys and tenant columns.

---

## 6. First concrete steps

Both forks are now decided: **Prisma 7** as the ORM, and **comms built last**
with the realtime transport chosen at Phase 4. So:

1. Scaffold the repo (Phase 0) and get CI green.
2. Port the existing **51-table schema** into `prisma/schema.prisma`, organized
   by module, then `prisma migrate dev` against a Neon branch.
3. Stand up **Better Auth** with the four roles and club organizations (Phase 1).
4. Lock the **design tokens + core component set** (Stage A/B) in parallel.

From there the phases proceed in order, design running one step ahead of build.
