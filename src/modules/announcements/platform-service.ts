import "server-only";

import { prisma } from "@/db/client";
import { Prisma } from "@/db/generated/client";
import { recordAudit, recordAuditStandalone } from "@/lib/audit";
import { ForbiddenError, type AuthContext } from "@/lib/rbac";
import { normalizePage, type Paginated, type PageParams } from "@/modules/master/schemas";
import type {
  AnnouncementStatus,
  PlatformAnnouncementInput,
  PlatformTemplateInput,
  Severity,
} from "@/modules/announcements/platform-schemas";

/**
 * Platform announcements — Master Admin broadcasts above all tenants. Master
 * writes assert MASTER_ADMIN + audit; recipient resolvers enforce the caller's
 * own role/club scope. Visibility (live + audience) is computed at query time;
 * reads are tracked only on interaction (no per-user fan-out on publish).
 */

function assertMasterAdmin(ctx: AuthContext): void {
  if (ctx.role !== "MASTER_ADMIN") throw new ForbiddenError("Master Admin access required");
}

/** SQL-ish "live" predicate, shared by every recipient query. */
function liveWhere(now: Date): Prisma.PlatformAnnouncementWhereInput {
  return {
    deletedAt: null,
    AND: [
      { OR: [{ status: "PUBLISHED" }, { status: "SCHEDULED", scheduledAt: { lte: now } }] },
      { OR: [{ expiresAt: null }, { expiresAt: { gt: now } }] },
    ],
  };
}

/** Audience predicate for a specific caller (role + their active club). */
function audienceWhere(ctx: AuthContext): Prisma.PlatformAnnouncementWhereInput {
  const scopeOr: Prisma.PlatformAnnouncementWhereInput[] = [{ audienceScope: "ALL_CLUBS" }];
  if (ctx.activeClubId) {
    scopeOr.push({ audienceScope: "SPECIFIC_CLUBS", clubs: { some: { clubId: ctx.activeClubId } } });
  }
  return { AND: [{ audienceRoles: { has: ctx.role } }, { OR: scopeOr }] };
}

// ===========================================================================
// Master — CRUD
// ===========================================================================

function resolveCreateStatus(input: PlatformAnnouncementInput): {
  status: AnnouncementStatus;
  publishedAt: Date | null;
} {
  if (input.publishNow) return { status: "PUBLISHED", publishedAt: new Date() };
  if (input.scheduledAt) return { status: "SCHEDULED", publishedAt: null };
  return { status: "DRAFT", publishedAt: null };
}

export async function createPlatformAnnouncement(ctx: AuthContext, input: PlatformAnnouncementInput): Promise<string> {
  assertMasterAdmin(ctx);
  const { status, publishedAt } = resolveCreateStatus(input);

  return prisma.$transaction(async (tx) => {
    const created = await tx.platformAnnouncement.create({
      data: {
        title: input.title,
        body: input.body,
        severity: input.severity,
        audienceScope: input.audienceScope,
        audienceRoles: input.audienceRoles,
        status,
        pinned: input.pinned,
        publishedAt,
        scheduledAt: input.scheduledAt,
        expiresAt: input.expiresAt,
        createdBy: ctx.userId,
        ...(input.audienceScope === "SPECIFIC_CLUBS"
          ? { clubs: { createMany: { data: input.clubIds.map((clubId) => ({ clubId })) } } }
          : {}),
      },
      select: { id: true },
    });
    await recordAudit(tx, {
      action: "platform_announcement.create",
      resourceType: "platform_announcement",
      resourceId: created.id,
      actorUserId: ctx.userId,
      metadata: { title: input.title, severity: input.severity, status },
    });
    return created.id;
  });
}

export async function updatePlatformAnnouncement(
  ctx: AuthContext,
  id: string,
  input: PlatformAnnouncementInput,
): Promise<void> {
  assertMasterAdmin(ctx);
  const existing = await prisma.platformAnnouncement.findFirst({
    where: { id, deletedAt: null },
    select: { status: true },
  });
  if (!existing) throw new ForbiddenError("Announcement not found");
  if (existing.status !== "DRAFT" && existing.status !== "SCHEDULED") {
    throw new ConflictError("Only drafts or scheduled announcements can be edited.");
  }
  const { status, publishedAt } = resolveCreateStatus(input);

  await prisma.$transaction(async (tx) => {
    await tx.platformAnnouncementClub.deleteMany({ where: { platformAnnouncementId: id } });
    await tx.platformAnnouncement.update({
      where: { id },
      data: {
        title: input.title,
        body: input.body,
        severity: input.severity,
        audienceScope: input.audienceScope,
        audienceRoles: input.audienceRoles,
        status,
        publishedAt,
        scheduledAt: input.scheduledAt,
        expiresAt: input.expiresAt,
        pinned: input.pinned,
        updatedBy: ctx.userId,
        ...(input.audienceScope === "SPECIFIC_CLUBS"
          ? { clubs: { createMany: { data: input.clubIds.map((clubId) => ({ clubId })) } } }
          : {}),
      },
    });
    await recordAudit(tx, {
      action: "platform_announcement.update",
      resourceType: "platform_announcement",
      resourceId: id,
      actorUserId: ctx.userId,
    });
  });
}

/** Raised on an invalid state transition / edit; surfaced as a friendly error. */
export class ConflictError extends Error {
  readonly code = "CONFLICT";
  constructor(message: string) {
    super(message);
    this.name = "ConflictError";
  }
}

async function setStatus(ctx: AuthContext, id: string, action: string, data: Prisma.PlatformAnnouncementUpdateInput) {
  assertMasterAdmin(ctx);
  const existing = await prisma.platformAnnouncement.findFirst({ where: { id, deletedAt: null }, select: { id: true } });
  if (!existing) throw new ForbiddenError("Announcement not found");
  await prisma.$transaction(async (tx) => {
    await tx.platformAnnouncement.update({ where: { id }, data: { ...data, updatedBy: ctx.userId } });
    await recordAudit(tx, { action, resourceType: "platform_announcement", resourceId: id, actorUserId: ctx.userId });
  });
}

export function publishPlatformAnnouncement(ctx: AuthContext, id: string) {
  return setStatus(ctx, id, "platform_announcement.publish", { status: "PUBLISHED", publishedAt: new Date() });
}

export function archivePlatformAnnouncement(ctx: AuthContext, id: string) {
  return setStatus(ctx, id, "platform_announcement.archive", { status: "ARCHIVED" });
}

export function deletePlatformAnnouncement(ctx: AuthContext, id: string) {
  return setStatus(ctx, id, "platform_announcement.delete", { deletedAt: new Date(), deletedBy: ctx.userId });
}

export async function duplicatePlatformAnnouncement(ctx: AuthContext, id: string): Promise<string> {
  assertMasterAdmin(ctx);
  const src = await prisma.platformAnnouncement.findFirst({
    where: { id, deletedAt: null },
    include: { clubs: { select: { clubId: true } } },
  });
  if (!src) throw new ForbiddenError("Announcement not found");
  return prisma.$transaction(async (tx) => {
    const copy = await tx.platformAnnouncement.create({
      data: {
        title: `${src.title} (copy)`,
        body: src.body,
        severity: src.severity,
        audienceScope: src.audienceScope,
        audienceRoles: src.audienceRoles,
        status: "DRAFT",
        pinned: false,
        createdBy: ctx.userId,
        ...(src.audienceScope === "SPECIFIC_CLUBS"
          ? { clubs: { createMany: { data: src.clubs.map((c) => ({ clubId: c.clubId })) } } }
          : {}),
      },
      select: { id: true },
    });
    await recordAudit(tx, {
      action: "platform_announcement.duplicate",
      resourceType: "platform_announcement",
      resourceId: copy.id,
      actorUserId: ctx.userId,
      metadata: { from: id },
    });
    return copy.id;
  });
}

// ===========================================================================
// Master — list + detail (with read stats)
// ===========================================================================

export interface PlatformAnnouncementRow {
  id: string;
  title: string;
  severity: string;
  status: string;
  audienceScope: string;
  audienceRoles: string[];
  clubCount: number;
  pinned: boolean;
  publishedAt: Date | null;
  scheduledAt: Date | null;
  reads: number;
}

export interface PlatformAnnouncementFilters extends PageParams {
  search?: string;
  status?: AnnouncementStatus;
  severity?: Severity;
}

export async function getPlatformAnnouncements(
  ctx: AuthContext,
  filters: PlatformAnnouncementFilters = {},
): Promise<Paginated<PlatformAnnouncementRow>> {
  assertMasterAdmin(ctx);
  const { page, pageSize, skip, take } = normalizePage(filters);

  const where: Prisma.PlatformAnnouncementWhereInput = { deletedAt: null };
  if (filters.status) where.status = filters.status;
  if (filters.severity) where.severity = filters.severity;
  if (filters.search?.trim()) where.title = { contains: filters.search.trim(), mode: "insensitive" };

  const [total, rows] = await Promise.all([
    prisma.platformAnnouncement.count({ where }),
    prisma.platformAnnouncement.findMany({
      where,
      orderBy: [{ pinned: "desc" }, { createdAt: "desc" }],
      skip,
      take,
      select: {
        id: true,
        title: true,
        severity: true,
        status: true,
        audienceScope: true,
        audienceRoles: true,
        pinned: true,
        publishedAt: true,
        scheduledAt: true,
        _count: { select: { clubs: true, reads: { where: { readAt: { not: null } } } } },
      },
    }),
  ]);

  return {
    rows: rows.map((a) => ({
      id: a.id,
      title: a.title,
      severity: a.severity,
      status: a.status,
      audienceScope: a.audienceScope,
      audienceRoles: a.audienceRoles,
      clubCount: a._count.clubs,
      pinned: a.pinned,
      publishedAt: a.publishedAt,
      scheduledAt: a.scheduledAt,
      reads: a._count.reads,
    })),
    total,
    page,
    pageSize,
  };
}

export interface PlatformAnnouncementDetail {
  id: string;
  title: string;
  body: string;
  severity: string;
  status: string;
  audienceScope: string;
  audienceRoles: string[];
  pinned: boolean;
  publishedAt: Date | null;
  scheduledAt: Date | null;
  expiresAt: Date | null;
  createdAt: Date;
  clubs: { id: string; name: string }[];
  stats: { reads: number; dismissed: number; clubsReached: number; byRole: Record<string, number> };
}

export async function getPlatformAnnouncementDetail(
  ctx: AuthContext,
  id: string,
): Promise<PlatformAnnouncementDetail | null> {
  assertMasterAdmin(ctx);
  const a = await prisma.platformAnnouncement.findFirst({
    where: { id, deletedAt: null },
    include: { clubs: { select: { club: { select: { id: true, name: true } } } } },
  });
  if (!a) return null;

  const reads = await prisma.platformAnnouncementRead.findMany({
    where: { platformAnnouncementId: id },
    select: { userId: true, readAt: true, dismissedAt: true },
  });
  const readerIds = reads.filter((r) => r.readAt).map((r) => r.userId);
  const dismissed = reads.filter((r) => r.dismissedAt).length;

  // Map readers → their roles/clubs (only roles this announcement targets).
  const assignments = readerIds.length
    ? await prisma.userRoleAssignment.findMany({
        where: { userId: { in: readerIds }, status: "ACTIVE", role: { code: { in: a.audienceRoles } } },
        select: { userId: true, clubId: true, role: { select: { code: true } } },
      })
    : [];
  const byRole: Record<string, number> = {};
  const roleSeen = new Set<string>();
  const clubsReached = new Set<string>();
  for (const asg of assignments) {
    const key = `${asg.userId}:${asg.role.code}`;
    if (!roleSeen.has(key)) {
      roleSeen.add(key);
      byRole[asg.role.code] = (byRole[asg.role.code] ?? 0) + 1;
    }
    if (asg.clubId) clubsReached.add(asg.clubId);
  }

  return {
    id: a.id,
    title: a.title,
    body: a.body,
    severity: a.severity,
    status: a.status,
    audienceScope: a.audienceScope,
    audienceRoles: a.audienceRoles,
    pinned: a.pinned,
    publishedAt: a.publishedAt,
    scheduledAt: a.scheduledAt,
    expiresAt: a.expiresAt,
    createdAt: a.createdAt,
    clubs: a.clubs.map((c) => c.club),
    stats: { reads: readerIds.length, dismissed, clubsReached: clubsReached.size, byRole },
  };
}

/** Recent broadcasts + aggregate read rate for the Master dashboard widget. */
export async function getPlatformAnnouncementsSummary(
  ctx: AuthContext,
): Promise<{ recent: { id: string; title: string; severity: string; status: string; reads: number }[]; totalLive: number }> {
  assertMasterAdmin(ctx);
  const now = new Date();
  const [recent, totalLive] = await Promise.all([
    prisma.platformAnnouncement.findMany({
      where: { deletedAt: null },
      orderBy: [{ createdAt: "desc" }],
      take: 5,
      select: {
        id: true,
        title: true,
        severity: true,
        status: true,
        _count: { select: { reads: { where: { readAt: { not: null } } } } },
      },
    }),
    prisma.platformAnnouncement.count({ where: liveWhere(now) }),
  ]);
  return {
    recent: recent.map((a) => ({ id: a.id, title: a.title, severity: a.severity, status: a.status, reads: a._count.reads })),
    totalLive,
  };
}

// ===========================================================================
// Recipient — visibility + read/dismiss
// ===========================================================================

export interface MyPlatformAnnouncement {
  id: string;
  title: string;
  body: string;
  severity: string;
  pinned: boolean;
  publishedAt: Date | null;
  read: boolean;
  dismissed: boolean;
}

async function attachReadState(userId: string, ids: string[]) {
  const reads = ids.length
    ? await prisma.platformAnnouncementRead.findMany({
        where: { userId, platformAnnouncementId: { in: ids } },
        select: { platformAnnouncementId: true, readAt: true, dismissedAt: true },
      })
    : [];
  return new Map(reads.map((r) => [r.platformAnnouncementId, r]));
}

export async function getMyPlatformAnnouncements(ctx: AuthContext): Promise<MyPlatformAnnouncement[]> {
  const now = new Date();
  const rows = await prisma.platformAnnouncement.findMany({
    where: { AND: [liveWhere(now), audienceWhere(ctx)] },
    orderBy: [{ pinned: "desc" }, { publishedAt: "desc" }, { createdAt: "desc" }],
    take: 50,
    select: { id: true, title: true, body: true, severity: true, pinned: true, publishedAt: true },
  });
  const readMap = await attachReadState(ctx.userId, rows.map((r) => r.id));
  return rows.map((r) => ({
    id: r.id,
    title: r.title,
    body: r.body,
    severity: r.severity,
    pinned: r.pinned,
    publishedAt: r.publishedAt,
    read: !!readMap.get(r.id)?.readAt,
    dismissed: !!readMap.get(r.id)?.dismissedAt,
  }));
}

export async function getMyUnreadPlatformAnnouncementCount(ctx: AuthContext): Promise<number> {
  const now = new Date();
  const visible = await prisma.platformAnnouncement.findMany({
    where: { AND: [liveWhere(now), audienceWhere(ctx)] },
    select: { id: true },
    take: 200,
  });
  if (visible.length === 0) return 0;
  const readCount = await prisma.platformAnnouncementRead.count({
    where: { userId: ctx.userId, readAt: { not: null }, platformAnnouncementId: { in: visible.map((v) => v.id) } },
  });
  return visible.length - readCount;
}

/** Live banner items the caller hasn't dismissed (WARNING/CRITICAL only). */
export async function getMyPlatformBanners(ctx: AuthContext): Promise<MyPlatformAnnouncement[]> {
  const mine = await getMyPlatformAnnouncements(ctx);
  return mine.filter((a) => !a.dismissed && (a.severity === "CRITICAL" || a.severity === "WARNING"));
}

async function ensureVisible(ctx: AuthContext, id: string): Promise<void> {
  const now = new Date();
  const found = await prisma.platformAnnouncement.findFirst({
    where: { id, AND: [liveWhere(now), audienceWhere(ctx)] },
    select: { id: true },
  });
  if (!found) throw new ForbiddenError("Announcement is not available to you");
}

export async function markPlatformAnnouncementRead(ctx: AuthContext, id: string): Promise<void> {
  await ensureVisible(ctx, id);
  await prisma.platformAnnouncementRead.upsert({
    where: { uq_platform_announcement_read: { platformAnnouncementId: id, userId: ctx.userId } },
    create: { platformAnnouncementId: id, userId: ctx.userId, readAt: new Date() },
    update: { readAt: new Date() },
  });
}

export async function dismissPlatformAnnouncement(ctx: AuthContext, id: string): Promise<void> {
  await ensureVisible(ctx, id);
  const now = new Date();
  await prisma.platformAnnouncementRead.upsert({
    where: { uq_platform_announcement_read: { platformAnnouncementId: id, userId: ctx.userId } },
    create: { platformAnnouncementId: id, userId: ctx.userId, readAt: now, dismissedAt: now },
    update: { dismissedAt: now, readAt: now },
  });
}

// ===========================================================================
// Templates
// ===========================================================================

export interface PlatformTemplateRow {
  id: string;
  name: string;
  title: string;
  body: string;
  severity: string;
  defaultAudienceScope: string;
  defaultAudienceRoles: string[];
}

export async function listPlatformTemplates(ctx: AuthContext): Promise<PlatformTemplateRow[]> {
  assertMasterAdmin(ctx);
  return prisma.platformAnnouncementTemplate.findMany({
    orderBy: { name: "asc" },
    select: { id: true, name: true, title: true, body: true, severity: true, defaultAudienceScope: true, defaultAudienceRoles: true },
  });
}

export async function createPlatformTemplate(ctx: AuthContext, input: PlatformTemplateInput): Promise<string> {
  assertMasterAdmin(ctx);
  const t = await prisma.platformAnnouncementTemplate.create({
    data: {
      name: input.name,
      title: input.title,
      body: input.body,
      severity: input.severity,
      defaultAudienceScope: input.defaultAudienceScope,
      defaultAudienceRoles: input.defaultAudienceRoles,
      createdBy: ctx.userId,
    },
    select: { id: true },
  });
  await recordAuditStandalone({
    action: "platform_announcement_template.create",
    resourceType: "platform_announcement_template",
    resourceId: t.id,
    actorUserId: ctx.userId,
    metadata: { name: input.name },
  });
  return t.id;
}

export async function updatePlatformTemplate(ctx: AuthContext, id: string, input: PlatformTemplateInput): Promise<void> {
  assertMasterAdmin(ctx);
  await prisma.platformAnnouncementTemplate.update({
    where: { id },
    data: {
      name: input.name,
      title: input.title,
      body: input.body,
      severity: input.severity,
      defaultAudienceScope: input.defaultAudienceScope,
      defaultAudienceRoles: input.defaultAudienceRoles,
    },
  });
  await recordAuditStandalone({
    action: "platform_announcement_template.update",
    resourceType: "platform_announcement_template",
    resourceId: id,
    actorUserId: ctx.userId,
  });
}

export async function deletePlatformTemplate(ctx: AuthContext, id: string): Promise<void> {
  assertMasterAdmin(ctx);
  await prisma.platformAnnouncementTemplate.delete({ where: { id } });
  await recordAuditStandalone({
    action: "platform_announcement_template.delete",
    resourceType: "platform_announcement_template",
    resourceId: id,
    actorUserId: ctx.userId,
  });
}
