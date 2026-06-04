import "server-only";

import { prisma } from "@/db/client";
import { ForbiddenError, type AuthContext } from "@/lib/rbac";

/**
 * Master module service layer — system-scope reads/writes for the Master Admin
 * portal (BUILD_PLAN §2 reporting/admin surface). Master Admin is cross-tenant
 * BY DESIGN (see scope.ts `clubMatches`), so these functions intentionally span
 * every club; the single guard each one needs is `assertMasterAdmin`. No other
 * role may reach this module.
 *
 * All counts/lists respect soft-delete (`deletedAt: null`) where the model has
 * it, and use Prisma aggregates (`count` / `_count` / `distinct`) — never N+1.
 */

/** The one authorization gate for the entire module. */
function assertMasterAdmin(ctx: AuthContext): void {
  if (ctx.role !== "MASTER_ADMIN") {
    throw new ForbiddenError("Master Admin access required");
  }
}

export interface MasterDashboardSummary {
  clubs: number;
  activeClubs: number;
  teams: number;
  players: number;
  coaches: number;
  parents: number;
  users: number;
  openInvoices: number;
  overdueInvoices: number;
  upcomingEvents: number;
  activeEvaluationCycles: number;
  waiverAcceptances: number;
}

/**
 * System-wide totals for the Master Admin dashboard. Each metric degrades to 0
 * when its module has no data yet. Distinct-user counts (coaches/parents) are
 * by active role assignment.
 */
export async function getMasterDashboardSummary(ctx: AuthContext): Promise<MasterDashboardSummary> {
  assertMasterAdmin(ctx);
  const now = new Date();

  const [
    clubs,
    activeClubs,
    teams,
    players,
    coachAssignments,
    parentAssignments,
    users,
    openInvoices,
    overdueInvoices,
    upcomingEvents,
    activeEvaluationCycles,
    waiverAcceptances,
  ] = await Promise.all([
    prisma.club.count({ where: { deletedAt: null } }),
    prisma.club.count({ where: { deletedAt: null, status: "ACTIVE" } }),
    prisma.team.count({ where: { deletedAt: null } }),
    prisma.player.count({ where: { deletedAt: null } }),
    prisma.userRoleAssignment.findMany({
      where: { status: "ACTIVE", role: { code: "COACH" } },
      select: { userId: true },
      distinct: ["userId"],
    }),
    prisma.userRoleAssignment.findMany({
      where: { status: "ACTIVE", role: { code: "PARENT" } },
      select: { userId: true },
      distinct: ["userId"],
    }),
    prisma.user.count(),
    prisma.invoice.count({ where: { status: { in: ["OPEN", "PARTIALLY_PAID"] } } }),
    prisma.invoice.count({ where: { status: "OVERDUE" } }),
    prisma.event.count({ where: { status: "SCHEDULED", startAt: { gte: now } } }),
    prisma.evaluationCycle.count({ where: { status: "ACTIVE" } }),
    prisma.waiverAcceptance.count(),
  ]);

  return {
    clubs,
    activeClubs,
    teams,
    players,
    coaches: coachAssignments.length,
    parents: parentAssignments.length,
    users,
    openInvoices,
    overdueInvoices,
    upcomingEvents,
    activeEvaluationCycles,
    waiverAcceptances,
  };
}
