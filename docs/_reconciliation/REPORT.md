# Docs ↔ Code Reconciliation Report

Reconciling `/docs` spec files against the **actual shipped implementation**. The
code is the source of truth; most docs have drifted. This report records every
divergence found (Stage 1), the surgical edits applied (Stage 2), and every flag
raised for human review (Stage 3). A changelog is at the end (Stage 4).

**Note on `mvp_scope.md`:** the task names `mvp_scope.md` as the authoritative
scope source, but **no such file exists** anywhere in the repo (verified via
`find`/`git ls-files`). Scope intent was instead read from `docs/BUILD_PLAN.md`
and the requirements docs. No scope doc was rewritten to match code.

## Doc tiers (how each was treated)

- **Tier A — descriptive (auto-edit to match code):** `soccer_club_database_schema.md`,
  `soccer_club_uiux_page_spec.md`, `soccer_club_frontend_component_spec.md`,
  `deletion-spec.md`, `RUNBOOK.md`.
- **Tier B — RBAC (auto-edit only when code is *more* restrictive / adds a gate;
  flag when code is *broader*):** `soccer_club_rbac_matrix.md`.
- **Tier C — intent/scope (flag only):** `soccer_club_app_requirements.md`,
  `soccer_club_app_requirements_phase2.md`, `soccer_club_implementation_plan.md`,
  `BUILD_PLAN.md` (status markers editable only).
- **Tier D — stale by design (flag only):** `soccer_club_technical_architecture.md`,
  `soccer_club_api_contract.md`, `soccer_club_openapi.yaml`.

---

# STAGE 1 — DIVERGENCES (with code evidence)

## TIER A

### soccer_club_database_schema.md  (source of truth: `prisma/schema.prisma`)

Tables present in the schema but **missing from the doc**:

| # | Table | Schema evidence | Action |
|---|-------|-----------------|--------|
| A1 | `sessions`, `accounts`, `verifications` (Better Auth) | `schema.prisma:80–129`; §6 doc lists only `user_sessions (optional)` | AUTO-EDIT |
| A2 | `event_teams` (event→team join; canonical audience) | `schema.prisma:718–733` | AUTO-EDIT |
| A3 | `player_remarks` (private coach→player notes) | `schema.prisma:792–813` | AUTO-EDIT |

Column-level drift (all AUTO-EDIT):

- **§7.1 `users`** — doc shows `password_hash TEXT NOT NULL`; schema has it **nullable / legacy** (`schema.prisma:45–47`, password now lives in `accounts`). Schema adds `name VARCHAR(200)` + `image TEXT` (Better Auth, `:43–44`) and `appearance_theme VARCHAR(20) NOT NULL DEFAULT 'classic'` (`:56`). None documented.
- **§7.4 `invitations`** — schema adds `team_role_type VARCHAR(50)` (`:176`) and `link_metadata JSONB` (`:180`). Not documented.
- **§7.7 `club_settings`** — schema adds `allow_coach_invite_players BOOLEAN NOT NULL DEFAULT TRUE` (`:287`). Not documented.
- **§7.10 `team_coaches`** — schema adds `ended_at TIMESTAMPTZ` (`:374`, assignment history). Not documented.
- **§7.15 `files`** — schema adds `team_id` + `player_id` nullable FKs (`:528–529`) and indexes `idx_files_team_id`, `idx_files_player_id` (`:545–546`). Not documented.
- **§7.16 `announcements`** — schema adds `pinned` + `important` booleans (`:557–558`). Not documented.
- **§7.21 `events`** — `team_id` is **DEPRECATED, do not read** (`:673–676`); schema adds `audience_scope VARCHAR(20) NOT NULL DEFAULT 'TEAMS'` ('CLUB_WIDE' | 'TEAMS', `:679`). Doc still presents `team_id` as the audience pointer.
- **§7.13 `player_accounts`** — prose says "managed by … their **guardian**"; the "parent/guardian account" concept was eliminated (login entity is `PlayerAccount`; `is_primary_guardian` survives only as a flag on `player_account_links`, `:500`). Minor prose fix.

Verified **not** divergent: §7.52–7.57 platform tables, `announcement_reads` (§7.57), money/Decimal types, `@db.Inet`, evaluation/billing/waiver tables. Doc-only/optional: `reminder_jobs` (§6) is not implemented.

### soccer_club_uiux_page_spec.md  (source: actual routes under `src/app/`)

Actual route tree: `(auth)` = sign-in / forgot-password / reset-password / accept-invite;
`(app)` = dashboard (+admin|club|coach|player), clubs, users, system-settings,
platform-announcements, audit-logs, seasons, teams(+[teamId]), players(+[playerId]),
player-accounts(+[accountId]), coaches(+[coachId]), schedule(+new,[eventId]),
attendance(+[playerId]), announcements, chat(+[teamId]), documents,
evaluations(+compare, templates/[templateId], evaluate/[playerId]), development,
squad, my-kids/[playerId](+/evaluations, /roster/[teamId]), coach-notes, me, account.

Key divergences (AUTO-EDIT unless noted):
- **§9.1 / §4.4 naming** — "My Players" → **"My Kids"**, "Team Roster" → **"Squad"** (`src/app/(app)/layout.tsx:64–65`, `dashboard/player/page.tsx`, `my-kids/[playerId]/page.tsx`, `components/app/player/nav-items.ts`).
- **§3.1 shell** — doc says "common shell"; code has **two** shells by role: Console (sidebar + glass header, unthemed) for MASTER/CLUB/COACH and a themed **Player app** shell with bottom tabs (`layout.tsx:130–189`, `components/app/player/player-app-shell.tsx`). Player app has a Vibrant/Classic appearance switch (`lib/appearance.ts`, `me/page.tsx`).
- **§3.1 user menu** — top-bar carries a multi-role **identity switcher** (`components/app/account-menu.tsx`), not a "Switch Player Profile Context"; child/profile switching is an on-page pill row (`squad/page.tsx`, `dashboard-identity-row`).
- **§3.2 context switching** — child switch is **pills + `?child=` URL param + cookie**, no "All Players" summary (`squad/page.tsx:42–43`, `dashboard/player/page.tsx:48`).
- **§4.1 master nav** — actual: Dashboard, Clubs, Coaches, Users, Platform Announcements, Audit Logs, System Settings (`layout.tsx:23–31`). No "Plans/Feature Flags", no "Support/Impersonation".
- **§4.2 club-admin nav** — actual: Dashboard, Seasons, Teams, Players, Player Accounts, Coaches, Schedule, Attendance, Announcements, Team Chat, Documents, Evaluations, Audit Logs, Settings (`layout.tsx:32–51`). Registration/Payments/Waivers are placeholder labels (no route); Reports aliases the dashboard; no AI Assistant.
- **§4.3 coach nav** — actual: Dashboard, Team Roster (→`/players`), Schedule, Attendance, Team Chat, Announcements, Evaluations (compare→`/evaluations/compare`), Development, Documents (`layout.tsx:52–62`). No standalone Radar Comparison, no AI Assistant.
- **§4.4 player nav** — actual tabs: Home, Squad, Play (Schedule), Chat, Notes (rail), Notifications (bell), Me (`components/app/player/nav-items.ts:25–33`). No Registration/Payments/Waivers.
- **§6.3 Club Detail** — **no `clubs/[clubId]` route exists**; clubs managed entirely on the `/clubs` list page (`clubs/page.tsx`). No impersonation.
- **§6.x master pages** — undocumented master surfaces exist: Coaches (`coaches/page.tsx`), Platform Announcements (`platform-announcements/page.tsx`), System Settings (`system-settings/page.tsx`).
- **§7.3 team detail** — tabs reduce to Overview / Coaches / Schedule + permanent **Delete team** (`teams/[teamId]/page.tsx:144–148`). §7.5 player detail: Profile / Guardians / Schedule + **Delete player** (`players/[playerId]/page.tsx:241`).
- **§7.9 / §8.3 schedule** — single **month calendar** (no week/agenda/list toggles); events target CLUB_WIDE or multi-team checkbox list; coaches limited to assigned teams (`schedule/event-form.tsx:100–121`, `schedule/new/page.tsx:19`).
- **§8.2 coach roster** — scoped to a **single active team** (`ctx.activeTeamId`); empty if none selected, never a union (`players/page.tsx:23–60`).
- **§10.1 confirmation modal** — deletes are **permanent hard-deletes captured as audit snapshots; no restore/undo** anywhere (`audit-logs/page.tsx:71`; no restore/trash UI in `src/components`).
- **§8.6 chat** — named **"Team Chat"**; only team threads exist (`chat/page.tsx:22`).
- **§9.5 player roster** — folded into the **Squad** tab (`squad/page.tsx`), not a standalone page; uses `listSafeTeamRoster` projection.
- **§11.1 mobile nav** — player bottom tabs are Home/Squad/Play/Chat/Me; no Payments/More.
- **Whole sections unbuilt** (DOCUMENTED-BUT-NOT-BUILT): Payments, Waivers, Registration, Reports (standalone), AI Assistant — placeholder nav labels only. Flagged, not deleted.

### soccer_club_frontend_component_spec.md  (source: `src/components/`)

Real folders: `ui/` (shadcn primitives), `console/` (admin/coach design system, barrel `console/index.ts`), `app/` (+`app/player/`, `schedule/`). The doc's `layout/ forms/ tables/ charts/ feedback/ guards/ features/*` tree does not exist (Glob `src/components/**/*.tsx`).

Concrete contradictions (AUTO-EDIT):
- **§5.1 Button** — variants are `default|destructive|outline|secondary|ghost|link` (no `primary`), sizes `default|sm|lg|icon` (no `xs/md`); no `loading/iconLeft/iconRight/fullWidth` props (`ui/button.tsx`).
- **§5.2 Input / §5.4 Select** — native wrappers (`ui/input.tsx`, `ui/select.tsx`); no label/hint/error props, no searchable/async/grouped select.
- **§5.11 Badge → StatusBadge** — `{status, className}`, tone derived from status string; no `variant` prop (`console/status-badge.tsx`).
- **§5.13 Card / §10.1 SummaryCard** — Card is shadcn slots (no variant); SummaryCard props are `{label,value,hint?,href?,labelPosition?,labelTone?,className?}` — not `{title,value,subtitle,icon,trend,onClick}` (`console/summary-card.tsx`).
- **§5.15/5.16 Modal+Drawer** — one component `console/dialog.tsx` with `variant:'drawer'|'center'`; helpers `AddModal`, `DeleteConfirmDialog`, `EventDetailDrawer`.
- **§6.5 PageHeader** — `{title, description?, actions?, className?}` (uses `description`, not `subtitle`; no `breadcrumbs`) (`console/page-header.tsx`).
- **§6.x layout** — two shells (`ConsoleSidebar`+`ConsoleMobileNav` vs `PlayerAppShell`+`BottomTabBar`/`SideRails`); no single `AppShell`, no `TopBar`/`SectionHeader` components.
- **§7 guards** — no client `RoleGuard`/`ScopeGuard`/`FeatureFlagGuard`; gating is server-side + pre-filtered nav.
- **§8.1 DataTable** — props `{columns,rows,getRowKey,onRowClick?,loading?,error?,emptyMessage?,...}`; no sorting/pagination/selection/card-collapse; `Column={key,header,cell,className?}` (`console/data-table.tsx`).
- **§19 NotificationBell → AnnouncementsBell** — `{initialCount, variant:'icon'|'tab'}` (`app/announcements-bell.tsx`).
- **Primitives documented-but-absent** (DOCUMENTED-BUT-NOT-BUILT): Textarea, MultiSelect, Checkbox, RadioGroup, DatePicker, FileUploader (only `PhotoUpload`), Avatar (folded into `PersonCell`), Tooltip, Skeleton (inline), Toast (inline `role=alert`). Whole feature sections (§13 Registration, §14 Billing, §15 Waiver, §16 Chat, §17 Eval, §18 AI, §19 Notification list/prefs) unbuilt.
- **"parent" terminology stale** — role/nav/RSVP usages and `parent_safe`/`ParentSummary` should be "player"/"player-safe" (commit `5528d10`).
- **Undocumented-but-built components**: `TwoPane`, `ListContainer`, `ScrollPanel`, `AddModal`, `DeleteConfirmDialog`, `IdentitySwitcher`, `DashboardIdentityRow`, `AccountMenu`, `SelectRoleGate`, `InviteLinkDialog`, `Sparkline`, `CoachQuickTiles`, player `widgets.tsx`, `AppearanceSwitcher`/`PlayerThemeProvider`, `ToggleSwitch`.

### deletion-spec.md  (source: deletion/restore services)

The code implements **hard delete** for Player/Coach/Team, CLUB_ADMIN-only, with immutable audit snapshots — matching the spec's core model. Detail divergences (AUTO-EDIT):

- **§2.3 last-player case** — deactivation triggers on **zero remaining active child links** (`roster/service.ts:341–352`), not "last active role of any kind"; the "zero roles of any kind" test governs only **session deletion** (`:356–360`).
- **§3.2 step 5 (coach)** — coach-authored evaluations/attendance/chat are **left intact** (authorship is scalar `created_by`/`recorded_by_user_id`, no FK; coach `User` row is never deleted). `deleteCoach` only deletes `team_coaches` + deactivates the club COACH assignment (`coaches/service.ts:248–307`).
- **§4.1 step 4 (team)** — files + development goals are **detached** (`team_id` nulled, `clubs/service.ts:477,480`), not deleted; only team-exclusive events/announcements deleted, CLUB_WIDE/multi-team detached; **"formation" does not exist** anywhere.
- **§2.1 (player) chat line** — player deletion has no chat authorship to anonymize (chat is authored by the `User`/login, not the `Player` profile); code instead detaches `invoices.player_id` (`roster/service.ts:331`).
- **NOTE (no edit):** `Player`/`Team` retain unused `deleted_at`/`deleted_by` columns (`schema.prisma:413–414, 340–341`) — vestiges of the revoked soft-delete model; behavior is still hard-delete.

### RUNBOOK.md  (source: `package.json`, CI, `prisma.config.ts`, `env.ts`)

- **npm → pnpm everywhere** — `package.json` `packageManager: pnpm@11.5.1`; CI uses `pnpm`; CLAUDE.md mandates pnpm. All `npm`/`npx run` invocations in §2–§7 diverge (AUTO-EDIT).
- **§3 named migration** — `npm run db:migrate -- --name <x>` → `pnpm exec prisma migrate dev --name <x>` (per CLAUDE.md).
- **§4 Vercel build** — build is `vercel-build` = `prisma migrate deploy && prisma generate && next build`; manual apply via `pnpm db:deploy` (`package.json`).
- **§1 Node range** — `engines.node` is `">=22.12 <23 || >=24"` (24+ allowed, 22.12 floor); doc says only "Node 22 LTS".
- Verified correct: env-var table vs `src/lib/env.ts`, `prisma.config.ts` uses `DIRECT_URL`, test paths, seed prod-skip/`SEED_DEMO=1`.

## TIER B

### soccer_club_rbac_matrix.md  (source: `src/lib/rbac/*`, module services)

AUTO-EDIT (code adds a new gated surface or is *more* restrictive):
- **Hard deletion** — `player.delete`/`coach.delete`/`team.delete` are **CLUB_ADMIN-only**; Master Admin deliberately excluded (`rbac/permissions.ts:42–48`; enforced in roster/coaches/clubs services). Matrix only documents Archive.
- **Player remarks** — `remarks.manage` (MASTER/CLUB/COACH-TEAM) + `remarks.view_own_child` (PLAYER-CHILD); player sees only own-child **and** player-visible (`remarks/service.ts:71,120,224`). Undocumented.
- **Platform announcements** — authoring is **MASTER_ADMIN-only** (`announcements/platform-actions.ts` `requireRoleOrThrow("MASTER_ADMIN")`); others are recipients. Undocumented.
- **Multi-team event audience** — write requires `events.manage` on **every** targeted team; coaches can't target unassigned teams; club-wide is admin-only (`events/service.ts:139–154,371–372`). Matrix implies single-team.
- **Player appearance theme** — player-only; Console unthemed (`lib/appearance.ts`, `me/appearance-actions.ts`). Undocumented.
- **Coach evaluation config view** — `evaluations.view_config` grants COACH **CLUB** scope (all club templates/criteria, read-only); cycles narrowed to club-wide+assigned (`rbac/permissions.ts:87`, `evaluations/service.ts:45,60,147,164`). Matrix says "active template for assigned team".

FLAG → POSSIBLE ACCESS LEAKS (code *broader* than doc — NOT auto-edited): see Stage 3.

## TIER C / D

See Stage 3 flags below.

---

# STAGE 3 — FLAGS (not auto-edited)

## POSSIBLE ACCESS LEAKS (Tier B — code grants BROADER access than the matrix; needs human review)

These were **deliberately not** written into the RBAC matrix as "correct." Code grants
access the matrix hedges or gates; a product decision is needed on whether the code or
the doc is right.

1. **Team chat read/write is unconditional for Master/Club Admin.**
   - Matrix (§6.11 `View Team Chat` / `Send Team Message`) hedges: "Yes **if
     support/audit policy permits**" / "**where permitted**".
   - Code: `chat.view_team` + `chat.send_team` grant `MASTER_ADMIN:"SYSTEM"`,
     `CLUB_ADMIN:"CLUB"` with **no** policy/setting gate (`src/lib/rbac/permissions.ts:102-113`);
     `comms/service.ts` `listMessages`/`postMessage` only call `assertCan(...)`. Admins can
     always read and post in any team chat.

2. **Player team-chat send is unconditional.**
   - Matrix (§6.11 `Player-to-Player Messaging` / `Send Team Message`): "Player: Allowed
     **only if club setting enables it**".
   - Code: `chat.send_team` grants `PLAYER:"CHILD"` unconditionally
     (`permissions.ts:108-113`); `postMessage` (`comms/service.ts:400-411`) has **no**
     club-setting gate. No `allow_player_to_player_chat`-style flag is wired to chat send.

3. **(NOTE, lower-confidence) Development player-visible notes have no club gate.**
   - Matrix (§6.19 `View Player-Visible Notes`): "Player: ... **if club enables
     development view**".
   - Code: `development.view_own_child` (`permissions.ts:94`) is own-child scoped, but no
     development-specific club-setting gate was found in the services reviewed (only
     `allowPlayerEvaluationView` gates *evaluation* summaries). Not a confirmed over-broad
     read — flagged for a maintainer to confirm whether the promised gate should exist.

## CODE DIVERGES FROM INTENT (Tier C — flag only; requirements NOT rewritten)

- **`soccer_club_app_requirements.md`**
  - "Parent / Guardian" role (§4.4, §6.5) → code has no `PARENT` role; the role enum is
    `MASTER_ADMIN/CLUB_ADMIN/COACH/PLAYER` (`src/lib/rbac/roles.ts:7`; commit `5528d10`).
    Guardianship survives as a link flag, not a role.
  - "Deletion should be soft-delete where possible" (§12 rule 8; §19.7) → code is
    **hard-delete** with audit snapshots (`docs/deletion-spec.md:13`).
  - REST API surface (§11) and "Node.js / NestJS / Express; WebSocket service" (§16) →
    code is Next.js Server Actions + modular monolith (no NestJS, no separate WS service).
- **`soccer_club_app_requirements_phase2.md`**
  - Built: evaluations + position weights + radar + development (§7, §11); scheduling +
    RSVP + attendance (§8); notifications/remarks bell (§10.4).
  - **Not built as features:** Registration (§9.1–9.3), Payments/billing (§9.4–9.5),
    Waivers (§9.6) — schema tables exist and the master dashboard reads counts
    (`src/modules/master/service.ts:113-117`), but there is no service/UI. AI Assistant
    (§12) and native mobile (§10) are absent.
- **`soccer_club_implementation_plan.md`**
  - Stale tech assumptions (§3: "NestJS + TypeScript backend ... REST API first").
  - Phase sequence diverges from shipped order: the plan places Registration/Billing/
    Waivers (its Phase 6) and AI (its Phase 9) *before/around* Evaluations (its Phase 7),
    but the build shipped Evaluations and skipped Registration/Billing/Waivers and AI.

## STALE BY DESIGN — divergences noted, not changed (Tier D)

The project intentionally diverges from these; bodies were **not** edited.

- **`soccer_club_technical_architecture.md`** — old NestJS/REST/WebSocket design.
  Proof: "Node.js + NestJS (preferred for modularity), or Express" (line ~66); "REST API
  first / WebSocket gateway for team chat and live notifications" (lines ~68-69).
- **`soccer_club_api_contract.md`** — REST contract; project uses Server Actions. Proof:
  base URL `/api/v1` (line ~22); "Bearer access token ... Refresh token via secure
  cookie" (lines ~37-42).
- **`soccer_club_openapi.yaml`** — REST OpenAPI 3.0.3 spec. Proof: `openapi: 3.0.3`
  (line 1); `servers: - url: /api/v1` (lines ~16-17); `paths: /auth/login: post:` under
  `security: - bearerAuth: []`.
- **`soccer_club_sample_seed_data.md`** — not reconciled (illustrative seed data;
  authoritative seed is `prisma/seed.ts`). Left as-is.

## NEEDS HUMAN DECISION

- None blocking. The three POSSIBLE ACCESS LEAKS above are the items where it is unclear
  whether the doc or the code is correct; they were left for a product/security call
  rather than edited in either direction.

## DOCUMENTED-BUT-NOT-BUILT (kept, flagged in-place)

Feature areas described in the UI/UX and component specs with no corresponding code,
now marked "not implemented / forward-looking" in those docs (sections preserved):
Registration, Payments/Billing, Waivers, AI Assistant, standalone Reports; and the
absent component primitives (Textarea, MultiSelect, Checkbox, RadioGroup, DatePicker,
generic FileUploader, Avatar, Tooltip, Skeleton, Toast, FormField/FormSection,
client guard components).

---

# STAGE 4 — CHANGELOG

## Docs edited (Tier A — descriptive)
- **soccer_club_database_schema.md** — added `sessions`/`accounts`/`verifications`,
  `event_teams`, `player_remarks`; updated `users` (name/image, nullable password_hash,
  appearance_theme), `invitations` (team_role_type, link_metadata), `club_settings`
  (allow_coach_invite_players), `team_coaches` (ended_at), `files` (team_id, player_id +
  indexes), `announcements` (pinned, important), `events` (audience_scope; team_id
  deprecated); fixed §7.13 "guardian" prose and the §6 Identity/Schedule lists.
- **soccer_club_uiux_page_spec.md** — two-shell model + appearance theme (§3.1); user
  menu + child-pill switching (§3.1/3.2); master/club/coach/player nav (§4.1–4.4); club
  detail not-built (§6.3); added master Coaches/Platform Announcements/System Settings
  (§6.6–6.8); team/player detail tabs + delete (§7.3/7.5); single-view schedule + multi-
  team targeting (§7.9/8.3); single-active-team coach roster (§8.2); "Team Chat" naming
  (§8.6/9.6); My Kids / Squad (§9.1/9.5); permanent-deletion confirm (§10.1); player
  bottom nav (§11.1); not-built banners on Registration/Payments/Waivers/Reports/AI.
- **soccer_club_frontend_component_spec.md** — actual folder structure (§4); corrected
  Button/Input/Select/Badge/Card/Modal+Drawer/PageHeader/DataTable/TableColumn/PersonCell/
  SummaryCard/AnnouncementsBell to real props; documented the two shells + nav (§6);
  server-side guard note (§7); status notes on absent primitives (§5.5–5.20) and unbuilt
  feature sections (§12.5, §13–§18); parent→player rename; added "built components not
  catalogued" appendix (§19a).
- **deletion-spec.md** — last-player deactivation threshold (§2.3); player chat/invoice
  cleanup (§2.1); coach-content survival (§3.2); team detach-vs-delete cascade + removed
  "formation" (§4.1).
- **RUNBOOK.md** — npm→pnpm throughout (§2–§7); named-migration form (§3); vercel-build
  migration step (§4); Node engines range (§1).

## Docs edited (Tier B — RBAC, safe direction only)
- **soccer_club_rbac_matrix.md** — added Appearance/Theme (§6.1), Delete Team (§6.4),
  Delete Coach (§6.5), Delete Player (§6.6), Platform Announcements (§6.10), event
  audience model on Create/Edit/Cancel Event (§6.12), coach club-scoped eval-config view
  (§6.18), and a new Player Remarks module (§6.19a).

## Docs edited (Tier C exception — status + factual currency)
- **BUILD_PLAN.md** — added per-phase implementation-status markers in §4; corrected the
  locked-stack package manager (npm → **pnpm** `@11.5.1`, `pnpm-lock.yaml`) in §1 + Phase
  0; resolved the realtime-transport decision note (short polling); updated the §2 repo
  structure to the shipped module set (`comms` split into chat + `announcements`;
  scheduling in `events`; added `coaches`/`remarks`/`files`/`master`/`audit`; `reporting`
  and `schedule` dirs are placeholders). No planned-phase scope rewritten.

## Flags raised (no edit)
- 2 confirmed POSSIBLE ACCESS LEAKS (admin + player team chat unconditional) + 1 lower-
  confidence note (development club gate).
- Tier C intent divergences in 3 requirement/plan docs.
- Tier D stale-by-design: technical_architecture, api_contract, openapi.yaml (+ seed
  data left as-is).

## Commits
1. `docs(reconcile): align Tier A descriptive docs with shipped implementation`
2. `docs(reconcile): update RBAC matrix for new gated surfaces`
3. `docs(reconcile): BUILD_PLAN phase status + reconciliation report`
