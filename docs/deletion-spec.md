# Deletion Specification — Club Admin (Players, Coaches, Teams)

**Status:** Locked
**Actor:** Club Admin only
**Non-actor:** Master Admin has **no role** in deletion and MUST NOT be granted delete capability for these entities.

This document is normative. **MUST / MUST NOT / SHOULD** carry their usual strict meaning. Where it conflicts with older spec docs, **this document wins**.

---

## 0. Global Principles

1. **All deletions are HARD (permanent).** There is **no soft-delete, no Archived view, no Restore, no retention window, and no auto-purge** for player, coach, or team deletion. Once deleted, data is gone.
2. **Every deletion MUST be gated** by a typed-name confirmation (the admin types the exact name of the entity being deleted before the action is enabled).
3. **Every deletion MUST be audited** with a denormalized snapshot (see §5). Because nothing is recoverable, the audit log is the **only** record that the entity ever existed.
4. **The two—and only two—safety mechanisms are: the typed-name gate and the immutable audit log.** There is no undo.
5. **RBAC:** every delete path MUST start with `requireRole(CLUB_ADMIN)` + `assertClubScope`. Business logic and authorization live in the service layer; server actions are thin wrappers.
6. **Role model (post-rename — landed terminology):** the "parent" role has been removed; the single role is **`PLAYER`**. The login that signs in is a **`PlayerAccount`** (table `player_account_links`); the athlete profile is a **`Player`**.
   - Adult player → invited on their own email; the `PlayerAccount` is theirs.
   - Minor player → invited via the **parent's/guardian's email**, which becomes the contact/login on the minor's `PlayerAccount` (the minor has no email yet). There is **no separate "parent" role or account**.
   - One `PlayerAccount` MAY map to **multiple `Player` profiles** (siblings sharing a guardian email).
   - **Guardianship ≠ the old parent role.** A genuine guardianship relationship is retained — `isPrimaryGuardian`, `relationshipType`, and the `inviteGuardian` / `linkGuardian` actions. This is the real player↔account linkage and is **not** what was deleted; do not conflate "no parent role" with removing guardianship.
7. **Minor data:** the platform stores minors' data. Permanent erasure on delete is **intentional** (data minimization), which is the rationale for hard-delete over soft-delete.

---

## 1. Common Mechanics

### 1.1 Typed-name gate
- The confirm dialog MUST require the admin to type the entity's exact display name. The destructive action stays disabled until it matches.
- The dialog MUST state the consequences in plain language, computed from live data (see each entity's "impact" rules).

### 1.2 Hard delete + FK cleanup
- "Hard delete" = the row is physically removed from the database.
- Every table that references the deleted row via a foreign key MUST be handled in the **same transaction**, via one of:
  - **Cascade-delete** — child rows that are meaningless without the parent are deleted.
  - **Set-null** — rows that should survive but lose the reference are nulled/anonymized.
  - (No path may leave a dangling foreign key or orphaned row.)
- The exact Prisma model/relation names and `ON DELETE` behavior MUST be verified against the live schema during implementation recon before any delete code is written.

### 1.3 Audit snapshot
- Each deletion MUST call `recordAudit` writing a **denormalized snapshot** of identifying fields *into the audit row* (because the source row will no longer exist to join against). See §5.

### 1.4 Login deactivation rule
- A login MUST be deactivated **only when it has zero remaining active roles of any kind** (not merely zero players, not merely zero coach assignments).
- A deactivated login, on sign-in attempt, MUST be shown a clear message (e.g. *"You are not part of any teams or roles."*) and MUST NOT be granted a portal session.
- A login that still holds another active role (e.g. an active coach who was also a guardian) MUST retain access to that role only.

---

## 2. Player Deletion

**Type:** HARD · gated · audited · **no undo**

### 2.1 Flow
1. Club Admin initiates delete on a player.
2. **Typed-name gate** — admin types the player's name.
3. **Hard delete** the player row.
4. **FK cleanup** (same transaction) across all player-referencing data:
   - team memberships → delete
   - evaluations, attendance, development goals, documents → delete (or null/anonymize where a record must survive)
   - invoices → set-null on `player_id` (the financial record survives, detached)
   - (chat is authored by the `User`/`PlayerAccount` login, not the `Player` profile, so a player deletion has no chat authorship to anonymize)
   - the `Player`↔`PlayerAccount` link row (`player_account_links`) → delete (this is the guardianship/account linkage; deleting it does NOT delete the `PlayerAccount` itself unless §2.3 applies)
   *(Exact tables + cascade-vs-null decisions verified against schema at implementation time.)*
5. **Standalone** — nothing else cascades. There is no separate "parent" entity; only the `Player` profile (and its account links) are affected. The `PlayerAccount` survives unless this was its last linked player (§2.3).
6. **Audit** — write snapshot (§5).

### 2.2 Sibling case (one `PlayerAccount`, multiple players)
- Deleting one player MUST leave the other sibling `Player` profiles and the shared `PlayerAccount` intact.
- The player switcher MUST collapse accordingly (e.g. 2 → 1; the switcher hides when only one player remains).

### 2.3 Last-player case (1 → 0)
- If the deleted player was the `PlayerAccount`'s **last active child link**, the `PlayerAccount` (and its now-spent club `PLAYER` role assignment) MUST be deactivated. Separately, if the underlying login is then left with **zero active roles of any kind** (no role assignments and no coach assignments), its live sessions MUST be deleted per §1.4.

---

## 3. Coach Deletion

**Type:** HARD · gated · audited · **no undo**
Coaches were previously soft-deleted; that is **revoked**. Coach deletion is now hard, with no archive, retention, or restore.

### 3.1 Pre-delete impact warning (computed, per team)
- The confirm dialog MUST compute and display, for **every** team the coach is on, the real effect:
  - Coach is the **last** coach on a team → *"Team X will be left without any coach until you reassign one."*
  - Other coaches remain → *"Team X will still have [Coach Name]."* (No "coachless" warning when coverage remains.)
- MUST NOT label a team coachless unless removing this coach leaves it with **zero** coaches.
- Terminology: a team with no coach is a **coachless team** — distinct from an "orphan club" (a club with no admin). Keep the labels separate.

### 3.2 Flow
1. Club Admin initiates delete on a coach.
2. Show the computed per-team impact warning (§3.1).
3. **Typed-name gate** — admin types the coach's name.
4. **Hard delete** the coach row + **clear all assignment rows** (teams survive).
5. **FK cleanup** (same transaction): `team_coaches` rows → delete; the club `COACH` `user_role_assignment` → deactivate. Coach-authored content (evaluations, attendance, chat) is **left intact** — authorship is a scalar `created_by` / `recorded_by_user_id` with no FK, and the coach's `User` row is never deleted, so there is nothing to cascade or null.
6. **Immediate access revocation** — block coach-portal sign-in **and** invalidate any live session (not just next login). Apply the login deactivation rule (§1.4): no other active role → deactivate login; also an active guardian/player → revoke coach access only.
7. **Audit** — write snapshot (§5).

---

## 4. Team Deletion

**Type:** HARD · gated · audited · **no undo** · **detach-only for members**
Teams were previously soft-deleted; that is **revoked**. The team row is now hard-deleted. **No player or coach record is ever deleted by a team deletion** — they are detached.

### 4.1 Flow
1. Club Admin initiates delete on a team.
2. **Typed-name gate** — admin types the team's name. Dialog states that the team and its data will be permanently removed and that players/coaches will be detached (not deleted).
3. **Detach members:**
   - **Players** → remove their membership for this team → they become **teamless** (record fully intact). Players on other teams keep those memberships.
   - **Coaches** → remove their assignment for this team. Coach on other teams → kept there; coach on no other team → marked **unassigned**.
4. **Hard delete the team row + team-owned data** (same transaction): memberships, `team_coaches`, team-scoped `user_role_assignment` rows, `event_teams` links, team-exclusive events (and their RSVPs/attendance/attachments), team-exclusive announcements, team chat (messages/members/attachments), and team-scoped evaluations + cycles. Survivors that merely reference the team are **detached, not deleted**: development goals (`team_id` nulled), files (`team_id` nulled — blobs out of scope), club-wide / multi-team events (`events.team_id` nulled), and pending invites scoped to this team (`team_id` nulled). (There is no "formation" entity.)
   *(Exact tables + cascade-vs-null decisions verified against schema at implementation time.)*
5. **Audit** — write snapshot (§5), including the count of players detached and coaches unassigned.

> Net effect: only the **team + its own data** are erased. Every player and coach record survives — players move to the teamless pool, coaches to unassigned (unless still on another team).

---

## 5. Audit Log (Club Admin)

A club-scoped audit log is **required**, not optional — it is the sole post-deletion record.

### 5.1 Properties
- **Club-scoped** (the admin's club only, via `assertClubScope`).
- **Read-only** and **immutable** — entries cannot be edited or deleted.
- Covers **all privileged actions** in the club (creates, edits, assignments, deletions) — not deletions only.
- Built on the existing `recordAudit` infrastructure + a new club-scoped query/page (mirrors the Master-Admin-level audit pattern).

### 5.2 Snapshot requirement
- Every deletion entry MUST denormalize identifying fields into the audit row, e.g.:
  - **Player:** name, jersey #, team name(s), player id, login email.
  - **Coach:** name, affected team name(s), coach id, login email.
  - **Team:** team name, team id, # players detached, # coaches unassigned.
- Snapshots make entries permanently readable even though the referenced rows no longer exist.

---

## 6. Teamless Players

- **Definition:** a player with **zero active team memberships** within their club.
- **Coach add-player picker:** when a coach adds players to their team, they MUST be able to see players not currently on any team. This list MUST be club-scoped and use parent-safe projections (a coach sees only their own club's teamless players).
- **Club Admin players list:** MUST include a dedicated **"Unassigned / No team"** section listing teamless players; admin SHOULD be able to assign them to a team directly from there.

---

## 7. Non-Goals / Out of Scope

- Master Admin deletion of any of these entities.
- Soft-delete, Archived view, Restore, retention windows, auto-purge cron — all explicitly removed.
- Billing, registration, waivers, payments.
- Any REST envelope (server actions + service layer only).

---

## 8. Implementation Guardrails

- Conform to the **actual codebase**, not older spec docs.
- All authorization + cascade logic lives in the **service layer**; server actions stay thin (the future mobile app reuses the services).
- Validate action inputs with **Zod**.
- Before writing delete code, run a **recon pass** to confirm exact model names, every FK that references player/coach/team, and the correct `ON DELETE` behavior for each — then STOP and report before implementing.
- Hard deletes MUST run inside a transaction so partial cleanup can't leave orphans.
