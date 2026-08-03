/**
 * "Best-Ball Value" ranking: an alternative to raw Draft Rank (which just ranks by
 * ability + recent form) that also accounts for two format-specific realities of a
 * handicapped best-ball/singles event:
 *   1. Consistency matters in best-ball - you want a partner who reliably posts a
 *      good net score, not a boom-or-bust player, since only the best net score
 *      per hole counts.
 *   2. Mid-handicappers often have the best stroke-allowance-to-consistency ratio
 *      ("sweet spot") - scratch players get few/no strokes and must play at their
 *      true (harder) ability, while very high handicappers get lots of strokes but
 *      their net scores swing too widely to be a reliable partner.
 *
 * All three inputs below are z-scored across the drafted field so they're on a
 * comparable scale, then combined with tunable weights. Lower composite score is
 * better, matching the existing Draft Rank convention (rank 1 = best).
 */

// Tunable - adjust based on the actual field and how the sweet-spot hypothesis holds up.
export const WEIGHT_RECENT_FORM = 0.4;
export const WEIGHT_CONSISTENCY = 0.35;
export const WEIGHT_SWEET_SPOT = 0.25;
export const SWEET_SPOT_CENTER = 13.5; // midpoint of the "12-15 handicap" sweet spot

export interface BestBallInput {
  name: string;
  handicapIndex: number;
  /** avgRecentDifferential - handicapIndex; negative = hot, positive = cold. Null if no rounds logged. */
  recentFormVsHandicap: number | null;
  /** This golfer's individual round differentials, for consistency (variance). */
  roundDifferentials: number[];
  /**
   * Course-adjusted handicap for the sweet-spot distance calc (e.g. average Course
   * Handicap across the event's rounds). Falls back to handicapIndex when omitted -
   * use the course-adjusted value when the event's courses/slopes are known, since a
   * generic Handicap Index understates strokes-in-play on above-average-slope courses.
   */
  sweetSpotHandicap?: number;
}

export interface BestBallResult {
  name: string;
  /** Sample standard deviation of round differentials. Null if fewer than 2 rounds logged. */
  consistency: number | null;
  sweetSpotDistance: number;
  bestBallScore: number;
  bestBallRank: number;
  /** True when consistency/recent form couldn't be computed (too few rounds) - score falls back to a neutral value. */
  insufficientData: boolean;
}

function mean(values: number[]): number {
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}

function sampleStdDev(values: number[]): number | null {
  if (values.length < 2) return null;
  const m = mean(values);
  const variance = values.reduce((sum, v) => sum + (v - m) ** 2, 0) / (values.length - 1);
  return Math.sqrt(variance);
}

/** z-score each value against the field; values that are null are treated as the field average (z=0). */
function zScores(values: (number | null)[]): number[] {
  const known = values.filter((v): v is number => v !== null);
  if (known.length < 2) return values.map(() => 0);

  const m = mean(known);
  const sd = sampleStdDev(known) || 1; // guard divide-by-zero when the field has no spread

  return values.map((v) => (v === null ? 0 : (v - m) / sd));
}

export function computeBestBallRankings(golfers: BestBallInput[]): BestBallResult[] {
  const consistencies = golfers.map((g) => sampleStdDev(g.roundDifferentials));
  const recentForms = golfers.map((g) => g.recentFormVsHandicap);
  const sweetSpotDistances = golfers.map((g) => Math.abs((g.sweetSpotHandicap ?? g.handicapIndex) - SWEET_SPOT_CENTER));

  const formZ = zScores(recentForms);
  const consistencyZ = zScores(consistencies);
  const sweetSpotZ = zScores(sweetSpotDistances);

  const scored = golfers.map((g, i) => ({
    name: g.name,
    consistency: consistencies[i],
    sweetSpotDistance: sweetSpotDistances[i],
    bestBallScore:
      WEIGHT_RECENT_FORM * formZ[i] + WEIGHT_CONSISTENCY * consistencyZ[i] + WEIGHT_SWEET_SPOT * sweetSpotZ[i],
    insufficientData: g.recentFormVsHandicap === null || consistencies[i] === null,
  }));

  const ranked = [...scored].sort((a, b) => a.bestBallScore - b.bestBallScore);
  const rankByName = new Map(ranked.map((g, i) => [g.name, i + 1]));

  return scored.map((g) => ({ ...g, bestBallRank: rankByName.get(g.name)! }));
}
