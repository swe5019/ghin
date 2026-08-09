/**
 * Four-ball pairing maths, and the game theory of the throw-and-counter pairings draft.
 *
 * Everything here works in "net strokes relative to par at one specific course", which is
 * why it takes a CourseRound rather than reusing the index-space numbers from ranking.ts.
 * Slope scales both a golfer's expected score and their spread, so a higher-sloped course
 * genuinely stretches the field out — the difference between these two courses is small,
 * but it's free to model it properly.
 */

import { computePlayingHandicap, type CourseRound } from "./course-math";

/** A golfer reduced to what pairing maths needs. */
export interface PairingPlayer {
  name: string;
  handicapIndex: number;
  /** Personal shortfall vs. index, shrunk toward the field — see ranking.ts. */
  adjustedGap: number;
  /** Round-to-round spread of differentials, shrunk toward the field. */
  spread: number;
}

/** A normal distribution over net strokes to par. Lower is better. */
export interface NetDistribution {
  mu: number;
  sigma: number;
}

/**
 * A golfer's net score relative to par at one course, after that round's allowance.
 *
 * differential D has mean (index + gap) and sd `spread`; gross = D x slope/113 + rating,
 * so net to par = D x slope/113 + (rating - par) - playing handicap.
 */
export function netDistribution(player: PairingPlayer, course: CourseRound): NetDistribution {
  const k = course.slope / 113;
  const playingHandicap = computePlayingHandicap(player.handicapIndex, course);
  return {
    mu: (player.handicapIndex + player.adjustedGap) * k + (course.rating - course.par) - playingHandicap,
    sigma: player.spread * k,
  };
}

const INV_SQRT_2PI = 0.3989422804014327;

function stdPdf(z: number): number {
  return INV_SQRT_2PI * Math.exp((-z * z) / 2);
}

/** Abramowitz & Stegun 26.2.17 — accurate to ~7.5e-8, far tighter than the inputs deserve. */
function stdCdf(z: number): number {
  const t = 1 / (1 + 0.2316419 * Math.abs(z));
  const poly =
    t * (0.319381530 + t * (-0.356563782 + t * (1.781477937 + t * (-1.821255978 + t * 1.330274429))));
  const tail = stdPdf(z) * poly;
  return z >= 0 ? 1 - tail : tail;
}

function pdfAt(d: NetDistribution, x: number): number {
  return stdPdf((x - d.mu) / d.sigma) / d.sigma;
}

function cdfAt(d: NetDistribution, x: number): number {
  return stdCdf((x - d.mu) / d.sigma);
}

/**
 * A pair's four-ball score is the better ball, i.e. min of the two players.
 *
 * Caveat worth knowing: real four-ball takes the better ball on *each hole*, which beats
 * the better of two round totals. So these numbers are systematically pessimistic about
 * how much a partner helps. They're used only to compare pairings against each other,
 * and that ordering is unaffected.
 */
export interface PairDistribution {
  cdf: (x: number) => number;
  pdf: (x: number) => number;
  /** E[min(X, Y)] in closed form, for display. */
  expected: number;
}

export function pairDistribution(a: NetDistribution, b: NetDistribution): PairDistribution {
  const theta = Math.hypot(a.sigma, b.sigma);
  const alpha = (a.mu - b.mu) / theta;
  const expected = a.mu * stdCdf(-alpha) + b.mu * stdCdf(alpha) - theta * stdPdf(alpha);

  return {
    // P(min <= x) = 1 - P(both above x)
    cdf: (x) => 1 - (1 - cdfAt(a, x)) * (1 - cdfAt(b, x)),
    pdf: (x) => pdfAt(a, x) * (1 - cdfAt(b, x)) + pdfAt(b, x) * (1 - cdfAt(a, x)),
    expected,
  };
}

const GRID_STEPS = 800;

/**
 * P(pair A returns a lower better-ball than pair B).
 *
 * min-of-two-normals isn't normal, so this integrates f_A(t) x (1 - F_B(t)) on a grid
 * rather than reaching for a closed form. Deterministic, unlike a Monte Carlo — the same
 * inputs always render the same number, which matters when it's on screen.
 *
 * Ties are measure-zero here, so this is a straight win probability. Real match play
 * halves a fair share of matches; read these as "share of the head-to-head", not as
 * expected points including halves.
 */
export function winProbability(a: PairDistribution, b: PairDistribution, lo: number, hi: number): number {
  const step = (hi - lo) / GRID_STEPS;
  let total = 0;
  for (let i = 0; i <= GRID_STEPS; i++) {
    const t = lo + i * step;
    const weight = i === 0 || i === GRID_STEPS ? 0.5 : 1;
    total += weight * a.pdf(t) * (1 - b.cdf(t));
  }
  return Math.min(1, Math.max(0, total * step));
}

/** Integration bounds wide enough to cover every pair in play. */
export function integrationBounds(dists: NetDistribution[]): [number, number] {
  const lo = Math.min(...dists.map((d) => d.mu - 6 * d.sigma));
  const hi = Math.max(...dists.map((d) => d.mu + 6 * d.sigma));
  return [lo, hi];
}

export interface Pair {
  players: [string, string];
  expected: number;
}

/** Every way to split a team into unordered pairs — 105 of them for eight players. */
export function enumeratePairings<T>(items: T[]): [T, T][][] {
  if (items.length === 0) return [[]];
  const [first, ...rest] = items;
  const out: [T, T][][] = [];
  for (let i = 0; i < rest.length; i++) {
    const partner = rest[i];
    const remaining = rest.filter((_, j) => j !== i);
    for (const sub of enumeratePairings(remaining)) {
      out.push([[first, partner], ...sub]);
    }
  }
  return out;
}

export interface RankedLineup {
  pairs: Pair[];
  /** Sum of the four pairs' expected better-ball scores. Lower is better. */
  total: number;
  /** The weakest pair's expected score — your likeliest dropped point. */
  worst: number;
}

/** All 105 lineups for a team at one course, best total first. */
export function rankLineups(team: PairingPlayer[], course: CourseRound): RankedLineup[] {
  const nets = new Map(team.map((p) => [p.name, netDistribution(p, course)]));
  return enumeratePairings(team)
    .map((partition) => {
      const pairs: Pair[] = partition.map(([a, b]) => ({
        players: [a.name, b.name],
        expected: pairDistribution(nets.get(a.name)!, nets.get(b.name)!).expected,
      }));
      return {
        pairs,
        total: pairs.reduce((sum, p) => sum + p.expected, 0),
        worst: Math.max(...pairs.map((p) => p.expected)),
      };
    })
    .sort((x, y) => x.total - y.total);
}

// ---------------------------------------------------------------------------
// The throw-and-counter draft
// ---------------------------------------------------------------------------

export type Side = "me" | "them";

const other = (side: Side): Side => (side === "me" ? "them" : "me");

/**
 * The format: one captain throws a pair out, the other answers it with a pair of their
 * own (that match is locked) and immediately throws one of theirs. Repeat. Over four
 * matches each captain throws twice and counters twice, so first-throw is the only
 * asymmetry — and countering is the advantaged half of each exchange, since you're
 * choosing against a known opponent.
 */
export interface ThrowState {
  myRemaining: number[];
  theirRemaining: number[];
  /** The pair awaiting an answer, already removed from its owner's remaining. */
  pending: { index: number; by: Side } | null;
  /** Whose throw it is, when nothing is pending. */
  toThrow: Side;
}

export interface Decision {
  /** Expected matches won by me, out of the four. */
  value: number;
  /** Which of the acting side's pairs to answer with. */
  counter: number | null;
  /** Which pair the acting side should throw next. */
  nextThrow: number | null;
}

export interface SolverContext {
  /** winProb[i][j] = P(my pair i beats their pair j). */
  winProb: number[][];
}

/**
 * Exact minimax over the whole exchange. The tree is only ~576 leaves, so this searches
 * it in full rather than approximating — no depth limit, no heuristics.
 *
 * Returns the value in *my* expected matches won, so I maximise and they minimise.
 */
export function solveFromPending(ctx: SolverContext, state: ThrowState): Decision {
  const pending = state.pending;
  if (!pending) return solveFromThrow(ctx, state);

  const actor = other(pending.by);
  const actorRemaining = actor === "me" ? state.myRemaining : state.theirRemaining;

  let best: Decision | null = null;
  for (const counter of actorRemaining) {
    // winProb is always indexed [my pair][their pair] and already reads from my side, so
    // it's never complemented — only the roles of `counter` and `pending` swap.
    const points =
      actor === "me"
        ? ctx.winProb[counter][pending.index]
        : ctx.winProb[pending.index][counter];

    const myRemaining = actor === "me" ? state.myRemaining.filter((i) => i !== counter) : state.myRemaining;
    const theirRemaining =
      actor === "them" ? state.theirRemaining.filter((i) => i !== counter) : state.theirRemaining;

    let rest: Decision;
    if (myRemaining.length === 0 && theirRemaining.length === 0) {
      rest = { value: 0, counter: null, nextThrow: null };
    } else {
      // Having answered, the same side now throws.
      rest = solveFromThrow(ctx, { myRemaining, theirRemaining, pending: null, toThrow: actor });
    }

    const candidate: Decision = {
      value: points + rest.value,
      counter,
      nextThrow: rest.nextThrow,
    };
    if (!best || better(candidate.value, best.value, actor)) best = candidate;
  }
  return best!;
}

/** The acting side picks which of their pairs to expose. */
export function solveFromThrow(ctx: SolverContext, state: ThrowState): Decision {
  const thrower = state.toThrow;
  const pool = thrower === "me" ? state.myRemaining : state.theirRemaining;

  let best: Decision | null = null;
  for (const index of pool) {
    const myRemaining = thrower === "me" ? state.myRemaining.filter((i) => i !== index) : state.myRemaining;
    const theirRemaining =
      thrower === "them" ? state.theirRemaining.filter((i) => i !== index) : state.theirRemaining;

    const sub = solveFromPending(ctx, {
      myRemaining,
      theirRemaining,
      pending: { index, by: thrower },
      toThrow: other(thrower),
    });

    const candidate: Decision = { value: sub.value, counter: sub.counter, nextThrow: index };
    if (!best || better(candidate.value, best.value, thrower)) best = candidate;
  }
  return best!;
}

function better(candidate: number, incumbent: number, actor: Side): boolean {
  return actor === "me" ? candidate > incumbent : candidate < incumbent;
}

/** Every option at the current decision, scored — so the UI can show the alternatives. */
export function rankOptions(ctx: SolverContext, state: ThrowState): { index: number; value: number }[] {
  const pending = state.pending;
  const actor = pending ? other(pending.by) : state.toThrow;
  const pool = actor === "me" ? state.myRemaining : state.theirRemaining;

  return pool
    .map((index) => {
      if (!pending) {
        const myRemaining = actor === "me" ? state.myRemaining.filter((i) => i !== index) : state.myRemaining;
        const theirRemaining =
          actor === "them" ? state.theirRemaining.filter((i) => i !== index) : state.theirRemaining;
        const sub = solveFromPending(ctx, {
          myRemaining,
          theirRemaining,
          pending: { index, by: actor },
          toThrow: other(actor),
        });
        return { index, value: sub.value };
      }

      const points =
        actor === "me" ? ctx.winProb[index][pending.index] : ctx.winProb[pending.index][index];
      const myRemaining = actor === "me" ? state.myRemaining.filter((i) => i !== index) : state.myRemaining;
      const theirRemaining =
        actor === "them" ? state.theirRemaining.filter((i) => i !== index) : state.theirRemaining;
      const rest =
        myRemaining.length === 0 && theirRemaining.length === 0
          ? 0
          : solveFromThrow(ctx, { myRemaining, theirRemaining, pending: null, toThrow: actor }).value;
      return { index, value: points + rest };
    })
    .sort((a, b) => (actor === "me" ? b.value - a.value : a.value - b.value));
}
