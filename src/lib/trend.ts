export type TrendStatus = "hot" | "cold" | "steady" | "insufficient_data";

export interface TrendResult {
  status: TrendStatus;
  /** How this golfer's gap-to-index compares to the field's. Negative = playing better than the field norm. */
  delta?: number;
  avgRecent?: number;
  /** This golfer's own gap (avgRecent - handicapIndex), before comparing to the field. */
  gap?: number;
  /** The field's average gap, i.e. the baseline this golfer is measured against. */
  fieldGap?: number;
  /** Differentials used in the calculation, oldest first — for sparkline rendering. */
  sparklineData: number[];
}

const MAX_RECENT_ROUNDS = 8;
const MIN_ROUNDS_REQUIRED = 3;

/** Tunable heuristic — how far from the field norm counts as hot/cold. */
export const TREND_THRESHOLD = 1.0;

function mean(values: number[]): number {
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}

/**
 * Flags whether a golfer is playing better or worse than expected right now.
 *
 * Measured against the FIELD's average gap, not against the golfer's Handicap Index.
 * An index is the average of a golfer's best 8 of 20 differentials, so it represents
 * potential rather than average — almost everyone shoots worse than their index, and
 * comparing to the index directly would label nearly the whole field "cold".
 *
 * differentials should be ordered oldest-to-newest; only the most recent
 * MAX_RECENT_ROUNDS are used.
 */
export function computeTrend(handicapIndex: number, differentials: number[], fieldGap: number): TrendResult {
  const recent = differentials.slice(-MAX_RECENT_ROUNDS);

  if (recent.length < MIN_ROUNDS_REQUIRED) {
    return { status: "insufficient_data", sparklineData: recent };
  }

  const avgRecent = mean(recent);
  const gap = avgRecent - handicapIndex;
  const delta = gap - fieldGap;

  let status: TrendStatus;
  if (delta < -TREND_THRESHOLD) {
    status = "hot";
  } else if (delta > TREND_THRESHOLD) {
    status = "cold";
  } else {
    status = "steady";
  }

  return { status, delta, avgRecent, gap, fieldGap, sparklineData: recent };
}
