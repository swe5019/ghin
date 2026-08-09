"use client";

import { useEffect, useMemo, useState } from "react";
import { isBestBall, type CourseRound } from "@/lib/course-math";
import {
  integrationBounds,
  netDistribution,
  pairDistribution,
  rankAllPairs,
  winProbability,
  type Pair,
  type PairingPlayer,
} from "@/lib/pairings";
import type { RosterPlayer, RosterResponse } from "@/types/draft";

const first = (name: string) => name.split(" ")[0];
const label = (pair: [string, string]) => `${first(pair[0])} + ${first(pair[1])}`;

/**
 * Diverging fill around an even match. The base surface is a CSS variable so one
 * expression works in both themes — see the token block on the wrapper below.
 */
function heat(winPct: number): string {
  const t = Math.max(-1, Math.min(1, (winPct - 50) / 25));
  const strength = Math.round(Math.abs(t) * 58);
  return `color-mix(in oklab, var(${t >= 0 ? "--heat-good" : "--heat-bad"}) ${strength}%, var(--heat-base))`;
}

export function MatrixView({ initialRoster }: { initialRoster: RosterResponse }) {
  const [roster, setRoster] = useState(initialRoster);
  const [courseIdx, setCourseIdx] = useState(0);
  const [highlight, setHighlight] = useState<string | null>(null);
  const [selected, setSelected] = useState<[number, number] | null>(null);

  // GitHub Pages caches the HTML, so re-read the data on mount rather than trusting
  // whatever was baked into this bundle.
  useEffect(() => {
    const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
    void fetch(`${basePath}/roster.json?t=${Date.now()}`, { cache: "no-store" })
      .then((res) => (res.ok ? res.json() : null))
      .then((body: RosterResponse | null) => body?.players?.length && setRoster(body))
      .catch(() => {});
  }, []);

  const bestBallRounds = useMemo(
    () => (roster.courses?.rounds ?? []).filter(isBestBall),
    [roster.courses],
  );
  const course: CourseRound | undefined = bestBallRounds[courseIdx];

  const byName = useMemo(() => new Map(roster.players.map((p) => [p.name, p])), [roster.players]);
  const toPairing = (p: RosterPlayer): PairingPlayer => ({
    name: p.name,
    handicapIndex: p.handicapIndex,
    adjustedGap: p.adjustedGap,
    spread: p.spread,
  });

  // Memoised so the fallback array literal doesn't produce a new identity each render.
  const myNames = useMemo(() => roster.teams?.B ?? [], [roster.teams]);
  const theirNames = useMemo(() => roster.teams?.A ?? [], [roster.teams]);
  const myTeam = useMemo(
    () => myNames.map((n) => byName.get(n)).filter((p): p is RosterPlayer => !!p),
    [myNames, byName],
  );
  const theirTeam = useMemo(
    () => theirNames.map((n) => byName.get(n)).filter((p): p is RosterPlayer => !!p),
    [theirNames, byName],
  );

  const model = useMemo(() => {
    if (!course || myTeam.length < 2 || theirTeam.length < 2) return null;
    const mine = rankAllPairs(myTeam.map(toPairing), course);
    const theirs = rankAllPairs(theirTeam.map(toPairing), course);
    const nets = new Map(
      [...myTeam, ...theirTeam].map((p) => [p.name, netDistribution(toPairing(p), course)]),
    );
    const dist = (p: Pair) => pairDistribution(nets.get(p.players[0])!, nets.get(p.players[1])!);
    const [lo, hi] = integrationBounds([...nets.values()]);
    const md = mine.map(dist);
    const td = theirs.map(dist);
    const matrix = md.map((a) => td.map((b) => Math.round(winProbability(a, b, lo, hi) * 100)));
    return { mine, theirs, matrix };
  }, [course, myTeam, theirTeam]);

  if (!course || !model) {
    return (
      <div className="mx-auto max-w-6xl p-4">
        <p className="rounded-lg border border-dashed border-zinc-300 p-6 text-center text-sm text-zinc-500 dark:border-zinc-700 dark:text-zinc-400">
          Needs both teams and a best-ball course. Check data/teams.json.
        </p>
      </div>
    );
  }

  const { mine, theirs, matrix } = model;
  const flat = matrix.flat();
  const favoured = flat.filter((v) => v > 50).length;
  const total = flat.length;

  const dimRow = (p: Pair) => highlight !== null && myNames.includes(highlight) && !p.players.includes(highlight);
  const dimCol = (p: Pair) => highlight !== null && theirNames.includes(highlight) && !p.players.includes(highlight);

  const readout = selected
    ? {
        pct: matrix[selected[0]][selected[1]],
        mine: mine[selected[0]],
        theirs: theirs[selected[1]],
      }
    : null;

  return (
    <div
      className="mx-auto flex max-w-6xl flex-col gap-4 p-3 sm:p-4 [--heat-bad:#e11d48] [--heat-base:#ffffff] [--heat-good:#059669] dark:[--heat-bad:#fb7185] dark:[--heat-base:#09090b] dark:[--heat-good:#34d399]"
    >
      <header>
        <h1 className="text-xl font-bold text-zinc-900 dark:text-zinc-100">All pairings</h1>
        <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
          Every two-man combination on each team, and all {total} matchups between them. Expected
          scores are net to par at this course, after the {Math.round(course.allowancePct * 100)}%
          allowance.
        </p>
      </header>

      <div className="flex gap-1.5">
        {bestBallRounds.map((r, i) => (
          <button
            key={r.round}
            onClick={() => {
              setCourseIdx(i);
              setSelected(null);
            }}
            className={`flex-1 rounded-md border px-3 py-2 text-left text-xs ${
              i === courseIdx
                ? "border-zinc-900 bg-zinc-900 text-white dark:border-zinc-100 dark:bg-zinc-100 dark:text-zinc-900"
                : "border-zinc-300 text-zinc-600 dark:border-zinc-700 dark:text-zinc-300"
            }`}
          >
            <span className="block font-semibold">{r.round}</span>
            <span className="block opacity-75">
              {r.course.replace(/^Palmetto Dunes - /, "")} · {r.rating}/{r.slope}
            </span>
          </button>
        ))}
      </div>

      <dl className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {[
          ["Your best pair", label(mine[0].players), mine[0].expected.toFixed(2)],
          ["Your worst pair", label(mine[mine.length - 1].players), mine[mine.length - 1].expected.toFixed(2)],
          ["Their best pair", label(theirs[0].players), theirs[0].expected.toFixed(2)],
          ["Matchups you'd win", `${favoured} of ${total}`, `${Math.round((100 * favoured) / total)}%`],
        ].map(([k, v, s]) => (
          <div key={k} className="rounded-md border border-zinc-200 bg-white p-2 dark:border-zinc-800 dark:bg-zinc-950">
            <dt className="text-[10px] uppercase tracking-wide text-zinc-400 dark:text-zinc-500">{k}</dt>
            <dd className="truncate text-sm font-medium text-zinc-900 dark:text-zinc-100">{v}</dd>
            <dd className="text-[11px] tabular-nums text-zinc-500 dark:text-zinc-400">{s}</dd>
          </div>
        ))}
      </dl>

      <section>
        <h2 className="mb-1 font-semibold text-zinc-900 dark:text-zinc-100">Highlight a golfer</h2>
        <p className="mb-2 text-xs text-zinc-500 dark:text-zinc-400">
          Show only the pairs containing them — the quickest way to see someone&apos;s real options.
        </p>
        {[
          ["Yours", myNames],
          ["Theirs", theirNames],
        ].map(([heading, names]) => (
          <div key={heading as string} className="mb-1.5 flex flex-wrap items-center gap-1">
            <span className="w-12 shrink-0 text-[10px] uppercase tracking-wide text-zinc-400 dark:text-zinc-500">
              {heading}
            </span>
            {(names as string[]).map((n) => (
              <button
                key={n}
                onClick={() => setHighlight(highlight === n ? null : n)}
                className={`rounded px-2 py-1 text-xs ${
                  highlight === n
                    ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
                    : "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300"
                }`}
              >
                {first(n)}
              </button>
            ))}
          </div>
        ))}
      </section>

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        {[
          ["Your", mine, dimRow] as const,
          ["Their", theirs, dimCol] as const,
        ].map(([who, list, isDim]) => (
          <section
            key={who}
            className="rounded-lg border border-zinc-200 bg-white p-3 dark:border-zinc-800 dark:bg-zinc-950"
          >
            <h2 className="mb-2 font-semibold text-zinc-900 dark:text-zinc-100">
              {who} {list.length} pairs
            </h2>
            <ol className="flex flex-col">
              {list.map((p, i) => (
                <li
                  key={label(p.players)}
                  className={`flex items-center gap-2 border-t border-zinc-100 py-1 text-sm first:border-0 dark:border-zinc-900 ${
                    isDim(p) ? "opacity-30" : ""
                  }`}
                >
                  <span className="w-5 shrink-0 text-xs tabular-nums text-zinc-400 dark:text-zinc-600">
                    {i + 1}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-zinc-900 dark:text-zinc-100">
                    {label(p.players)}
                  </span>
                  <span className="tabular-nums text-zinc-500 dark:text-zinc-400">
                    {p.expected.toFixed(2)}
                  </span>
                </li>
              ))}
            </ol>
          </section>
        ))}
      </div>

      <section className="flex flex-col gap-2">
        <h2 className="font-semibold text-zinc-900 dark:text-zinc-100">
          Head-to-head — {total} matchups
        </h2>
        <p className="text-xs text-zinc-500 dark:text-zinc-400">
          Each cell is the chance your pair (row) posts the lower better ball. Read down a column to
          see what beats a pair they might throw.
        </p>

        <div className="rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm dark:border-zinc-800 dark:bg-zinc-950">
          {readout ? (
            <span className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
              <span className="text-base font-semibold tabular-nums text-zinc-900 dark:text-zinc-100">
                {readout.pct}%
              </span>
              <span className="text-zinc-900 dark:text-zinc-100">{label(readout.mine.players)}</span>
              <span className="text-zinc-400 dark:text-zinc-600">vs</span>
              <span className="text-zinc-900 dark:text-zinc-100">{label(readout.theirs.players)}</span>
            </span>
          ) : (
            <span className="text-zinc-400 dark:text-zinc-600">Tap a cell for the matchup.</span>
          )}
        </div>

        <div className="max-h-[75vh] overflow-auto rounded-lg border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950">
          <table className="border-separate border-spacing-0 text-[11px] tabular-nums">
            <thead>
              <tr>
                <th className="sticky left-0 top-0 z-30 border-b border-r border-zinc-300 bg-zinc-50 px-2 text-left align-bottom text-[10px] font-medium text-zinc-400 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-500">
                  you ↓ them →
                </th>
                {theirs.map((p) => (
                  <th
                    key={label(p.players)}
                    className={`sticky top-0 z-20 h-24 border-b border-r border-zinc-200 bg-zinc-50 px-1 align-bottom font-medium text-zinc-500 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400 ${
                      dimCol(p) ? "opacity-20" : ""
                    }`}
                  >
                    <span className="block [writing-mode:vertical-rl] [transform:rotate(180deg)]">
                      {label(p.players)}
                    </span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {mine.map((mp, i) => (
                <tr key={label(mp.players)} className={dimRow(mp) ? "opacity-20" : ""}>
                  <th className="sticky left-0 z-10 whitespace-nowrap border-b border-r border-zinc-300 bg-zinc-50 px-2 py-0.5 text-left font-medium text-zinc-900 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100">
                    {label(mp.players)}
                  </th>
                  {theirs.map((tp, j) => {
                    const v = matrix[i][j];
                    const on = selected?.[0] === i && selected?.[1] === j;
                    return (
                      <td
                        key={label(tp.players)}
                        onClick={() => setSelected([i, j])}
                        style={{ background: heat(v) }}
                        className={`border-b border-r border-zinc-200 text-center dark:border-zinc-800 ${
                          dimCol(tp) ? "opacity-20" : ""
                        } ${on ? "outline outline-2 -outline-offset-2 outline-zinc-900 dark:outline-zinc-100" : ""}`}
                      >
                        {/* Golf's own marks, so the reading doesn't rest on colour alone. */}
                        <span
                          className={`inline-block min-w-[1.6rem] px-1 py-px font-medium text-zinc-900 dark:text-zinc-100 ${
                            v >= 60
                              ? "rounded-full border border-current"
                              : v <= 40
                                ? "border border-current"
                                : ""
                          }`}
                        >
                          {v}
                        </span>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <p className="text-[11px] leading-relaxed text-zinc-400 dark:text-zinc-600">
        Four-ball here takes the better of two round totals, while the real format takes the better
        ball on every hole — so these understate how much a partner helps. Halved matches
        aren&apos;t modelled. With individual spreads of three to six strokes against pair-to-pair
        gaps under one, most of this grid is closer to a coin flip than the colours suggest.
      </p>
    </div>
  );
}
