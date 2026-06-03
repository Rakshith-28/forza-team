# CLAUDE.md

Guidance for working in this repository. **The authoritative source of truth
for the product, architecture, and roadmap is @docs/BUILD_PLAN.md** — read it
before any feature work. This file captures the locked stack, the layout, and
the rules that must never be violated; it deliberately does not duplicate the
plan.

Forza Team is a **multi-tenant soccer club management platform**. It stores
**minors' personal data**, so child-safety and tenant isolation are
architectural requirements, not features.

## Working agreement

These rules apply to every session in this repo:

1. **Do exactly what's asked — nothing more.** No unrequested features,
   refactors, files, or "improvements." If extra work seems needed, ask first.
2. **Don't loop or repeat work.** If an approach fails twice, stop and report
   it rather than retrying variations. Don't re-verify what's already confirmed.
3. **When stuck or a command hangs, stop and say so plainly** — which command,
   the exact error, and what's needed to proceed. No silent churning.
4. **Commit at logical checkpoints** (after each completed sub-task / working
   milestone) with a short, clear message — don't leave everything uncommitted
   until the end. Only commit working, coherent states. **Never commit `.env`
   or secrets.**

## Status

Phase 0 (Foundation) is complete. Next: Phase 1 (identity, auth & RBAC). See
the phased roadmap in @docs/BUILD_PLAN.md §4.

## Locked stack

Do not swap these without updating the plan first.

- **Next.js 16** (App Router, Turbopack) + **React 19** + **TypeScript** (strict).
- **PostgreSQL on Neon**, **Prisma 7** ORM (driver-adapter based, no Rust engine).
- **Better Auth** for **authentication only** (identity, sessions, password) —
  *Phase 1*. We do **not** use its organization plugin; tenancy + RBAC are
  modeled by our own `clubs` + `user_role_assignments` tables.
- **Tailwind CSS v4** + **shadcn/ui** (Radix); **React Hook Form + Zod** for forms.
- **Resend** (email), **Vercel Blob** (files), **Upstash** (rate limiting),
  **Sentry** (errors) — wired in their respective phases.
- **Package manager: npm.** **Hosting: Vercel.**

## Commands

```bash
npm run dev          # local dev server (Turbopack)
npm run build        # production build
npm run lint         # ESLint (next lint config)
npm run typecheck    # tsc --noEmit
npm run db:generate  # regenerate the Prisma client (after schema edits)
npm run db:migrate   # prisma migrate dev (needs DATABASE_URL/DIRECT_URL)
npm run db:studio    # Prisma Studio
```

CI runs `lint`, `typecheck`, and `build` on every PR (`.github/workflows/ci.yml`).

For a **named** migration use `npx prisma migrate dev --name <x>` directly — `npm run db:migrate -- --name <x>` swallows the flag and hangs on the interactive prompt.

### Node version

Prisma 7 supports **Node 20.19+, 22.12+, or 24+** — odd-numbered releases like
**23.x are unsupported** and their install guard fails. CI uses Node 22. On an
unsupported local Node you can install with `npm install --ignore-scripts` then
`npm rebuild` and `npm run db:generate` (the Prisma CLI runtime itself works).

## Repository layout

Mirrors @docs/BUILD_PLAN.md §2. The path alias `@/*` → `src/*`.

```
src/
  app/
    (auth)/      # public: login, reset, accept-invite          (Phase 1)
    (app)/       # authenticated shell + dashboards              (Phase 1+)
    api/         # route handlers (health now; webhooks, auth later)
  modules/       # domain modules — the REAL boundaries (see modules/README.md)
    identity/ clubs/ roster/ comms/ schedule/ evaluations/ reporting/
  db/            # prisma singleton (client.ts) + generated client (gitignored)
  lib/           # env (env.ts), logger (logger.ts), utils (cn) — auth/rbac later
  components/ui/ # shadcn primitives (themed)
  components/    # composed app components
prisma/          # schema.prisma + migrations
prisma.config.ts # Prisma 7 config (URLs live here, not in schema)
tests/           # Vitest + Playwright (added with the features they cover)
```

Modules talk to each other only through exported service functions — never by
importing another module's tables. See [src/modules/README.md](src/modules/README.md).

## Conventions

- **Data access goes through the module service layer**, never raw Prisma calls
  from routes/components. The singleton is `@/db/client` (`prisma`).
- **Validation:** one Zod schema per input, shared between client form and
  server action/route. Never trust client input at the service layer.
- **Config:** all env is validated in [src/lib/env.ts](src/lib/env.ts) (lazy —
  fails fast at runtime, tolerant at build). No secret ever reaches the client
  bundle; never read `process.env` directly in app code — import `env`.
- **Logging:** structured JSON via [src/lib/logger.ts](src/lib/logger.ts).
  Never log raw PII; log identifiers (`clubId`, `userId`) instead.
- **Styling:** use the semantic design tokens in
  [src/app/globals.css](src/app/globals.css) (Stage A). Never hard-code colors.
  WCAG 2.2 AA, visible focus, mobile-first.
- **Prisma 7:** connection URLs live in `prisma.config.ts`, not in
  `schema.prisma` (which holds only `provider`). The runtime client connects via
  the `pg` driver adapter using `DATABASE_URL`.

## Non-negotiable rules (child-safety & multi-tenancy)

These are enforced in the **data-access layer**, not by UI discipline. Every
new module service must uphold them (details in @docs/BUILD_PLAN.md §2):

1. **Tenant scoping by `club_id`.** Tenant = Club. Every tenant-owned row carries
   a `clubId`, and every query is scoped to the caller's active club. Cross-tenant
   reads must be impossible by construction.
2. **Layered, defense-in-depth RBAC.** Roles `MASTER_ADMIN` / `CLUB_ADMIN` /
   `COACH` / `PARENT` over scopes `SYSTEM` / `CLUB` / `TEAM` / `CHILD`. Three
   layers: middleware session gate → route/action guard (`requireUser`,
   `requireRole`) → **service-layer scope assertions** (`assertClubScope`,
   `assertTeamScope`, `assertChildScope`). The service layer is authoritative;
   never trust the UI or middleware alone.
3. **Parent-safe projections for minors' data.** A `PARENT` only ever sees their
   own linked children and team-public info. Roster/contact queries reachable by
   parents run through dedicated projections that strip other families' PII.
   Raw phone/email of other members is never returned to non-privileged roles.
4. **Audit sensitive mutations** (child linkage, role grants, data exports).

When a change touches tenant data, auth, or anything involving a minor's record,
treat these as hard requirements and add tests for the authorization boundary.
