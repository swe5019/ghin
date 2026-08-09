"use client";

import { useEffect, useMemo, useState } from "react";
import { isBestBall, type CourseRound } from "@/lib/course-math";
import {
  integrationBounds,
  netDistribution,
  pairDistribution,
  rankLineups,
  rankOptions,
  solveFromPending,
  solveFromThrow,
  winProbability,
  type PairingPlayer,
  type Side,
  type SolverContext,
  type ThrowState,
} from "@/lib/pairings";
import type { RosterPlayer, RosterResponse } from "@/types/draft";

type NamePair = [string, string];

/** One recorded action in the live pairings draft. */
interface DraftEvent {
  type: "throw" | "counter";
  side: Side;
  pair: NamePair;
}

const STORAGE_KEY = "ghin-pairings-v1";
const first = (name: string) => name.split(" ")[0];
const label = (pair: NamePair) => `${first(pair[0])} + ${first(pair[1])}`;
const keyOf = (pair: NamePair) => [...pair].sort().join("|");

export function PairingsView({ initialRoster }: { initialRoster: RosterResponse }) {
  const [roster, setRoster] = useState(initialRoster);
  const [courseIdx, setCourseIdx] = useState(0);
  const [myLineupIdx, setMyLineupIdx] = useState(0);
  const [showAlternatives, setShowAlternatives] = useState(false);
  const [firstThrow, setFirstThrow] = useState<Side>("them");
  const [events, setEvents] = useState<DraftEvent[]>([]);
  const [picking, setPicking] = useState<string[]>([]);

  // Same freshness trick as the draft board: GitHub Pages caches the HTML, so re-fetch
  // the data on mount rather than trusting whatever was baked into this bundle.
  useEffect(() => {
    const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
     
    void fetch(`${basePath}/roster.json?t=${Date.now()}`, { cache: "no-store" })
      .then((res) => (res.ok ? res.json() : null))
      .then((body: RosterResponse | null) => body?.players?.length && setRoster(body))
      .catch(() => {});
  }, []);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const saved = JSON.parse(raw) as { events?: DraftEvent[]; firstThrow?: Side; myLineupIdx?: number };
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (saved.events) setEvents(saved.events);
       
      if (saved.firstThrow) setFirstThrow(saved.firstThrow);
       
      if (typeof saved.myLineupIdx === "number") setMyLineupIdx(saved.myLineupIdx);
    } catch {
      /* a corrupt saved draft just starts fresh */
    }
  }, []);

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ events, firstThrow, myLineupIdx }));
  }, [events, firstThrow, myLineupIdx]);

  const bestBallRounds = useMemo(
    () => (roster.courses?.rounds ?? []).filter(isBestBall),
    [roster.courses],
  );
  const course: CourseRound | undefined = bestBallRounds[courseIdx];

  const byName = useMemo(
    () => new Map(roster.players.map((p) => [p.name, p])),
    [roster.players],
  );
  const toPairing = (p: RosterPlayer): PairingPlayer => ({
    name: p.name,
    handicapIndex: p.handicapIndex,
    adjustedGap: p.adjustedGap,
    spread: p.spread,
  });

  const myTeam = useMemo(
    () => (roster.teams?.B ?? []).map((n) => byName.get(n)).filter((p): p is RosterPlayer => !!p),
    [roster.teams, byName],
  );
  const theirTeam = useMemo(
    () => (roster.teams?.A ?? []).map((n) => byName.get(n)).filter((p): p is RosterPlayer => !!p),
    [roster.teams, byName],
  );

  // Their lineup is a hypothesis until they expose it. Any pair they've actually thrown
  // or answered with is locked in, and the rest is completed with their best remaining
  // pairing — so the plan sharpens as the exchange goes on.
  const revealed = useMemo(
    () => events.filter((e) => e.side === "them").map((e) => e.pair),
    [events],
  );

  const myLineups = useMemo(
    () => (course && myTeam.length === 8 ? rankLineups(myTeam.map(toPairing), course) : []),
    [myTeam, course],
  );

  const myPairs: NamePair[] = useMemo(
    () => myLineups[Math.min(myLineupIdx, myLineups.length - 1)]?.pairs.map((p) => p.players) ?? [],
    [myLineups, myLineupIdx],
  );

  const theirPairs: NamePair[] = useMemo(() => {
    if (!course || theirTeam.length !== 8) return [];
    const lockedNames = new Set(revealed.flat());
    const rest = theirTeam.filter((p) => !lockedNames.has(p.name));
    if (rest.length === 0) return revealed;
    const completion = rankLineups(rest.map(toPairing), course)[0];
    return [...revealed, ...(completion?.pairs.map((p) => p.players) ?? [])];
  }, [theirTeam, course, revealed]);

  const model = useMemo(() => {
    if (!course || myPairs.length !== 4 || theirPairs.length !== 4) return null;
    const nets = new Map(
      [...myTeam, ...theirTeam].map((p) => [p.name, netDistribution(toPairing(p), course)]),
    );
    const dist = (pair: NamePair) => pairDistribution(nets.get(pair[0])!, nets.get(pair[1])!);
    const mine = myPairs.map(dist);
    const theirs = theirPairs.map(dist);
    const [lo, hi] = integrationBounds([...nets.values()]);
    const winProb = mine.map((a) => theirs.map((b) => winProbability(a, b, lo, hi)));
    return { mine, theirs, winProb };
  }, [course, myPairs, theirPairs, myTeam, theirTeam]);

  // Replay the recorded events into a solver state.
  const live = useMemo(() => {
    if (!model) return null;
    const myIdx = new Map(myPairs.map((p, i) => [keyOf(p), i]));
    const theirIdx = new Map(theirPairs.map((p, i) => [keyOf(p), i]));

    let myRemaining = [0, 1, 2, 3];
    let theirRemaining = [0, 1, 2, 3];
    let pending: ThrowState["pending"] = null;
    let toThrow: Side = firstThrow;
    const matches: { mine: number; theirs: number }[] = [];

    for (const event of events) {
      const index = (event.side === "me" ? myIdx : theirIdx).get(keyOf(event.pair));
      if (index === undefined) continue;
      if (event.side === "me") myRemaining = myRemaining.filter((i) => i !== index);
      else theirRemaining = theirRemaining.filter((i) => i !== index);

      if (event.type === "throw") {
        pending = { index, by: event.side };
      } else if (pending) {
        matches.push(
          event.side === "me"
            ? { mine: index, theirs: pending.index }
            : { mine: pending.index, theirs: index },
        );
        pending = null;
        // Whoever answers immediately throws next.
        toThrow = event.side;
      }
    }

    const done = myRemaining.length === 0 && theirRemaining.length === 0 && !pending;
    const actor: Side | null = done ? null : pending ? (pending.by === "me" ? "them" : "me") : toThrow;
    const state: ThrowState = { myRemaining, theirRemaining, pending, toThrow };
    const ctx: SolverContext = { winProb: model.winProb };
    const decision = done ? null : pending ? solveFromPending(ctx, state) : solveFromThrow(ctx, state);
    const options = done ? [] : rankOptions(ctx, state);

    return { state, actor, decision, options, matches, done, pointsSoFar: matches.reduce((s, m) => s + model.winProb[m.mine][m.theirs], 0) };
  }, [model, events, firstThrow, myPairs, theirPairs]);

  const partnershipFor = (pair: NamePair) => {
    const p = byName.get(pair[0]);
    const found = p?.partnerships.find((x) => x.pair.includes(pair[1]));
    return found ? `${found.w}-${found.l}-${found.h}` : null;
  };

  if (!course || myTeam.length !== 8 || theirTeam.length !== 8 || !model || !live) {
    return (
      <div className="mx-auto max-w-5xl p-4">
        <p className="rounded-lg border border-dashed border-zinc-300 p-6 text-center text-sm text-zinc-500 dark:border-zinc-700 dark:text-zinc-400">
          Pairings need both eight-player teams and a best-ball course. Check data/teams.json.
        </p>
      </div>
    );
  }

  const recordEvent = (type: DraftEvent["type"], side: Side, pair: NamePair) =>
    setEvents((prev) => [...prev, { type, side, pair }]);

  const theirAvailablePlayers = theirPairs
    .filter((_, i) => live.state.theirRemaining.includes(i))
    .flat();

  const commitPick = () => {
    if (picking.length !== 2) return;
    recordEvent(live.state.pending ? "counter" : "throw", "them", [picking[0], picking[1]] as NamePair);
    setPicking([]);
  };

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-4 p-3 sm:p-4">
      <header>
        <h1 className="text-xl font-bold text-zinc-900 dark:text-zinc-100">Pairings</h1>
        <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
          Throw-and-counter assistant. Win % is each pair&apos;s share of the head-to-head, from
          expected net scores at this course.
        </p>
      </header>

      <div className="flex gap-1.5">
        {bestBallRounds.map((r, i) => (
          <button
            key={r.round}
            onClick={() => setCourseIdx(i)}
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

      {/* ---- live assistant ---- */}
      <section className="rounded-lg border border-emerald-300 bg-emerald-50 p-3 dark:border-emerald-900 dark:bg-emerald-950/40">
        {live.done ? (
          <p className="font-semibold text-emerald-900 dark:text-emerald-200">
            All four matches set — projected {live.pointsSoFar.toFixed(2)} of 4.
          </p>
        ) : (
          <>
            <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
              <p className="font-semibold text-emerald-900 dark:text-emerald-200">
                {live.actor === "me"
                  ? live.state.pending
                    ? "Your answer"
                    : "Your throw"
                  : live.state.pending
                    ? "They answer your pair"
                    : "They throw"}
              </p>
              {/* The solver only values the matches still to be set, so settled ones are
                  added back in — otherwise the total shrinks as the exchange goes on. */}
              <p className="text-right text-xs text-emerald-800 dark:text-emerald-300">
                projected {(live.pointsSoFar + (live.decision?.value ?? 0)).toFixed(2)} of 4
                {live.matches.length > 0 && (
                  <span className="block opacity-75">
                    {live.pointsSoFar.toFixed(2)} settled · {live.decision?.value.toFixed(2)} still
                    to play
                  </span>
                )}
              </p>
            </div>

            {live.actor === "me" ? (
              <ul className="flex flex-col gap-1.5">
                {live.options.map((opt, rank) => (
                  <li key={opt.index}>
                    <button
                      onClick={() =>
                        recordEvent(live.state.pending ? "counter" : "throw", "me", myPairs[opt.index])
                      }
                      className={`flex w-full items-center justify-between gap-2 rounded-md border px-3 py-2 text-sm ${
                        rank === 0
                          ? "border-emerald-500 bg-white font-medium dark:border-emerald-600 dark:bg-zinc-950"
                          : "border-zinc-200 bg-white/60 dark:border-zinc-800 dark:bg-zinc-950/60"
                      }`}
                    >
                      <span className="flex items-center gap-2">
                        {rank === 0 && (
                          <span className="rounded bg-emerald-600 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-white">
                            Best
                          </span>
                        )}
                        {label(myPairs[opt.index])}
                      </span>
                      <span className="tabular-nums text-zinc-500 dark:text-zinc-400">
                        {opt.value.toFixed(2)}
                        {live.state.pending && (
                          <span className="ml-2 text-emerald-700 dark:text-emerald-400">
                            {(model.winProb[opt.index][live.state.pending.index] * 100).toFixed(0)}%
                          </span>
                        )}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <div>
                <p className="mb-2 text-xs text-emerald-800 dark:text-emerald-300">
                  Tap the two golfers they used. Expected:{" "}
                  <span className="font-medium">
                    {live.options[0] !== undefined ? label(theirPairs[live.options[0].index]) : "—"}
                  </span>
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {theirAvailablePlayers.map((name) => (
                    <button
                      key={name}
                      onClick={() =>
                        setPicking((prev) =>
                          prev.includes(name)
                            ? prev.filter((n) => n !== name)
                            : [...prev, name].slice(-2),
                        )
                      }
                      className={`rounded px-2 py-1.5 text-xs ${
                        picking.includes(name)
                          ? "bg-emerald-600 text-white"
                          : "bg-white text-zinc-700 dark:bg-zinc-900 dark:text-zinc-300"
                      }`}
                    >
                      {first(name)}
                    </button>
                  ))}
                </div>
                <button
                  onClick={commitPick}
                  disabled={picking.length !== 2}
                  className="mt-2 rounded-md bg-zinc-900 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-40 dark:bg-zinc-100 dark:text-zinc-900"
                >
                  Record their pair
                </button>
              </div>
            )}
          </>
        )}

        <div className="mt-3 flex flex-wrap items-center gap-3 border-t border-emerald-200 pt-2 text-xs dark:border-emerald-900">
          <label className="flex items-center gap-1.5 text-emerald-900 dark:text-emerald-300">
            First throw
            <select
              value={firstThrow}
              onChange={(e) => setFirstThrow(e.target.value as Side)}
              disabled={events.length > 0}
              className="rounded border border-emerald-300 bg-white px-1.5 py-0.5 disabled:opacity-50 dark:border-emerald-800 dark:bg-zinc-900"
            >
              <option value="them">Them</option>
              <option value="me">Us</option>
            </select>
          </label>
          <button
            onClick={() => setEvents((prev) => prev.slice(0, -1))}
            disabled={events.length === 0}
            className="rounded border border-emerald-300 px-2 py-0.5 disabled:opacity-40 dark:border-emerald-800"
          >
            Undo
          </button>
          <button
            onClick={() => {
              setEvents([]);
              setPicking([]);
            }}
            className="rounded border border-emerald-300 px-2 py-0.5 dark:border-emerald-800"
          >
            Reset
          </button>
        </div>
      </section>

      {live.matches.length > 0 && (
        <section className="rounded-lg border border-zinc-200 bg-white p-3 dark:border-zinc-800 dark:bg-zinc-950">
          <h2 className="mb-2 font-semibold text-zinc-900 dark:text-zinc-100">Matches set</h2>
          <ul className="flex flex-col gap-1 text-sm">
            {live.matches.map((m, i) => (
              <li key={i} className="flex items-center justify-between gap-2">
                <span className="text-zinc-900 dark:text-zinc-100">{label(myPairs[m.mine])}</span>
                <span className="tabular-nums font-medium text-zinc-700 dark:text-zinc-300">
                  {(model.winProb[m.mine][m.theirs] * 100).toFixed(0)}%
                </span>
                <span className="text-right text-zinc-500 dark:text-zinc-400">
                  {label(theirPairs[m.theirs])}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* ---- my lineup ---- */}
      <section className="rounded-lg border border-zinc-200 bg-white p-3 dark:border-zinc-800 dark:bg-zinc-950">
        <div className="mb-2 flex items-baseline justify-between gap-2">
          <h2 className="font-semibold text-zinc-900 dark:text-zinc-100">Your four pairs</h2>
          <button
            onClick={() => setShowAlternatives((v) => !v)}
            className="text-xs text-zinc-500 underline dark:text-zinc-400"
          >
            {showAlternatives ? "Hide" : "Change"}
          </button>
        </div>
        <ul className="flex flex-col gap-1.5">
          {myPairs.map((pair, i) => {
            const record = partnershipFor(pair);
            return (
              <li key={i} className="flex items-center justify-between gap-2 text-sm">
                <span className="text-zinc-900 dark:text-zinc-100">{label(pair)}</span>
                <span className="flex items-center gap-2">
                  {record && (
                    <span className="rounded bg-zinc-100 px-1.5 py-0.5 text-[10px] text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400">
                      {record} together
                    </span>
                  )}
                  <span className="tabular-nums text-zinc-500 dark:text-zinc-400">
                    {model.mine[i].expected.toFixed(2)}
                  </span>
                </span>
              </li>
            );
          })}
        </ul>

        {showAlternatives && (
          <ul className="mt-3 flex flex-col gap-1 border-t border-zinc-200 pt-2 dark:border-zinc-800">
            {myLineups.slice(0, 10).map((lineup, i) => (
              <li key={i}>
                <button
                  onClick={() => {
                    setMyLineupIdx(i);
                    setEvents([]);
                  }}
                  className={`w-full rounded px-2 py-1.5 text-left text-xs ${
                    i === myLineupIdx
                      ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
                      : "hover:bg-zinc-100 dark:hover:bg-zinc-900"
                  }`}
                >
                  <span className="tabular-nums opacity-70">{lineup.total.toFixed(2)}</span>{" "}
                  {lineup.pairs.map((p) => label(p.players)).join(" · ")}
                </button>
              </li>
            ))}
          </ul>
        )}
        {showAlternatives && (
          <p className="mt-2 text-[11px] text-zinc-500 dark:text-zinc-400">
            Changing your lineup clears the recorded exchange.
          </p>
        )}
      </section>

      {/* ---- matchup grid ---- */}
      <section className="overflow-x-auto rounded-lg border border-zinc-200 bg-white p-3 dark:border-zinc-800 dark:bg-zinc-950">
        <h2 className="mb-1 font-semibold text-zinc-900 dark:text-zinc-100">Head-to-head</h2>
        <p className="mb-2 text-xs text-zinc-500 dark:text-zinc-400">
          Their pairs are their strongest remaining split, updated as they reveal.
        </p>
        <table className="w-full min-w-[22rem] text-sm">
          <thead>
            <tr className="text-xs text-zinc-500 dark:text-zinc-400">
              <th className="py-1 text-left font-medium">You \ them</th>
              {theirPairs.map((pair, j) => (
                <th key={j} className="px-1 py-1 text-right font-medium">
                  {label(pair)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {myPairs.map((pair, i) => (
              <tr key={i} className="border-t border-zinc-200 dark:border-zinc-800">
                <td className="py-1 pr-2 text-zinc-900 dark:text-zinc-100">{label(pair)}</td>
                {theirPairs.map((_, j) => {
                  const p = model.winProb[i][j];
                  return (
                    <td
                      key={j}
                      className={`px-1 py-1 text-right tabular-nums ${
                        p >= 0.55
                          ? "font-medium text-emerald-700 dark:text-emerald-400"
                          : p <= 0.45
                            ? "text-rose-600 dark:text-rose-400"
                            : "text-zinc-600 dark:text-zinc-400"
                      }`}
                    >
                      {(p * 100).toFixed(0)}%
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <p className="text-[11px] leading-relaxed text-zinc-400 dark:text-zinc-600">
        Four-ball scores here take the better of two round totals, while the real format takes the
        better ball on every hole — so these understate how much a partner helps. They rank pairings
        against each other, which is the decision being made. Halved matches aren&apos;t modelled.
      </p>
    </div>
  );
}
