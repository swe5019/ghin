export type TrendStatus = "hot" | "cold" | "steady" | "insufficient_data";

export interface TrendResult {
  status: TrendStatus;
  /** How many rounds back this trend. Below MIN_ROUNDS_FOR_CONFIDENCE it's provisional. */
  roundsUsed: number;
  /** True when based on only 1-2 rounds — directionally useful, but noisy. */
  lowConfidence: boolean;
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
/** One round is enough to say something; it's just noisy, so it's flagged low-confidence. */
const MIN_ROUNDS_REQUIRED = 1;
/** At or above this many rounds, the trend is reported without a caveat. */
export const MIN_ROUNDS_FOR_CONFIDENCE = 3;

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
    return {
      status: "insufficient_data",
      roundsUsed: 0,
      lowConfidence: true,
      sparklineData: recent,
    };
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

  return {
    status,
    roundsUsed: recent.length,
    lowConfidence: recent.length < MIN_ROUNDS_FOR_CONFIDENCE,
    delta,
    avgRecent,
    gap,
    fieldGap,
    sparklineData: recent,
  };
}
