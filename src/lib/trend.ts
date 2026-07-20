export type TrendStatus = "hot" | "cold" | "steady" | "insufficient_data";

export interface TrendResult {
  status: TrendStatus;
  /** avgRecent - currentHandicapIndex. Undefined when status is "insufficient_data". */
  delta?: number;
  avgRecent?: number;
  /** Differentials used in the calculation, oldest first — for sparkline rendering. */
  sparklineData: number[];
}

const MAX_RECENT_ROUNDS = 8;
const MIN_ROUNDS_REQUIRED = 3;

/** Tunable heuristic — adjust after sanity-checking against a few real golfers. */
export const TREND_THRESHOLD = 1.0;

function mean(values: number[]): number {
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}

/**
 * Compares a golfer's recent score differentials to their current Handicap Index.
 * differentials should be ordered oldest-to-newest; only the most recent
 * MAX_RECENT_ROUNDS are used.
 */
export function computeTrend(handicapIndex: number, differentials: number[]): TrendResult {
  const recent = differentials.slice(-MAX_RECENT_ROUNDS);

  if (recent.length < MIN_ROUNDS_REQUIRED) {
    return { status: "insufficient_data", sparklineData: recent };
  }

  const avgRecent = mean(recent);
  const delta = avgRecent - handicapIndex;

  let status: TrendStatus;
  if (delta < -TREND_THRESHOLD) {
    status = "hot";
  } else if (delta > TREND_THRESHOLD) {
    status = "cold";
  } else {
    status = "steady";
  }

  return { status, delta, avgRecent, sparklineData: recent };
}
