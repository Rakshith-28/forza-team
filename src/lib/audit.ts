import "server-only";

import { prisma } from "@/db/client";
import { Prisma } from "@/db/generated/client";
import { logger } from "@/lib/logger";

/**
 * Audit trail for sensitive mutations (BUILD_PLAN §2, RBAC matrix §11.6).
 *
 * Call within the same transaction as the mutation so the log and the change
 * commit together. `db` accepts either the singleton or a transaction client.
 */
export interface AuditInput {
  action: string; // e.g. "club.create", "team.archive", "coach.assign"
  resourceType: string; // e.g. "club", "season", "team", "team_coach"
  resourceId?: string | null;
  clubId?: string | null;
  actorUserId?: string | null;
  metadata?: Record<string, unknown>;
  ipAddress?: string | null;
}

type Db = Prisma.TransactionClient;

export async function recordAudit(db: Db, input: AuditInput): Promise<void> {
  await db.auditLog.create({
    data: {
      action: input.action,
      resourceType: input.resourceType,
      resourceId: input.resourceId ?? null,
      clubId: input.clubId ?? null,
      actorUserId: input.actorUserId ?? null,
      metadataJson: (input.metadata ?? undefined) as Prisma.InputJsonValue | undefined,
      ipAddress: input.ipAddress ?? null,
    },
  });
  logger.info("audit", {
    action: input.action,
    resourceType: input.resourceType,
    resourceId: input.resourceId,
    clubId: input.clubId,
    actorUserId: input.actorUserId,
  });
}

/** Convenience for non-transactional call sites (uses the singleton). */
export function recordAuditStandalone(input: AuditInput): Promise<void> {
  return recordAudit(prisma, input);
}
