"use client";

import { useEffect, useMemo, useState } from "react";
import { DraftStatusBar } from "./DraftStatusBar";
import { PlayerRow } from "./PlayerRow";
import { TeamPanel } from "./TeamPanel";
import type { CaptainId } from "@/lib/draft";
import type { DraftState, RosterPlayer, RosterResponse, TeamId } from "@/types/draft";

// Bumped when the captain slots changed meaning, so a stale saved draft can't mislabel teams.
const STORAGE_KEY = "ghin-draft-state-v3";
const EMPTY_DRAFT: DraftState = { assignments: {}, pickHistory: [] };

function loadDraftState(): DraftState {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return EMPTY_DRAFT;
    return { ...EMPTY_DRAFT, ...(JSON.parse(raw) as DraftState) };
  } catch {
    return EMPTY_DRAFT;
  }
}

type SortMode = "overall" | "bestBall" | "singles" | "trend" | "index" | "name";

/** Which players the ranked list shows. */
type ListView = "pool" | "mine" | "theirs" | "all";

const SORT_LABELS: Record<SortMode, string> = {
  overall: "Overall",
  bestBall: "Best ball",
  singles: "Singles",
  trend: "Trend",
  index: "Handicap",
  name: "Name",
};

const TREND_ORDER: Record<string, number> = { hot: 0, steady: 1, cold: 2, insufficient_data: 3 };

const VIEW_LABELS: Record<ListView, string> = {
  pool: "Available",
  mine: "My team",
  theirs: "Their team",
  all: "Everyone",
};

export function DraftBoard({ initialRoster }: { initialRoster: RosterResponse }) {
  const [roster, setRoster] = useState<RosterPlayer[]>(initialRoster.players);
  const [fetchedAt, setFetchedAt] = useState<string | null>(initialRoster.fetchedAt);
  const [fieldGap, setFieldGap] = useState<number | undefined>(initialRoster.fieldGap);
  const [draftConfig, setDraftConfig] = useState(initialRoster.draft);
  const [loadError, setLoadError] = useState<string | null>(initialRoster.error ?? null);
  const [refreshing, setRefreshing] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [sortMode, setSortMode] = useState<SortMode>("overall");
  const [filterText, setFilterText] = useState("");
  // Which slice of the field the ranked list shows. Null means "follow the draft" — the
  // pool while picks remain, everyone once they're all gone.
  const [viewOverride, setViewOverride] = useState<ListView | null>(null);

  // Draft picks are undefined until mount (SSR has no localStorage); picks only render
  // once hydrated, so there's no server/client markup mismatch.
  const [draft, setDraft] = useState<DraftState | null>(null);

  useEffect(() => {
    // Sync in-memory state from localStorage — an external system, not derivable from props.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setDraft(loadDraftState());
  }, []);

  useEffect(() => {
    if (draft) window.localStorage.setItem(STORAGE_KEY, JSON.stringify(draft));
  }, [draft]);

  async function loadRoster({ manual }: { manual: boolean }) {
    if (manual) setRefreshing(true);
    try {
      const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
      const res = await fetch(`${basePath}/roster.json?t=${Date.now()}`, { cache: "no-store" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const body = (await res.json()) as RosterResponse;
      setLoadError(body.error ?? null);
      setRoster(body.players ?? []);
      setFetchedAt(body.fetchedAt ?? null);
      setFieldGap(body.fieldGap);
      setDraftConfig(body.draft);
    } catch (err) {
      // On a background load, keep the build-time data rather than blanking the board;
      // only a manual refresh surfaces the failure.
      if (manual) setLoadError(`Couldn't reload the roster: ${(err as Error).message}`);
    } finally {
      if (manual) setRefreshing(false);
    }
  }

  // Page data is baked in at build time, and GitHub Pages caches the HTML — so a stale
  // bundle would otherwise show stale rankings. Re-fetching roster.json on mount makes
  // data freshness independent of how long the HTML is cached for.
  useEffect(() => {
    // Syncing from the network is what effects are for, and the setState calls happen in
    // the async continuation rather than synchronously in this body.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadRoster({ manual: false });
  }, []);

  const assignments = draft?.assignments ?? {};
  const pickHistory = draft?.pickHistory ?? [];
  // Config says which captain this board belongs to; the selector only overrides it.
  const myCaptain: CaptainId = draft?.myCaptain ?? draftConfig?.me ?? "A";
  const pickOrder = draftConfig?.pickOrder ?? [];
  const captains = draftConfig?.captains ?? { A: "Captain A", B: "Captain B" };
  const onTheClock: CaptainId | null = pickHistory.length < pickOrder.length ? pickOrder[pickHistory.length] : null;

  function draftPlayer(name: string, captain: CaptainId) {
    setDraft((prev) => {
      const base = prev ?? EMPTY_DRAFT;
      return {
        ...base,
        assignments: { ...base.assignments, [name]: captain },
        pickHistory: [...base.pickHistory, name],
      };
    });
  }

  function undo() {
    setDraft((prev) => {
      if (!prev || prev.pickHistory.length === 0) return prev;
      const history = [...prev.pickHistory];
      const last = history.pop() as string;
      const nextAssignments = { ...prev.assignments };
      delete nextAssignments[last];
      return { ...prev, assignments: nextAssignments, pickHistory: history };
    });
  }

  function resetDraft() {
    setDraft((prev) => ({ ...EMPTY_DRAFT, myCaptain: prev?.myCaptain }));
  }

  // Surfaced in the footer as a quick "is this the data I expect?" check.
  const roundsTotal = roster.reduce((sum, p) => sum + p.roundsLogged, 0);

  // Captains play but aren't drafted — they belong to their own team from the start and
  // never appear in the available pool.
  const captainOf = (name: string): TeamId | null => {
    if (name === captains.A) return "A";
    if (name === captains.B) return "B";
    return null;
  };

  const teamOf = (name: string): TeamId => captainOf(name) ?? assignments[name] ?? "pool";

  // Once every pick is in, an "available only" list is empty and the page looks frozen —
  // the ranks, form and round histories all live in these rows. So the list falls back to
  // the whole field when the draft is done, and can be switched by hand at any point.
  const draftComplete = pickHistory.length >= pickOrder.length && pickOrder.length > 0;
  const view: ListView = viewOverride ?? (draftComplete ? "all" : "pool");

  const listed = useMemo(() => {
    const matches = (name: string) => {
      const team = teamOf(name);
      if (view === "all") return true;
      if (view === "pool") return team === "pool";
      return team === (view === "mine" ? myCaptain : myCaptain === "A" ? "B" : "A");
    };
    let players = roster.filter((p) => matches(p.name));

    if (filterText.trim()) {
      const q = filterText.trim().toLowerCase();
      players = players.filter((p) => p.name.toLowerCase().includes(q));
    }

    return [...players].sort((a, b) => {
      switch (sortMode) {
        case "name":
          return a.name.localeCompare(b.name);
        case "index":
          return a.handicapIndex - b.handicapIndex;
        case "bestBall":
          return a.bestBallRank - b.bestBallRank;
        case "singles":
          return a.singlesRank - b.singlesRank;
        case "trend": {
          const at = TREND_ORDER[a.trend?.status ?? "insufficient_data"];
          const bt = TREND_ORDER[b.trend?.status ?? "insufficient_data"];
          return at !== bt ? at - bt : a.overallRank - b.overallRank;
        }
        default:
          return a.overallRank - b.overallRank;
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roster, assignments, filterText, sortMode, view, myCaptain, captains]);

  // The captain heads their own list, then their picks in the order they made them. A captain
  // missing from the roster (name typo in draft.json) just yields a captainless list.
  const teamFor = (captain: CaptainId) => {
    const captainPlayer = roster.find((p) => p.name === captains[captain]);
    const picks = pickHistory
      .filter((name) => assignments[name] === captain)
      .map((name) => roster.find((p) => p.name === name)!)
      .filter(Boolean);
    return {
      players: captainPlayer ? [captainPlayer, ...picks] : picks,
      hasCaptain: Boolean(captainPlayer),
    };
  };

  const teamA = teamFor("A");
  const teamB = teamFor("B");

  const picksLeftFor = (captain: CaptainId) =>
    pickOrder.slice(pickHistory.length).filter((c) => c === captain).length;

  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-3 p-3 sm:gap-4 sm:p-4">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <h1 className="text-xl font-bold text-zinc-900 dark:text-zinc-100">BCIV Draft Board</h1>
          {/* Explanatory copy costs a lot of vertical space on a phone; keep it for wider screens. */}
          <p className="mt-0.5 hidden text-xs text-zinc-500 sm:block dark:text-zinc-400">
            Ranked by expected score after strokes — best ball weights upside, singles weights consistency.
            {fieldGap !== undefined && ` Trend compares to the field's typical ${fieldGap.toFixed(1)} over index.`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={undo}
            disabled={pickHistory.length === 0}
            className="rounded-md border border-zinc-300 px-3 py-1.5 text-sm font-medium text-zinc-700 hover:bg-zinc-50 disabled:opacity-40 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-900"
          >
            Undo
          </button>
          <button
            onClick={resetDraft}
            className="rounded-md border border-zinc-300 px-3 py-1.5 text-sm font-medium text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-900"
          >
            Reset
          </button>
          <button
            onClick={() => void loadRoster({ manual: true })}
            disabled={refreshing}
            className="rounded-md bg-zinc-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-zinc-700 disabled:opacity-40 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
          >
            {refreshing ? "Refreshing…" : "Refresh"}
          </button>
        </div>
      </header>

      {loadError && (
        <div className="rounded-md border border-rose-300 bg-rose-50 px-3 py-2 text-sm text-rose-800 dark:border-rose-900 dark:bg-rose-950 dark:text-rose-300">
          {loadError}
        </div>
      )}

      {draft && pickOrder.length > 0 && (
        <DraftStatusBar
          pickOrder={pickOrder}
          captains={captains}
          pickIndex={pickHistory.length}
          myCaptain={myCaptain}
          onChangeCaptain={(c) => setDraft((prev) => ({ ...(prev ?? EMPTY_DRAFT), myCaptain: c }))}
        />
      )}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <div>
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <h2 className="font-semibold text-zinc-900 dark:text-zinc-100">
              {VIEW_LABELS[view]}{" "}
              <span className="text-sm font-normal text-zinc-500 dark:text-zinc-400">
                ({listed.length})
              </span>
            </h2>
            <input
              value={filterText}
              onChange={(e) => setFilterText(e.target.value)}
              placeholder="Search…"
              className="ml-auto w-24 rounded-md border border-zinc-300 px-2 py-1 text-sm sm:w-32 dark:border-zinc-700 dark:bg-zinc-900"
            />
            <select
              value={sortMode}
              onChange={(e) => setSortMode(e.target.value as SortMode)}
              className="rounded-md border border-zinc-300 px-2 py-1 text-sm dark:border-zinc-700 dark:bg-zinc-900"
            >
              {(Object.keys(SORT_LABELS) as SortMode[]).map((m) => (
                <option key={m} value={m}>
                  Sort: {SORT_LABELS[m]}
                </option>
              ))}
            </select>
          </div>

          <div className="mb-2 flex flex-wrap gap-1">
            {(Object.keys(VIEW_LABELS) as ListView[]).map((v) => (
              <button
                key={v}
                onClick={() => setViewOverride(v)}
                className={`rounded-md px-2.5 py-1 text-xs ${
                  v === view
                    ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
                    : "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300"
                }`}
              >
                {VIEW_LABELS[v]}
              </button>
            ))}
          </div>

          <div className="flex flex-col gap-2">
            {listed.length === 0 && (
              <p className="rounded-lg border border-dashed border-zinc-300 py-8 text-center text-sm text-zinc-400 dark:border-zinc-700 dark:text-zinc-600">
                {roster.length === 0
                  ? "No roster data loaded."
                  : view === "pool"
                    ? "Everyone's been drafted — switch to Everyone to keep reading the field."
                    : "Nobody here yet."}
              </p>
            )}
            {listed.map((p) => (
              <PlayerRow
                key={p.name}
                player={p}
                expanded={expanded === p.name}
                onToggle={() => setExpanded(expanded === p.name ? null : p.name)}
                // Only undrafted players can be picked; the rest are shown for reference.
                onDraft={teamOf(p.name) === "pool" ? (captain) => draftPlayer(p.name, captain) : undefined}
                captains={captains}
                onTheClock={onTheClock}
                team={teamOf(p.name) === "pool" ? null : captains[teamOf(p.name) as CaptainId]}
              />
            ))}
          </div>
        </div>

        <div className="flex flex-col gap-4">
          <TeamPanel
            title={captains.A}
            players={teamA.players}
            hasCaptain={teamA.hasCaptain}
            isMine={myCaptain === "A"}
            picksRemaining={picksLeftFor("A")}
          />
          <TeamPanel
            title={captains.B}
            players={teamB.players}
            hasCaptain={teamB.hasCaptain}
            isMine={myCaptain === "B"}
            picksRemaining={picksLeftFor("B")}
          />
          {fetchedAt && (
            <p className="text-center text-xs text-zinc-400 dark:text-zinc-600">
              Roster data built {new Date(fetchedAt).toLocaleString()}
              <br />
              <span className="opacity-75">
                {roundsTotal} rounds across {roster.length} golfers
              </span>
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
