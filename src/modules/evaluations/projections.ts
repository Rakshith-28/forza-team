/**
 * Parent-facing evaluation serializer (RBAC matrix §6.18). The child-safety
 * boundary for evaluations: a PARENT (when the club enables
 * `allow_parent_child_evaluation_view`) sees ONLY the summary, parent-visible
 * notes, and the overall score. `coach_only_notes`, per-criterion scores,
 * ranking/buckets, and every other field are stripped HERE, server-side —
 * never relying on the UI to hide them.
 */

export interface PlayerEvaluationLike {
  id: string;
  overallScore: unknown; // Prisma Decimal
  summaryComment: string | null;
  parentVisibleNotes: string | null;
  // — restricted fields below are intentionally never copied out —
  coachOnlyNotes?: unknown;
  rankInScope?: unknown;
  bucketLabel?: unknown;
}

export interface ParentEvaluationSummary {
  id: string;
  overallScore: number | null;
  summaryComment: string | null;
  parentVisibleNotes: string | null;
}

export function parentEvaluationSummary(e: PlayerEvaluationLike): ParentEvaluationSummary {
  return {
    id: e.id,
    overallScore: e.overallScore == null ? null : Number(e.overallScore),
    summaryComment: e.summaryComment,
    parentVisibleNotes: e.parentVisibleNotes,
  };
}
