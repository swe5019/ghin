"use client";

import { useEffect, useMemo, useState } from "react";
import { isBestBall, type CourseRound } from "@/lib/course-math";
import { createFreeSolver, type FreeState, type PairingPlayer, type Side } from "@/lib/pairings";
import type { RosterPlayer, RosterResponse } from "@/types/draft";

type NamePair = [string, string];

/** One recorded action in the live pairings draft. */
interface DraftEvent {
  type: "throw" | "counter";
  side: Side;
  pair: NamePair;
}

// Bumped when the solver moved from fixed lineups to free pairing.
const STORAGE_KEY = "ghin-pairings-v2";
const first = (name: string) => name.split(" ")[0];
const label = (pair: NamePair) => `${first(pair[0])} + ${first(pair[1])}`;
const keyOf = (pair: NamePair) => [...pair].sort().join("|");

export function PairingsView({ initialRoster }: { initialRoster: RosterResponse }) {
  const [roster, setRoster] = useState(initialRoster);
  const [courseIdx, setCourseIdx] = useState(0);
  const [firstThrow, setFirstThrow] = useState<Side>("them");
  const [events, setEvents] = useState<DraftEvent[]>([]);
  const [picking, setPicking] = useState<string[]>([]);
  const [optionFilter, setOptionFilter] = useState("");

  // GitHub Pages caches the HTML, so re-read the data on mount rather than trusting
  // whatever was baked into this bundle.
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
      const saved = JSON.parse(raw) as { events?: DraftEvent[]; firstThrow?: Side };
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (saved.events) setEvents(saved.events);
      if (saved.firstThrow) setFirstThrow(saved.firstThrow);
    } catch {
      /* a corrupt saved draft just starts fresh */
    }
  }, []);

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ events, firstThrow }));
  }, [events, firstThrow]);

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

  const solver = useMemo(
    () =>
      course && myTeam.length === 8 && theirTeam.length === 8
        ? createFreeSolver(myTeam.map(toPairing), theirTeam.map(toPairing), course)
        : null,
     
    [course, myTeam, theirTeam],
  );

  /** Replay the recorded exchange into a solver state. */
  const live = useMemo(() => {
    if (!solver) return null;
    let myAvailable = [...myNames];
    let theirAvailable = [...theirNames];
    let pending: FreeState["pending"] = null;
    let toThrow: Side = firstThrow;
    const matches: { mine: NamePair; theirs: NamePair; win: number }[] = [];

    for (const event of events) {
      const pool = event.side === "me" ? myAvailable : theirAvailable;
      if (!event.pair.every((n) => pool.includes(n))) continue;
      const rest = pool.filter((n) => !event.pair.includes(n));
      if (event.side === "me") myAvailable = rest;
      else theirAvailable = rest;

      if (event.type === "throw") {
        pending = { pair: event.pair, by: event.side };
      } else if (pending) {
        const mine = event.side === "me" ? event.pair : pending.pair;
        const theirs = event.side === "me" ? pending.pair : event.pair;
        matches.push({ mine, theirs, win: solver.win(mine, theirs) });
        pending = null;
        // Whoever answers immediately throws next.
        toThrow = event.side;
      }
    }

    const state: FreeState = { myAvailable, theirAvailable, pending, toThrow };
    const done = myAvailable.length === 0 && theirAvailable.length === 0 && !pending;
    return {
      state,
      done,
      matches,
      settled: matches.reduce((sum, m) => sum + m.win, 0),
      actor: done ? null : solver.actor(state),
      remaining: done ? 0 : solver.value(state),
      options: done ? [] : solver.options(state),
    };
  }, [solver, myNames, theirNames, events, firstThrow]);

  /** What the solver expects to happen from here if both captains keep playing well. */
  const projection = useMemo(() => {
    if (!solver || !live || live.done) return [];
    const out: { mine: NamePair; theirs: NamePair; win: number }[] = [];
    let state = live.state;
    for (let step = 0; step < 8; step++) {
      const options = solver.options(state);
      if (options.length === 0) break;
      const play = options[0].pair;
      const actor = solver.actor(state);
      const pool = actor === "me" ? state.myAvailable : state.theirAvailable;
      const rest = pool.filter((n) => !play.includes(n));
      const myAvailable = actor === "me" ? rest : state.myAvailable;
      const theirAvailable = actor === "them" ? rest : state.theirAvailable;

      if (state.pending) {
        const mine = actor === "me" ? play : state.pending.pair;
        const theirs = actor === "me" ? state.pending.pair : play;
        out.push({ mine, theirs, win: solver.win(mine, theirs) });
        state = { myAvailable, theirAvailable, pending: null, toThrow: actor };
      } else {
        state = { myAvailable, theirAvailable, pending: { pair: play, by: actor }, toThrow: actor };
      }
      if (myAvailable.length === 0 && theirAvailable.length === 0) break;
    }
    return out;
  }, [solver, live]);

  const partnershipFor = (pair: NamePair) => {
    const found = byName.get(pair[0])?.partnerships.find((x) => x.pair.includes(pair[1]));
    return found ? `${found.w}-${found.l}-${found.h}` : null;
  };

  if (!course || !solver || !live) {
    return (
      <div className="mx-auto max-w-4xl p-4">
        <p className="rounded-lg border border-dashed border-zinc-300 p-6 text-center text-sm text-zinc-500 dark:border-zinc-700 dark:text-zinc-400">
          Pairings need both eight-player teams and a best-ball course. Check data/teams.json.
        </p>
      </div>
    );
  }

  const recordEvent = (side: Side, pair: NamePair) =>
    setEvents((prev) => [...prev, { type: live.state.pending ? "counter" : "throw", side, pair }]);

  const commitPick = () => {
    if (picking.length !== 2) return;
    recordEvent("them", [picking[0], picking[1]] as NamePair);
    setPicking([]);
  };

  const query = optionFilter.trim().toLowerCase();
  const visibleOptions = query
    ? live.options.filter((o) => o.pair.some((n) => n.toLowerCase().includes(query)))
    : live.options;

  const projectedTotal = live.settled + live.remaining;

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-4 p-3 sm:p-4">
      <header>
        <h1 className="text-xl font-bold text-zinc-900 dark:text-zinc-100">Pairings</h1>
        <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
          Throw-and-counter assistant. Pairs are built from whoever is still unused, so the opening
          throw picks from all 28 combinations — your lineup comes out of the exchange, not before
          it.
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
            All four matches set — projected {live.settled.toFixed(2)} of 4.
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
                {live.state.pending && (
                  <span className="ml-1.5 font-normal">
                    vs {label(live.state.pending.pair)}
                  </span>
                )}
              </p>
              <p className="text-right text-xs text-emerald-800 dark:text-emerald-300">
                projected {projectedTotal.toFixed(2)} of 4
                {live.matches.length > 0 && (
                  <span className="block opacity-75">
                    {live.settled.toFixed(2)} settled · {live.remaining.toFixed(2)} still to play
                  </span>
                )}
              </p>
            </div>

            {live.actor === "me" ? (
              <>
                <div className="mb-1.5 flex items-center gap-2">
                  <p className="text-xs text-emerald-800 dark:text-emerald-300">
                    {live.options.length} legal {live.options.length === 1 ? "pair" : "pairs"}, best
                    first
                  </p>
                  {live.options.length > 6 && (
                    <input
                      value={optionFilter}
                      onChange={(e) => setOptionFilter(e.target.value)}
                      placeholder="Filter…"
                      className="ml-auto w-24 rounded-md border border-emerald-300 bg-white px-2 py-1 text-xs dark:border-emerald-800 dark:bg-zinc-900"
                    />
                  )}
                </div>
                {/* Two bare numbers side by side read as one measure in two units. They
                    aren't: one is the whole day, the other is this match alone. */}
                <div className="mb-1 flex items-baseline gap-2 pr-3 pl-3 text-[10px] uppercase tracking-wide text-emerald-700 dark:text-emerald-500">
                  <span className="flex-1">Pair</span>
                  <span className="w-10 text-right">of 4</span>
                  {live.state.pending && <span className="w-10 text-right">this match</span>}
                </div>
                <ul className="flex max-h-80 flex-col gap-1 overflow-y-auto">
                  {visibleOptions.map((opt, rank) => {
                    const record = partnershipFor(opt.pair);
                    const isBest = rank === 0 && !query;
                    return (
                      <li key={keyOf(opt.pair)}>
                        <button
                          onClick={() => {
                            recordEvent("me", opt.pair);
                            setOptionFilter("");
                          }}
                          className={`flex w-full items-center justify-between gap-2 rounded-md border px-3 py-2 text-sm ${
                            isBest
                              ? "border-emerald-500 bg-white font-medium dark:border-emerald-600 dark:bg-zinc-950"
                              : "border-zinc-200 bg-white/60 dark:border-zinc-800 dark:bg-zinc-950/60"
                          }`}
                        >
                          <span className="flex min-w-0 items-center gap-2">
                            {isBest && (
                              <span className="shrink-0 rounded bg-emerald-600 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-white">
                                Best
                              </span>
                            )}
                            <span className="truncate">{label(opt.pair)}</span>
                            {record && (
                              <span className="shrink-0 rounded bg-zinc-100 px-1 py-0.5 text-[10px] text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400">
                                {record}
                              </span>
                            )}
                          </span>
                          <span className="flex shrink-0 items-baseline gap-2 tabular-nums">
                            <span
                              className="w-10 text-right text-zinc-500 dark:text-zinc-400"
                              title="Projected matches won across all four, if both captains keep playing well"
                            >
                              {(live.settled + opt.value).toFixed(2)}
                            </span>
                            {live.state.pending && (
                              <span
                                className="w-10 text-right text-emerald-700 dark:text-emerald-400"
                                title={`Chance this pair beats ${label(live.state.pending.pair)} — this match only`}
                              >
                                {(solver.win(opt.pair, live.state.pending.pair) * 100).toFixed(0)}%
                              </span>
                            )}
                          </span>
                        </button>
                      </li>
                    );
                  })}
                  {visibleOptions.length === 0 && (
                    <li className="px-2 py-3 text-xs text-emerald-800 dark:text-emerald-300">
                      No available pair matches {optionFilter.trim()}.
                    </li>
                  )}
                </ul>
              </>
            ) : (
              <div>
                <p className="mb-2 text-xs text-emerald-800 dark:text-emerald-300">
                  Tap the two golfers they used. Expected:{" "}
                  <span className="font-medium">
                    {live.options[0] ? label(live.options[0].pair) : "—"}
                  </span>
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {live.state.theirAvailable.map((name) => (
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
              setOptionFilter("");
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
                <span className="min-w-0 flex-1 truncate text-zinc-900 dark:text-zinc-100">
                  {label(m.mine)}
                </span>
                <span className="shrink-0 tabular-nums font-medium text-zinc-700 dark:text-zinc-300">
                  {(m.win * 100).toFixed(0)}%
                </span>
                <span className="min-w-0 flex-1 truncate text-right text-zinc-500 dark:text-zinc-400">
                  {label(m.theirs)}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {projection.length > 0 && (
        <section className="rounded-lg border border-zinc-200 bg-white p-3 dark:border-zinc-800 dark:bg-zinc-950">
          <h2 className="font-semibold text-zinc-900 dark:text-zinc-100">If both keep playing well</h2>
          <p className="mb-2 text-xs text-zinc-500 dark:text-zinc-400">
            The rest of the exchange as the solver sees it. Their side of this assumes they play as
            well as they can, so treat it as the hard case rather than a prediction.
          </p>
          <ul className="flex flex-col gap-1 text-sm">
            {projection.map((m, i) => (
              <li key={i} className="flex items-center justify-between gap-2">
                <span className="min-w-0 flex-1 truncate text-zinc-900 dark:text-zinc-100">
                  {label(m.mine)}
                </span>
                <span className="shrink-0 tabular-nums font-medium text-zinc-700 dark:text-zinc-300">
                  {(m.win * 100).toFixed(0)}%
                </span>
                <span className="min-w-0 flex-1 truncate text-right text-zinc-500 dark:text-zinc-400">
                  {label(m.theirs)}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <p className="text-[11px] leading-relaxed text-zinc-400 dark:text-zinc-600">
        &ldquo;Of 4&rdquo; is the projected matches won across the whole exchange, so it already
        prices what a pair costs you later — a pair can win this match more often and still total
        less, because it spends golfers the last two matches then go without. &ldquo;This
        match&rdquo; is that pair&apos;s share of the head-to-head in front of it, from expected
        net scores at this course. Four-ball here takes the better of two round totals, while the real format takes
        the better ball on every hole — so these understate how much a partner helps. Halved
        matches aren&apos;t modelled. See the All pairings tab for every combination side by side.
      </p>
    </div>
  );
}
