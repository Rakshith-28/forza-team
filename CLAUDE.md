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

Phase 1 (Authentication, sessions & RBAC) is complete. Next: Phase 2 (clubs,
seasons, teams). See the phased roadmap in @docs/BUILD_PLAN.md §4.

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
- **Package manager: pnpm** (pinned via `packageManager` in `package.json`). Use
  pnpm only — **never npm**. **Hosting: Vercel.**

## Commands

```bash
pnpm dev          # local dev server (Turbopack)
pnpm build        # production build
pnpm lint         # ESLint (next lint config)
pnpm typecheck    # tsc --noEmit
pnpm db:generate  # regenerate the Prisma client (after schema edits)
pnpm db:migrate   # prisma migrate dev (needs DATABASE_URL/DIRECT_URL)
pnpm db:studio    # Prisma Studio
```

CI runs `lint`, `typecheck`, and `build` on every PR (`.github/workflows/ci.yml`).

For a **named** migration use `pnpm exec prisma migrate dev --name <x>` — pnpm
passes the flag through cleanly (no npm flag-swallowing issue).

After ANY `schema.prisma` change, run `pnpm db:generate` and restart the dev server — the generated client is otherwise stale (e.g. a column that became nullable still reads as required).

pnpm v10+ blocks dependency build scripts by default
(`ERR_PNPM_IGNORED_BUILDS`); the approved set (prisma, @prisma/engines, esbuild,
sharp, unrs-resolver) is persisted in `pnpm-workspace.yaml`. pnpm 10+ reads
`overrides` (e.g. the kysely 0.28.17 pin) and these settings from
`pnpm-workspace.yaml`, **not** from the `pnpm` field in `package.json`.

### Node version

Prisma 7 supports **Node 20.19+, 22.12+, or 24+** — odd-numbered releases like
**23.x are unsupported** and their install guard fails. CI uses Node 22 (pinned
in `.nvmrc`). On an unsupported local Node you can install with
`pnpm install --ignore-scripts` then `pnpm rebuild` and `pnpm db:generate` (the
Prisma CLI runtime itself works).

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

  **Responsive rules:**
  - Any flex/grid row that mixes a fixed element (chip, avatar, time, icon, button) with
    flexible text MUST give the text column `min-w-0` (and `flex-1`) and the fixed
    siblings `shrink-0`. Text columns must `truncate`, `break-words`, or `line-clamp-*`.
    This prevents content from pushing the page wider than the viewport (no zoom-out).
  - DoD: every new card/list/row component is checked at 320px for horizontal overflow
    before commit.
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
   `COACH` / `PLAYER` over scopes `SYSTEM` / `CLUB` / `TEAM` / `CHILD`. Three
   layers: middleware session gate → route/action guard (`requireUser`,
   `requireRole`) → **service-layer scope assertions** (`assertClubScope`,
   `assertTeamScope`, `assertChildScope`). The service layer is authoritative;
   never trust the UI or middleware alone.
3. **Player-safe projections for minors' data.** A `PLAYER` only ever sees their
   own linked children and team-public info. Roster/contact queries reachable by
   player accounts run through dedicated projections that strip other families' PII.
   Raw phone/email of other members is never returned to non-privileged roles.
4. **Audit sensitive mutations** (child linkage, role grants, data exports).

When a change touches tenant data, auth, or anything involving a minor's record,
treat these as hard requirements and add tests for the authorization boundary.


## Responsive rules (mandatory — applies to EVERY change, not just UI tasks)

Layout structure
- All pages render inside the shared AppContainer/PageShell. Gutters come from the
  container only — never add ad-hoc left/right padding to a page.
- New components compose existing layout primitives. Do not reinvent spacing.
- Mobile-first: base styles target phone; layer md:/lg: upward.

Overflow safety (this is what keeps breaking — follow exactly)
- `min-w-0` must be present on EVERY flex/grid link in the chain from the viewport
  down to the content. A single missing link makes the whole column overflow.
  Specifically: the shell content column / <main> uses `flex-1 min-w-0`.
- Any flex/grid row mixing a fixed element (chip, avatar, time, icon, button) with
  flexible text: text column = `flex-1 min-w-0` + (`truncate` | `line-clamp-*` |
  `break-words`); fixed siblings = `shrink-0`.
- CSS grid tracks use `minmax(0, 1fr)`, never bare `1fr`. Grid items get `min-w-0`.
- No fixed pixel widths on layout containers; no `whitespace-nowrap` on long strings.
- Headings scale (`text-2xl sm:text-3xl ...`) and use `break-words`.
- NEVER fix overflow by hiding it with `overflow-x: hidden/clip` on the offender.
  Fix the width chain so content actually fits. (One root-level `overflow-x: clip`
  backstop is allowed only AFTER the chain is correct.)

Tooling note
- `wrap-break-word`/`wrap-anywhere` require Tailwind >= 4.1. Below that they emit no
  CSS and no error. Prefer `break-words` (valid across all v4) unless 4.1+ is confirmed.

## Definition of done (REQUIRED before committing ANY change that renders UI)
This is a measured gate, not a judgment call. "Looks fine" / "resolved by
construction" is NOT acceptable evidence.

1. Run the affected pages at 320, 375, 768, and 1280px.
2. At 360px, run this in the browser console and confirm it logs ZERO elements:
       const vw = document.documentElement.clientWidth;
       [...document.querySelectorAll('*')].forEach(el => {
         const r = el.getBoundingClientRect();
         if (r.width > vw + 1 || r.right > vw + 1) console.log(Math.round(r.width), el);
       });
3. Confirm: no horizontal scroll, no zoom-out, nothing clipped at the right edge,
   long text wraps/ellipsizes INSIDE its container (not at the screen edge).
4. Paste the zero-overflow result into the completion report.

A change that has not been measured at these widths is NOT done. If something
overflows and can't be resolved, STOP and report it — do not hide it with clipping.
