/**
 * Draft ranking based on expected score AFTER strokes are applied.
 *
 * The key facts this is built on:
 *
 * 1. A Handicap Index is the average of a golfer's best 8 of 20 differentials, so it
 *    measures potential, not average. Essentially everyone shoots worse than their index
 *    (this field averages ~+2.3). "Gap" below is that personal shortfall, and it's the
 *    part that actually varies between golfers.
 *
 * 2. With an allowance `a`, expected net score = (1 - a) * index + gap. So the index only
 *    matters to the extent it isn't handed back as strokes, and gap does the real work.
 *
 * 3. Best ball rewards upside (you count the better ball, so a partner's bad holes are
 *    absorbed and their hot streaks are captured), while singles rewards expectation.
 *    Those want opposite things from variance, so they get separate ranks.
 *
 * Lower scores are better throughout, matching the "rank 1 = best" convention.
 */

/** Rounds-equivalent weight of the field prior when shrinking a golfer's small sample. */
export const SHRINK_STRENGTH = 4;

/** How much of a golfer's spread counts as reachable upside (~a good round, not their best ever). */
export const UPSIDE_SIGMAS = 0.8;

/** Best ball counts the better ball, so upside outweighs expectation. */
export const BEST_BALL_WEIGHT_EXPECTED = 0.35;
export const BEST_BALL_WEIGHT_UPSIDE = 0.65;

/** Singles is mostly about your expected score, with a little credit for upside. */
export const SINGLES_WEIGHT_EXPECTED = 0.8;
export const SINGLES_WEIGHT_UPSIDE = 0.2;

/** Minimum rounds before a golfer's own numbers are trusted enough to rank them. */
export const MIN_ROUNDS_TO_RANK = 1;

export interface RankingInput {
  name: string;
  handicapIndex: number;
  /** This golfer's round differentials, oldest first. */
  roundDifferentials: number[];
}

export interface RankingWeights {
  /** Average allowance across the best-ball rounds (e.g. 0.9). */
  bestBallAllowance: number;
  /** Average allowance across the singles rounds (0.9 or 1.0 depending on the group's rule). */
  singlesAllowance: number;
  /** Share of the event that is best ball, e.g. 2/3 for two best-ball rounds + one singles. */
  bestBallShare: number;
}

export interface RankingResult {
  name: string;
  roundsLogged: number;
  /** Raw personal shortfall vs. index (avg differential - index). Null with no rounds. */
  gap: number | null;
  /** Gap after shrinking toward the field average, which is what ranking uses. */
  adjustedGap: number;
  /** How this golfer's gap compares to the field's - negative means playing better than the field norm. */
  formVsField: number | null;
  /** Sample standard deviation of differentials, shrunk toward the field. */
  spread: number;
  /** Expected net score in a best-ball round, after strokes. Lower is better. */
  expectedNetBestBall: number;
  /** Expected net score in the singles round, after strokes. Lower is better. */
  expectedNetSingles: number;
  /** A good (not best-ever) round, net of strokes - what a best-ball partner contributes. */
  upsideBestBall: number;
  bestBallScore: number;
  singlesScore: number;
  overallScore: number;
  bestBallRank: number;
  singlesRank: number;
  overallRank: number;
  /** True when this golfer has no logged rounds, so their numbers are the field prior. */
  insufficientData: boolean;
}

function mean(values: number[]): number {
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}

/**
 * Field priors use the median, not the mean: several golfers have only 1-2 logged rounds
 * and sit far out in the right tail, which drags a mean baseline up and makes a typical
 * golfer look better than they are.
 */
export function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

function sampleStdDev(values: number[]): number | null {
  if (values.length < 2) return null;
  const m = mean(values);
  return Math.sqrt(values.reduce((sum, v) => sum + (v - m) ** 2, 0) / (values.length - 1));
}

/** Pull a small-sample estimate toward the field prior, weighted by how many rounds back it. */
function shrink(estimate: number | null, n: number, prior: number): number {
  if (estimate === null || n === 0) return prior;
  return (n * estimate + SHRINK_STRENGTH * prior) / (n + SHRINK_STRENGTH);
}

function rankBy<T>(items: T[], score: (item: T) => number, key: (item: T) => string): Map<string, number> {
  const sorted = [...items].sort((a, b) => score(a) - score(b));
  return new Map(sorted.map((item, i) => [key(item), i + 1]));
}

export function computeRankings(golfers: RankingInput[], weights: RankingWeights): RankingResult[] {
  const gaps = golfers.map((g) =>
    g.roundDifferentials.length > 0 ? mean(g.roundDifferentials) - g.handicapIndex : null,
  );
  const spreads = golfers.map((g) => sampleStdDev(g.roundDifferentials));

  const knownGaps = gaps.filter((v): v is number => v !== null);
  const knownSpreads = spreads.filter((v): v is number => v !== null);

  // Field priors: what we assume about a golfer we know nothing about.
  const fieldGap = knownGaps.length > 0 ? median(knownGaps) : 0;
  const fieldSpread = knownSpreads.length > 0 ? median(knownSpreads) : 0;

  const scored = golfers.map((g, i) => {
    const n = g.roundDifferentials.length;
    const adjustedGap = shrink(gaps[i], n, fieldGap);
    const spread = shrink(spreads[i], n < 2 ? 0 : n, fieldSpread);

    // Expected net = (1 - allowance) * index + gap.
    const expectedNetBestBall = (1 - weights.bestBallAllowance) * g.handicapIndex + adjustedGap;
    const expectedNetSingles = (1 - weights.singlesAllowance) * g.handicapIndex + adjustedGap;
    const upsideBestBall = expectedNetBestBall - UPSIDE_SIGMAS * spread;
    const upsideSingles = expectedNetSingles - UPSIDE_SIGMAS * spread;

    const bestBallScore =
      BEST_BALL_WEIGHT_EXPECTED * expectedNetBestBall + BEST_BALL_WEIGHT_UPSIDE * upsideBestBall;
    const singlesScore = SINGLES_WEIGHT_EXPECTED * expectedNetSingles + SINGLES_WEIGHT_UPSIDE * upsideSingles;

    return {
      name: g.name,
      roundsLogged: n,
      gap: gaps[i],
      adjustedGap,
      formVsField: gaps[i] === null ? null : gaps[i] - fieldGap,
      spread,
      expectedNetBestBall,
      expectedNetSingles,
      upsideBestBall,
      bestBallScore,
      singlesScore,
      overallScore: weights.bestBallShare * bestBallScore + (1 - weights.bestBallShare) * singlesScore,
      insufficientData: n < MIN_ROUNDS_TO_RANK,
    };
  });

  const bestBallRanks = rankBy(scored, (g) => g.bestBallScore, (g) => g.name);
  const singlesRanks = rankBy(scored, (g) => g.singlesScore, (g) => g.name);
  const overallRanks = rankBy(scored, (g) => g.overallScore, (g) => g.name);

  return scored.map((g) => ({
    ...g,
    bestBallRank: bestBallRanks.get(g.name)!,
    singlesRank: singlesRanks.get(g.name)!,
    overallRank: overallRanks.get(g.name)!,
  }));
}
