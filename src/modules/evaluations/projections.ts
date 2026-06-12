/**
 * Player-account-facing evaluation serializer (RBAC matrix §6.18). The
 * child-safety boundary for evaluations: a PLAYER account (when the club enables
 * `allow_player_evaluation_view`) sees ONLY the summary, player-visible notes,
 * and the overall score. `coach_only_notes`, per-criterion scores,
 * ranking/buckets, and every other field are stripped HERE, server-side —
 * never relying on the UI to hide them.
 */

export interface PlayerEvaluationLike {
  id: string;
  overallScore: unknown; // Prisma Decimal
  summaryComment: string | null;
  playerVisibleNotes: string | null;
  // — restricted fields below are intentionally never copied out —
  coachOnlyNotes?: unknown;
  rankInScope?: unknown;
  bucketLabel?: unknown;
}

export interface PlayerEvaluationSummary {
  id: string;
  overallScore: number | null;
  summaryComment: string | null;
  playerVisibleNotes: string | null;
}

export function playerEvaluationSummary(e: PlayerEvaluationLike): PlayerEvaluationSummary {
  return {
    id: e.id,
    overallScore: e.overallScore == null ? null : Number(e.overallScore),
    summaryComment: e.summaryComment,
    playerVisibleNotes: e.playerVisibleNotes,
  };
}
