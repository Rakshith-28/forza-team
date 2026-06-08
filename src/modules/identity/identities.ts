import "server-only";

import { cache } from "react";

import { prisma } from "@/db/client";
import { isRole, ROLE_LABELS, ROLE_PRIORITY, type Role } from "@/lib/rbac/roles";

/**
 * An **Identity** is one selectable "who am I acting as right now" entry — the
 * unit behind the post-login "Select Role" popup and the top-bar identity
 * switcher. Each is a `(role, club, optional team for a coach, optional child
 * for a parent)` tuple with a stable {@link Identity.key} used in the cookie and
 * the switcher form value.
 *
 * Unlike {@link AuthContext} (which is role-wide within the active club), an
 * Identity narrows to a single target so a coach of two teams or a parent of two
 * children gets one entry per team/child — matching how the picker is presented.
 * The team/child only changes which target the UI focuses on; it never widens or
 * narrows authorization, which the service layer still derives from the role.
 */
export interface Identity {
  /** Stable, parseable key: `role|clubId|teamId|playerId` (empty segments allowed). */
  key: string;
  role: Role;
  /** Active tenant for this identity. null only for MASTER_ADMIN (system-scoped). */
  clubId: string | null;
  /** COACH: the focused team (null for a coach not yet assigned to any team). */
  teamId: string | null;
  /** PARENT: the focused child. */
  playerId: string | null;
  /** Role display, e.g. "Coach". */
  roleLabel: string;
  /** Target display, e.g. "Mavericks FC U14 Boys" or "Sohaan Gowda". */
  contextLabel: string;
  /** Club name for the identity (null for a system MASTER_ADMIN). */
  clubName: string | null;
}

const SEP = "|";

/** Format a stable identity key from its coordinates. */
export function identityKey(parts: {
  role: Role;
  clubId?: string | null;
  teamId?: string | null;
  playerId?: string | null;
}): string {
  return [parts.role, parts.clubId ?? "", parts.teamId ?? "", parts.playerId ?? ""].join(SEP);
}

/**
 * Parse a cookie key back into coordinates WITHOUT a DB round-trip — cheap enough
 * to run on every request. It only structurally validates the role segment; the
 * authoritative "does the user actually hold this" check happens when the context
 * loader filters by the parsed club/role and when the switcher action re-derives
 * the identity list. A forged/stale key therefore degrades safely (no access),
 * never escalates.
 */
export function parseIdentityKey(
  value: string | null | undefined,
): { role: Role; clubId: string | null; teamId: string | null; playerId: string | null } | null {
  if (!value) return null;
  const [role, clubId, teamId, playerId] = value.split(SEP);
  if (!isRole(role)) return null;
  return {
    role,
    clubId: clubId || null,
    teamId: teamId || null,
    playerId: playerId || null,
  };
}

/** Compose a player's display name (preferred name wins over first name). */
function playerName(p: { firstName: string; lastName: string; preferredName: string | null }): string {
  return `${p.preferredName?.trim() || p.firstName} ${p.lastName}`.trim();
}

/**
 * All identities a user can act as, across every club they belong to. The list
 * drives both the login popup and the top-bar switcher, and the switcher action
 * re-derives it as its authoritative guard (a chosen key must be present here).
 *
 * `cache()`-wrapped: per-request only, deduped across the shell layout and the
 * page that render the switcher.
 */
export const listUserIdentities = cache(async (userId: string): Promise<Identity[]> => {
  const [assignments, coachTeams, parents] = await Promise.all([
    prisma.userRoleAssignment.findMany({
      where: { userId, status: "ACTIVE" },
      select: {
        clubId: true,
        teamId: true,
        role: { select: { code: true } },
        club: { select: { id: true, name: true } },
        team: { select: { id: true, name: true } },
      },
    }),
    prisma.teamCoach.findMany({
      where: { userId, status: "ACTIVE" },
      select: {
        clubId: true,
        teamId: true,
        team: { select: { name: true } },
        club: { select: { name: true } },
      },
    }),
    prisma.parent.findMany({
      where: { userId, status: "ACTIVE" },
      select: {
        clubId: true,
        club: { select: { name: true } },
        playerLinks: {
          where: { status: "ACTIVE" },
          select: {
            player: { select: { id: true, firstName: true, lastName: true, preferredName: true } },
          },
        },
      },
    }),
  ]);

  const roleCodes = new Set(assignments.map((a) => a.role.code));
  const identities: Identity[] = [];
  const seen = new Set<string>();
  const push = (i: Identity) => {
    if (seen.has(i.key)) return;
    seen.add(i.key);
    identities.push(i);
  };

  // MASTER_ADMIN — a single, system-scoped identity (no club boundary).
  if (roleCodes.has("MASTER_ADMIN")) {
    push({
      key: identityKey({ role: "MASTER_ADMIN" }),
      role: "MASTER_ADMIN",
      clubId: null,
      teamId: null,
      playerId: null,
      roleLabel: ROLE_LABELS.MASTER_ADMIN,
      contextLabel: "All clubs",
      clubName: null,
    });
  }

  // CLUB_ADMIN — one identity per club managed.
  for (const a of assignments) {
    if (a.role.code !== "CLUB_ADMIN" || !a.clubId) continue;
    push({
      key: identityKey({ role: "CLUB_ADMIN", clubId: a.clubId }),
      role: "CLUB_ADMIN",
      clubId: a.clubId,
      teamId: null,
      playerId: null,
      roleLabel: ROLE_LABELS.CLUB_ADMIN,
      contextLabel: a.club?.name ?? "Club",
      clubName: a.club?.name ?? null,
    });
  }

  // COACH — one identity per coached team (from team_coaches and any
  // team-scoped role assignment). A coach with a COACH grant but no team yet
  // gets a single club-level coach identity so they can still act.
  const coachClubs = new Map<string, string | null>(); // clubId -> clubName
  for (const tc of coachTeams) {
    push({
      key: identityKey({ role: "COACH", clubId: tc.clubId, teamId: tc.teamId }),
      role: "COACH",
      clubId: tc.clubId,
      teamId: tc.teamId,
      playerId: null,
      roleLabel: ROLE_LABELS.COACH,
      contextLabel: tc.team?.name ?? "Team",
      clubName: tc.club?.name ?? null,
    });
    coachClubs.set(tc.clubId, tc.club?.name ?? null);
  }
  for (const a of assignments) {
    if (a.role.code !== "COACH" || !a.clubId) continue;
    if (a.teamId) {
      push({
        key: identityKey({ role: "COACH", clubId: a.clubId, teamId: a.teamId }),
        role: "COACH",
        clubId: a.clubId,
        teamId: a.teamId,
        playerId: null,
        roleLabel: ROLE_LABELS.COACH,
        contextLabel: a.team?.name ?? "Team",
        clubName: a.club?.name ?? null,
      });
      coachClubs.set(a.clubId, a.club?.name ?? null);
    } else if (!coachClubs.has(a.clubId)) {
      // COACH in this club but not assigned to any team yet.
      push({
        key: identityKey({ role: "COACH", clubId: a.clubId }),
        role: "COACH",
        clubId: a.clubId,
        teamId: null,
        playerId: null,
        roleLabel: ROLE_LABELS.COACH,
        contextLabel: a.club?.name ?? "Club",
        clubName: a.club?.name ?? null,
      });
    }
  }

  // PARENT — one identity per linked child.
  for (const parent of parents) {
    for (const link of parent.playerLinks) {
      push({
        key: identityKey({ role: "PARENT", clubId: parent.clubId, playerId: link.player.id }),
        role: "PARENT",
        clubId: parent.clubId,
        teamId: null,
        playerId: link.player.id,
        roleLabel: ROLE_LABELS.PARENT,
        contextLabel: playerName(link.player),
        clubName: parent.club?.name ?? null,
      });
    }
  }

  return identities.sort(byPriorityThenLabel);
});

/** Highest-privilege role first, then alphabetical by context — a stable order. */
function byPriorityThenLabel(a: Identity, b: Identity): number {
  const p = ROLE_PRIORITY[b.role] - ROLE_PRIORITY[a.role];
  if (p !== 0) return p;
  return a.contextLabel.localeCompare(b.contextLabel);
}

/** The default identity when the user hasn't chosen one (highest privilege). */
export function pickDefaultIdentity(identities: Identity[]): Identity | null {
  return identities[0] ?? null;
}

/** Resolve the identity a cookie key refers to, or the default, from a list. */
export function resolveIdentity(identities: Identity[], key: string | null | undefined): Identity | null {
  if (key) {
    const match = identities.find((i) => i.key === key);
    if (match) return match;
  }
  return pickDefaultIdentity(identities);
}
