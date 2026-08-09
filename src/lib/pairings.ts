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

/**
 * Every two-man combination on a team — 28 for eight players. Unlike enumeratePairings
 * these overlap, since it's the menu a captain picks from rather than a whole lineup.
 */
export function allPairs<T>(items: T[]): [T, T][] {
  return items.flatMap((a, i) => items.slice(i + 1).map((b) => [a, b] as [T, T]));
}

/** Scores every two-man combination on a team at one course, best better-ball first. */
export function rankAllPairs(team: PairingPlayer[], course: CourseRound): Pair[] {
  const nets = new Map(team.map((p) => [p.name, netDistribution(p, course)]));
  return allPairs(team)
    .map(([a, b]) => ({
      players: [a.name, b.name] as [string, string],
      expected: pairDistribution(nets.get(a.name)!, nets.get(b.name)!).expected,
    }))
    .sort((x, y) => x.expected - y.expected);
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

/** Stable key for a pair regardless of which partner is named first. */
export const pairKey = (players: [string, string]): string => [...players].sort().join("|");

export interface LineupEvaluation {
  lineup: RankedLineup;
  /** Index into the rankLineups order, so a selection survives re-sorting. */
  index: number;
  /** Expected matches won of four, under optimal throw-and-counter by both sides. */
  matches: number;
}

/**
 * Scores every lineup by the objective that actually decides the day: expected matches
 * won, not total strokes.
 *
 * These come apart, and that's the whole point. Summing four pairs' expected scores is a
 * stroke-play objective — it rewards a pair that wins by six exactly as much as the six
 * strokes are worth, when match play pays the same single point for winning by one. So a
 * lineup that concedes one match to make the other three strong can beat a balanced one
 * on matches while looking far worse on strokes.
 *
 * Cheap because the 28 x 4 win probabilities are integrated once up front; each of the
 * 105 lineups then only looks up its own 4 x 4 submatrix and searches a ~576-leaf tree.
 */
export function evaluateLineups(
  team: PairingPlayer[],
  opponents: PairingPlayer[],
  theirPairs: [string, string][],
  course: CourseRound,
  firstThrow: Side,
): LineupEvaluation[] {
  const lineups = rankLineups(team, course);
  if (lineups.length === 0 || theirPairs.length !== 4) return [];

  const nets = new Map(
    [...team, ...opponents].map((p) => [p.name, netDistribution(p, course)] as const),
  );
  if (theirPairs.flat().some((n) => !nets.has(n))) return [];

  const bounds = integrationBounds([...nets.values()]);
  const theirDists = theirPairs.map((p) => pairDistribution(nets.get(p[0])!, nets.get(p[1])!));

  // One row of win probabilities per possible pair of mine, against their four.
  const rowFor = new Map<string, number[]>();
  for (const [a, b] of allPairs(team)) {
    const mineDist = pairDistribution(nets.get(a.name)!, nets.get(b.name)!);
    rowFor.set(
      pairKey([a.name, b.name]),
      theirDists.map((t) => winProbability(mineDist, t, bounds[0], bounds[1])),
    );
  }

  const all = [0, 1, 2, 3];
  return lineups
    .map((lineup, index) => {
      const winProb = lineup.pairs.map((p) => rowFor.get(pairKey(p.players))!);
      const value = solveFromThrow(
        { winProb },
        { myRemaining: all, theirRemaining: all, pending: null, toThrow: firstThrow },
      ).value;
      return { lineup, index, matches: value };
    })
    .sort((x, y) => y.matches - x.matches);
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

// ---------------------------------------------------------------------------
// Free pairing — the game as it is actually played
// ---------------------------------------------------------------------------

/**
 * Everything above assumes each captain fixes four pairs before the exchange starts.
 * That isn't the format. A captain throws a pair built from whoever is still unpaired,
 * so the opening throw chooses among all 28 combinations of eight golfers, then 15 of the
 * remaining six, then 6, then the last two are forced. The lineup is an *output* of the
 * exchange, not an input to it — and answering is stronger than it looks, because you
 * build the answer around the pair already on the table.
 *
 * The raw tree is ~6.4M leaves. Its value depends only on which golfers remain and which
 * pair is on the table — not on how the used ones happened to be arranged — so memoising
 * on that collapses it to a few thousand states. Availability is a bitmask and the whole
 * state packs into one integer, which keeps the search allocation-free and well under a
 * frame; the string-keyed version of this took about 1.5 seconds.
 */
export interface FreeState {
  /** Golfers not yet used. */
  myAvailable: string[];
  theirAvailable: string[];
  /** The pair awaiting an answer, already removed from its owner's available list. */
  pending: { pair: [string, string]; by: Side } | null;
  /** Whose throw it is when nothing is pending. */
  toThrow: Side;
}

interface IndexedPair {
  id: number;
  mask: number;
  players: [string, string];
}

export interface FreeSolver {
  /** Which side is to play. */
  actor: (state: FreeState) => Side;
  /** Expected matches won by me over the rest of the exchange, both sides playing well. */
  value: (state: FreeState) => number;
  /** Every legal play now, best for the acting side first. */
  options: (state: FreeState) => { pair: [string, string]; value: number }[];
  /** P(my pair beats theirs), for display. */
  win: (mine: [string, string], theirs: [string, string]) => number;
}

const NO_PENDING = 0;

export function createFreeSolver(
  team: PairingPlayer[],
  opponents: PairingPlayer[],
  course: CourseRound,
): FreeSolver {
  const myNames = team.map((p) => p.name);
  const theirNames = opponents.map((p) => p.name);
  const bit = (names: string[]) => new Map(names.map((n, i) => [n, 1 << i]));
  const myBit = bit(myNames);
  const theirBit = bit(theirNames);

  const index = (names: string[], bits: Map<string, number>): IndexedPair[] =>
    allPairs(names).map(([a, b], id) => ({ id, mask: bits.get(a)! | bits.get(b)!, players: [a, b] }));
  const myPairs = index(myNames, myBit);
  const theirPairs = index(theirNames, theirBit);
  const myById = new Map(myPairs.map((p) => [pairKey(p.players), p]));
  const theirById = new Map(theirPairs.map((p) => [pairKey(p.players), p]));

  const nets = new Map([...team, ...opponents].map((p) => [p.name, netDistribution(p, course)] as const));
  const [lo, hi] = integrationBounds([...nets.values()]);
  const dist = (p: IndexedPair) => pairDistribution(nets.get(p.players[0])!, nets.get(p.players[1])!);
  const myDist = myPairs.map(dist);
  const theirDist = theirPairs.map(dist);

  const width = theirPairs.length;
  const winTable = new Float64Array(myPairs.length * width);
  for (const m of myPairs) {
    for (const t of theirPairs) {
      winTable[m.id * width + t.id] = winProbability(myDist[m.id], theirDist[t.id], lo, hi);
    }
  }

  const memo = new Map<number, number>();

  /**
   * `pending` is 0 for none, otherwise the pair id plus one; `pendingBy` only matters when
   * something is pending, and doubles as "whose throw" when nothing is.
   */
  function search(myMask: number, theirMask: number, pending: number, pendingBy: Side): number {
    const key = myMask | (theirMask << 8) | (pending << 16) | (pendingBy === "me" ? 1 << 22 : 0);
    const cached = memo.get(key);
    if (cached !== undefined) return cached;

    const answering = pending !== NO_PENDING;
    const actor: Side = answering ? (pendingBy === "me" ? "them" : "me") : pendingBy;
    const mine = actor === "me";
    const pool = mine ? myPairs : theirPairs;
    const poolMask = mine ? myMask : theirMask;

    let best = mine ? -Infinity : Infinity;
    for (const choice of pool) {
      if ((choice.mask & poolMask) !== choice.mask) continue; // a golfer already used
      const nextMy = mine ? myMask & ~choice.mask : myMask;
      const nextTheir = mine ? theirMask : theirMask & ~choice.mask;

      let value: number;
      if (answering) {
        const settled = mine
          ? winTable[choice.id * width + (pending - 1)]
          : winTable[(pending - 1) * width + choice.id];
        value =
          nextMy === 0 && nextTheir === 0
            ? settled
            : settled + search(nextMy, nextTheir, NO_PENDING, actor);
      } else {
        value = search(nextMy, nextTheir, choice.id + 1, actor);
      }

      if (mine ? value > best : value < best) best = value;
    }

    const result = best === Infinity || best === -Infinity ? 0 : best;
    memo.set(key, result);
    return result;
  }

  const maskOf = (names: string[], bits: Map<string, number>) =>
    names.reduce((mask, n) => mask | (bits.get(n) ?? 0), 0);

  const decode = (state: FreeState) => ({
    myMask: maskOf(state.myAvailable, myBit),
    theirMask: maskOf(state.theirAvailable, theirBit),
    pending: state.pending
      ? ((state.pending.by === "me" ? myById : theirById).get(pairKey(state.pending.pair))?.id ?? -1) + 1
      : NO_PENDING,
    pendingBy: state.pending ? state.pending.by : state.toThrow,
  });

  const actorOf = (state: FreeState): Side =>
    state.pending ? (state.pending.by === "me" ? "them" : "me") : state.toThrow;

  return {
    actor: actorOf,
    win: (mine, theirs) =>
      winTable[myById.get(pairKey(mine))!.id * width + theirById.get(pairKey(theirs))!.id],
    value: (state) => {
      const { myMask, theirMask, pending, pendingBy } = decode(state);
      return search(myMask, theirMask, pending, pendingBy);
    },
    options: (state) => {
      const { myMask, theirMask, pending } = decode(state);
      const actor = actorOf(state);
      const mine = actor === "me";
      const pool = mine ? myPairs : theirPairs;
      const poolMask = mine ? myMask : theirMask;

      return pool
        .filter((c) => (c.mask & poolMask) === c.mask)
        .map((choice) => {
          const nextMy = mine ? myMask & ~choice.mask : myMask;
          const nextTheir = mine ? theirMask : theirMask & ~choice.mask;
          if (pending === NO_PENDING) {
            return { pair: choice.players, value: search(nextMy, nextTheir, choice.id + 1, actor) };
          }
          const settled = mine
            ? winTable[choice.id * width + (pending - 1)]
            : winTable[(pending - 1) * width + choice.id];
          return {
            pair: choice.players,
            value:
              nextMy === 0 && nextTheir === 0
                ? settled
                : settled + search(nextMy, nextTheir, NO_PENDING, actor),
          };
        })
        .sort((x, y) => (mine ? y.value - x.value : x.value - y.value));
    },
  };
}
