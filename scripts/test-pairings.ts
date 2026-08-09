/**
 * Checks for the pairing maths in src/lib/pairings.ts. Run with `npm test`.
 *
 * The throw-and-counter solver is easy to get subtly wrong — an earlier version
 * complemented the win probability when the opponent answered one of my thrown pairs,
 * which is invisible on a symmetric matrix and wrong everywhere else. The asymmetric
 * hand-worked case below is what catches that class of bug.
 */

import {
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

console.log(failures === 0 ? "\nAll checks passed." : `\n${failures} check(s) failed.`);
process.exit(failures === 0 ? 0 : 1);
