import "server-only";

import { prisma } from "@/db/client";
import { Prisma } from "@/db/generated/client";
import { assertCan, assertClubScope, type AuthContext } from "@/lib/rbac/scope";
import { normalizePage, type Paginated, type PageParams } from "@/modules/master/schemas";

/**
 * Club-scoped, read-only audit log (the Club Admin mirror of the Master Admin
 * audit view in master/service.ts). It is the standing safety record for every
 * privileged action in a club — NOT just deletions — and is the only way to see
 * what a hard delete removed, since the source row no longer exists to join
 * against (the denormalized snapshot lives in `metadataJson.snapshot`).
 *
 * Two guards, defense-in-depth: `audit.view` (CLUB scope for a Club Admin) plus
 * `assertClubScope`, and the query is ALWAYS pinned to a single `clubId` — a
 * Club Admin can never read another club's entries by construction.
 */

/** One audit row, shape-compatible with the shared AuditTable. */
export interface ClubAuditRow {
  id: string;
  createdAt: Date;
  actorName: string | null;
  clubName: string | null;
  action: string;
  resourceType: string;
  resourceId: string | null;
  metadata: unknown;
  ipAddress: string | null;
}

export interface ClubAuditFilters extends PageParams {
  dateFrom?: Date;
  dateTo?: Date;
  actorUserId?: string;
  action?: string;
  resourceType?: string;
}

function actorName(u: { name: string | null; firstName: string; lastName: string; email: string }): string {
  return u.name?.trim() || `${u.firstName} ${u.lastName}`.trim() || u.email;
}

/** Audit entries for ONE club, newest first, with actor names resolved. */
export async function listClubAuditLog(
  ctx: AuthContext,
  clubId: string,
  filters: ClubAuditFilters = {},
): Promise<Paginated<ClubAuditRow>> {
  assertCan(ctx, "audit.view", { clubId });
  assertClubScope(ctx, clubId);
  const { page, pageSize, skip, take } = normalizePage(filters);

  // clubId is pinned — never taken from caller-supplied filters.
  const where: Prisma.AuditLogWhereInput = { clubId };
  if (filters.actorUserId) where.actorUserId = filters.actorUserId;
  if (filters.action?.trim()) where.action = { contains: filters.action.trim(), mode: "insensitive" };
  if (filters.resourceType?.trim())
    where.resourceType = { contains: filters.resourceType.trim(), mode: "insensitive" };
  if (filters.dateFrom || filters.dateTo) {
    where.createdAt = {};
    if (filters.dateFrom) where.createdAt.gte = filters.dateFrom;
    if (filters.dateTo) where.createdAt.lte = filters.dateTo;
  }

  const [total, logs] = await Promise.all([
    prisma.auditLog.count({ where }),
    prisma.auditLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip,
      take,
      select: {
        id: true,
        createdAt: true,
        actorUserId: true,
        action: true,
        resourceType: true,
        resourceId: true,
        metadataJson: true,
        ipAddress: true,
        club: { select: { name: true } },
      },
    }),
  ]);

  const actorIds = [...new Set(logs.map((l) => l.actorUserId).filter((x): x is string => !!x))];
  const actors = actorIds.length
    ? await prisma.user.findMany({
        where: { id: { in: actorIds } },
        select: { id: true, name: true, firstName: true, lastName: true, email: true },
      })
    : [];
  const actorById = new Map(actors.map((a) => [a.id, actorName(a)]));

  const rows: ClubAuditRow[] = logs.map((l) => ({
    id: l.id,
    createdAt: l.createdAt,
    actorName: l.actorUserId ? (actorById.get(l.actorUserId) ?? null) : null,
    clubName: l.club?.name ?? null,
    action: l.action,
    resourceType: l.resourceType,
    resourceId: l.resourceId,
    metadata: l.metadataJson,
    ipAddress: l.ipAddress,
  }));

  return { rows, total, page, pageSize };
}

/** Distinct action / resource-type / actor values WITHIN this club, for the filter dropdowns. */
export async function getClubAuditFilterOptions(
  ctx: AuthContext,
  clubId: string,
): Promise<{ actions: string[]; resourceTypes: string[]; actors: { id: string; name: string }[] }> {
  assertCan(ctx, "audit.view", { clubId });
  assertClubScope(ctx, clubId);

  const [actions, resourceTypes, actorRows] = await Promise.all([
    prisma.auditLog.findMany({ where: { clubId }, distinct: ["action"], select: { action: true }, orderBy: { action: "asc" } }),
    prisma.auditLog.findMany({ where: { clubId }, distinct: ["resourceType"], select: { resourceType: true }, orderBy: { resourceType: "asc" } }),
    prisma.auditLog.findMany({ where: { clubId, actorUserId: { not: null } }, distinct: ["actorUserId"], select: { actorUserId: true } }),
  ]);

  const actorIds = actorRows.map((r) => r.actorUserId).filter((x): x is string => !!x);
  const actorUsers = actorIds.length
    ? await prisma.user.findMany({
        where: { id: { in: actorIds } },
        select: { id: true, name: true, firstName: true, lastName: true, email: true },
      })
    : [];
  const actors = actorUsers
    .map((u) => ({ id: u.id, name: actorName(u) }))
    .sort((a, b) => a.name.localeCompare(b.name));

  return {
    actions: actions.map((a) => a.action),
    resourceTypes: resourceTypes.map((r) => r.resourceType),
    actors,
  };
}
