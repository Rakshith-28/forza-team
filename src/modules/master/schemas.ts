/**
 * Shared vocab + filter/pagination types for the master module. Plain constants
 * and types (no "use server"), importable by both server services and client
 * filter UI.
 */

export const CLUB_STATUSES = ["ACTIVE", "SUSPENDED", "ARCHIVED"] as const;
export type ClubStatus = (typeof CLUB_STATUSES)[number];

export const USER_STATUSES = ["ACTIVE", "INACTIVE", "SUSPENDED"] as const;
export type UserStatus = (typeof USER_STATUSES)[number];

export const COACH_ROLE_TYPE_VALUES = ["HEAD_COACH", "ASSISTANT_COACH", "TEAM_MANAGER"] as const;

/** Standard list pagination. Page is 1-based. */
export interface PageParams {
  page?: number;
  pageSize?: number;
}

export interface Paginated<T> {
  rows: T[];
  total: number;
  page: number;
  pageSize: number;
}

const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 100;

/** Clamp/normalize raw page params (from URL searchParams). */
export function normalizePage(params: PageParams = {}): { page: number; pageSize: number; skip: number; take: number } {
  const page = Number.isFinite(params.page) && (params.page ?? 0) > 0 ? Math.floor(params.page!) : 1;
  const rawSize = Number.isFinite(params.pageSize) ? Math.floor(params.pageSize!) : DEFAULT_PAGE_SIZE;
  const pageSize = Math.min(Math.max(rawSize, 1), MAX_PAGE_SIZE);
  return { page, pageSize, skip: (page - 1) * pageSize, take: pageSize };
}

/** Parse a numeric search param ("2" -> 2), undefined when absent/invalid. */
export function parseIntParam(value: string | undefined): number | undefined {
  if (value == null) return undefined;
  const n = Number(value);
  return Number.isFinite(n) ? n : undefined;
}
