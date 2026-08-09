/**
 * Checks for the pairing maths in src/lib/pairings.ts. Run with `npm test`.
 *
 * The throw-and-counter solver is easy to get subtly wrong — an earlier version
 * complemented the win probability when the opponent answered one of my thrown pairs,
 * which is invisible on a symmetric matrix and wrong everywhere else. The asymmetric
 * hand-worked case below is what catches that class of bug.
 */

import {
  createFreeSolver,
  evaluateLineups,
  integrationBounds,
  netDistribution,
  pairDistribution,
  rankLineups,
  solveFromThrow,
  winProbability,
  type PairingPlayer,
  type SolverContext,
} from "../src/lib/pairings";
import type { CourseRound } from "../src/lib/course-math";

let failures = 0;

function check(label: string, actual: number, expected: number, tolerance = 0.001) {
  const ok = Math.abs(actual - expected) <= tolerance;
  if (!ok) failures++;
  console.log(`${ok ? "pass" : "FAIL"}  ${label}: got ${actual.toFixed(4)}, expected ${expected.toFixed(4)}`);
}

// --- Throw-and-counter solver -------------------------------------------------

// My pair 0 always beats their pair 0 and always loses to their pair 1; my pair 1 is a
// coin flip against both. Worked by hand: whoever throws first is exposed, because the
// answering side gets to pick against a known pair and still throws next.
const asymmetric: SolverContext = { winProb: [[1, 0], [0.5, 0.5]] };
const twoEach = { myRemaining: [0, 1], theirRemaining: [0, 1], pending: null };
check("asymmetric 2x2, I throw first", solveFromThrow(asymmetric, { ...twoEach, toThrow: "me" }).value, 0.5);
check("asymmetric 2x2, they throw first", solveFromThrow(asymmetric, { ...twoEach, toThrow: "them" }).value, 1.5);

const even: SolverContext = { winProb: Array.from({ length: 4 }, () => Array(4).fill(0.5)) };
const fourEach = { myRemaining: [0, 1, 2, 3], theirRemaining: [0, 1, 2, 3], pending: null };
check("dead-even 4x4, I throw first", solveFromThrow(even, { ...fourEach, toThrow: "me" }).value, 2);
check("dead-even 4x4, they throw first", solveFromThrow(even, { ...fourEach, toThrow: "them" }).value, 2);

// Solving the mirrored matrix from the other side must complement to four matches.
const sample = [
  [0.52, 0.5, 0.5, 0.48],
  [0.53, 0.51, 0.51, 0.48],
  [0.47, 0.45, 0.46, 0.43],
  [0.42, 0.39, 0.4, 0.38],
];
const mirrored = sample[0].map((_, j) => sample.map((row) => 1 - row[j]));
check(
  "zero-sum: my value + their value",
  solveFromThrow({ winProb: sample }, { ...fourEach, toThrow: "me" }).value +
    solveFromThrow({ winProb: mirrored }, { ...fourEach, toThrow: "them" }).value,
  4,
);

// --- Distributions ------------------------------------------------------------

const course: CourseRound = {
  round: "Test",
  format: "2-Man Best Ball",
  course: "Test",
  tees: "Blue",
  rating: 72,
  slope: 113,
  par: 72,
  allowancePct: 1,
};

// At slope 113 with a full allowance, net-to-par collapses to the golfer's own gap.
const scratch: PairingPlayer = { name: "A", handicapIndex: 0, adjustedGap: 3, spread: 3 };
check("net distribution mu", netDistribution(scratch, course).mu, 3);
check("net distribution sigma", netDistribution(scratch, course).sigma, 3);

// E[min] of two identical normals is mu - sigma/sqrt(pi).
const same = { mu: 5, sigma: 4 };
check("E[min] of identical normals", pairDistribution(same, same).expected, 5 - 4 / Math.sqrt(Math.PI));

// A pair can only ever help, and two identical pairs are a coin flip.
const pair = pairDistribution(same, same);
const [lo, hi] = integrationBounds([same, same]);
check("identical pairs are 50/50", winProbability(pair, pair, lo, hi), 0.5);

const stronger = pairDistribution({ mu: 2, sigma: 4 }, { mu: 2, sigma: 4 });
check(
  "win probabilities complement",
  winProbability(stronger, pair, lo, hi) + winProbability(pair, stronger, lo, hi),
  1,
);

// --- Lineup enumeration -------------------------------------------------------

const team: PairingPlayer[] = Array.from({ length: 8 }, (_, i) => ({
  name: `P${i}`,
  handicapIndex: i * 2,
  adjustedGap: 2,
  spread: 3,
}));
const lineups = rankLineups(team, course);
check("eight players yield 105 lineups", lineups.length, 105);
check("lineups are sorted best first", lineups[0].total <= lineups[104].total ? 1 : 0, 1);
const everyPlayerUsedOnce = lineups.every(
  (l) => new Set(l.pairs.flatMap((p) => p.players)).size === 8,
);
check("every lineup uses each player exactly once", everyPlayerUsedOnce ? 1 : 0, 1);

// --- Match-play lineup evaluation ---------------------------------------------

// Eight golfers split into two clear tiers, facing four even opponents.
const tiered: PairingPlayer[] = [
  ...Array.from({ length: 4 }, (_, i) => ({ name: `Good${i}`, handicapIndex: 5, adjustedGap: 1, spread: 3 })),
  ...Array.from({ length: 4 }, (_, i) => ({ name: `Weak${i}`, handicapIndex: 25, adjustedGap: 6, spread: 3 })),
];
const foes: PairingPlayer[] = Array.from({ length: 8 }, (_, i) => ({
  name: `Foe${i}`,
  handicapIndex: 15,
  adjustedGap: 3,
  spread: 3,
}));
const foePairs: [string, string][] = [
  ["Foe0", "Foe1"],
  ["Foe2", "Foe3"],
  ["Foe4", "Foe5"],
  ["Foe6", "Foe7"],
];
const evals = evaluateLineups(tiered, foes, foePairs, course, "them");
check("evaluateLineups covers all 105 lineups", evals.length, 105);
check("evaluations are sorted by matches won", evals[0].matches >= evals[104].matches ? 1 : 0, 1);
check("expected matches stay within [0, 4]", evals.every((e) => e.matches >= 0 && e.matches <= 4) ? 1 : 0, 1);
// Selection is stored as an index into the stroke-ranked order, so re-sorting the view by
// matches must not shift what an index refers to. Compared by content, not identity.
const strokeOrder = rankLineups(tiered, course);
const asNames = (l: (typeof strokeOrder)[number]) =>
  l.pairs
    .map((p) => [...p.players].sort().join("+"))
    .sort()
    .join(" ");
check(
  "indices point back at the stroke-ranked order",
  evals.every((e) => asNames(e.lineup) === asNames(strokeOrder[e.index])) ? 1 : 0,
  1,
);
// Stacking both strong players together wastes one of them: the lineup that pairs the
// four good golfers into two pairs should not beat spreading them one per pair.
const spread = evals.find((e) => e.lineup.pairs.every((p) => p.players.some((n) => n.startsWith("Good")) && p.players.some((n) => n.startsWith("Weak"))))!;
const stacked = evals.find((e) => e.lineup.pairs.some((p) => p.players.every((n) => n.startsWith("Weak"))))!;
check("spreading strength beats stacking it", spread.matches > stacked.matches ? 1 : 0, 1);

// --- Free pairing -------------------------------------------------------------

// Two identical teams: every pair is interchangeable, so every matchup is a coin flip and
// the exchange is worth exactly half the matches however it is played.
const clones = (prefix: string): PairingPlayer[] =>
  Array.from({ length: 8 }, (_, i) => ({
    name: `${prefix}${i}`,
    handicapIndex: 12,
    adjustedGap: 3,
    spread: 3,
  }));
const mirrorA = clones("A");
const mirrorB = clones("B");
const mirror = createFreeSolver(mirrorA, mirrorB, course);
const openState = {
  myAvailable: mirrorA.map((p) => p.name),
  theirAvailable: mirrorB.map((p) => p.name),
  pending: null,
};
check("identical teams, they throw first", mirror.value({ ...openState, toThrow: "them" }), 2);
check("identical teams, I throw first", mirror.value({ ...openState, toThrow: "me" }), 2);

// The opening throw picks from every combination of eight, not from a fixed four.
check("opening throw has 28 options", mirror.options({ ...openState, toThrow: "them" }).length, 28);

// Walking the exchange, the option count follows C(8,2), C(6,2), C(4,2), C(2,2).
const expectedCounts = [28, 28, 15, 15, 6, 6, 1, 1];
let walk: Parameters<typeof mirror.options>[0] = { ...openState, toThrow: "them" };
const seenCounts: number[] = [];
for (let step = 0; step < 8; step++) {
  const opts = mirror.options(walk);
  if (opts.length === 0) break;
  seenCounts.push(opts.length);
  const actor = mirror.actor(walk);
  const pool = actor === "me" ? walk.myAvailable : walk.theirAvailable;
  const rest = pool.filter((n) => !opts[0].pair.includes(n));
  const myAvailable = actor === "me" ? rest : walk.myAvailable;
  const theirAvailable = actor === "them" ? rest : walk.theirAvailable;
  walk = walk.pending
    ? { myAvailable, theirAvailable, pending: null, toThrow: actor }
    : { myAvailable, theirAvailable, pending: { pair: opts[0].pair, by: actor }, toThrow: actor };
}
check(
  "option count shrinks 28/15/6/1 as golfers are used",
  seenCounts.join(",") === expectedCounts.join(",") ? 1 : 0,
  1,
);

// A team that outclasses its opponent should win nearly everything regardless of play.
const strong = Array.from({ length: 8 }, (_, i) => ({ name: `S${i}`, handicapIndex: 2, adjustedGap: 0, spread: 1 }));
const feeble = Array.from({ length: 8 }, (_, i) => ({ name: `F${i}`, handicapIndex: 2, adjustedGap: 20, spread: 1 }));
const lopsided = createFreeSolver(strong, feeble, course);
const lopsidedValue = lopsided.value({
  myAvailable: strong.map((p) => p.name),
  theirAvailable: feeble.map((p) => p.name),
  pending: null,
  toThrow: "them",
});
check("a far stronger team wins nearly all four", lopsidedValue, 4, 0.01);

console.log(failures === 0 ? "\nAll checks passed." : `\n${failures} check(s) failed.`);
process.exit(failures === 0 ? 0 : 1);
