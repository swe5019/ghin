"use client";

import { useEffect, useMemo, useState } from "react";
import { PlayerCard } from "./PlayerCard";
import { TeamColumn } from "./TeamColumn";
import type { DraftState, RosterPlayer, RosterResponse, TeamId } from "@/types/draft";

const STORAGE_KEY = "ghin-draft-state-v1";
const EMPTY_DRAFT: DraftState = { assignments: {}, pickHistory: [] };

function loadDraftState(): DraftState {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as DraftState) : EMPTY_DRAFT;
  } catch {
    return EMPTY_DRAFT;
  }
}

type SortMode = "draftRank" | "bestBall" | "trend" | "name";

const TREND_ORDER: Record<string, number> = { hot: 0, steady: 1, cold: 2, insufficient_data: 3 };

export function DraftBoard({ initialRoster }: { initialRoster: RosterResponse }) {
  const [roster, setRoster] = useState<RosterPlayer[]>(initialRoster.players);
  const [fetchedAt, setFetchedAt] = useState<string | null>(initialRoster.fetchedAt);
  const [loadError, setLoadError] = useState<string | null>(initialRoster.error ?? null);
  const [refreshing, setRefreshing] = useState(false);
  // Draft picks are undefined until mount (SSR has no localStorage); this component only
  // renders picks once hydrated, so there's no server/client markup mismatch.
  const [draft, setDraft] = useState<DraftState | null>(null);

  useEffect(() => {
    // Sync in-memory state from localStorage — an external system, not derivable from props.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setDraft(loadDraftState());
  }, []);

  useEffect(() => {
    if (draft) {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(draft));
    }
  }, [draft]);

  async function refresh() {
    setRefreshing(true);
    try {
      const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
      const res = await fetch(`${basePath}/roster.json?t=${Date.now()}`);
      const body = (await res.json()) as RosterResponse;
      setLoadError(body.error ?? null);
      setRoster(body.players ?? []);
      setFetchedAt(body.fetchedAt ?? null);
    } catch (err) {
      setLoadError(`Failed to reach the server: ${(err as Error).message}`);
    } finally {
      setRefreshing(false);
    }
  }

  const assignments = draft?.assignments ?? {};
  const pickHistory = draft?.pickHistory ?? [];

  function assign(name: string, team: TeamId) {
    setDraft((prev) => {
      const base = prev ?? EMPTY_DRAFT;
      return {
        assignments: { ...base.assignments, [name]: team },
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
      return { assignments: nextAssignments, pickHistory: history };
    });
  }

  function resetDraft() {
    setDraft(EMPTY_DRAFT);
  }

  const [sortMode, setSortMode] = useState<SortMode>("bestBall");
  const [filterText, setFilterText] = useState("");

  const teamOf = (name: string): TeamId => assignments[name] ?? "pool";

  const pool = useMemo(() => {
    let players = roster.filter((p) => teamOf(p.name) === "pool");

    if (filterText.trim()) {
      const q = filterText.trim().toLowerCase();
      players = players.filter((p) => p.name.toLowerCase().includes(q));
    }

    players = [...players].sort((a, b) => {
      if (sortMode === "name") return a.name.localeCompare(b.name);
      if (sortMode === "draftRank") return a.draftRank - b.draftRank;
      if (sortMode === "bestBall") {
        if (a.bestBallRank === null) return 1;
        if (b.bestBallRank === null) return -1;
        return a.bestBallRank - b.bestBallRank;
      }
      const at = TREND_ORDER[a.trend?.status ?? "insufficient_data"];
      const bt = TREND_ORDER[b.trend?.status ?? "insufficient_data"];
      return at - bt;
    });

    return players;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roster, assignments, filterText, sortMode]);

  const myTeam = roster.filter((p) => teamOf(p.name) === "myTeam");
  const opponentTeam = roster.filter((p) => teamOf(p.name) === "opponentTeam");

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-4 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-zinc-200 pb-3 dark:border-zinc-800">
        <div>
          <h1 className="text-xl font-bold text-zinc-900 dark:text-zinc-100">GHIN Draft Assistant</h1>
          {fetchedAt && (
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              Data as of {new Date(fetchedAt).toLocaleTimeString()}
            </p>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={undo}
            disabled={pickHistory.length === 0}
            className="rounded border border-zinc-300 px-3 py-1.5 text-sm font-medium text-zinc-700 hover:bg-zinc-50 disabled:opacity-40 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-900"
          >
            Undo last pick
          </button>
          <button
            onClick={resetDraft}
            className="rounded border border-zinc-300 px-3 py-1.5 text-sm font-medium text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-900"
          >
            Reset draft
          </button>
          <button
            onClick={refresh}
            disabled={refreshing}
            className="rounded bg-zinc-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-zinc-700 disabled:opacity-40 dark:bg-zinc-100 dark:text-zinc-900"
          >
            {refreshing ? "Refreshing…" : "Refresh data"}
          </button>
        </div>
      </div>

      {loadError && (
        <div className="rounded border border-rose-300 bg-rose-50 px-3 py-2 text-sm text-rose-800 dark:border-rose-900 dark:bg-rose-950 dark:text-rose-300">
          {loadError}
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
        <div>
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <h2 className="font-semibold text-zinc-900 dark:text-zinc-100">Player Pool</h2>
            <input
              value={filterText}
              onChange={(e) => setFilterText(e.target.value)}
              placeholder="Filter by name…"
              className="ml-auto rounded border border-zinc-300 px-2 py-1 text-sm dark:border-zinc-700 dark:bg-zinc-900"
            />
            <select
              value={sortMode}
              onChange={(e) => setSortMode(e.target.value as SortMode)}
              className="rounded border border-zinc-300 px-2 py-1 text-sm dark:border-zinc-700 dark:bg-zinc-900"
            >
              <option value="bestBall">Sort: Best-Ball Value</option>
              <option value="draftRank">Sort: Draft Rank</option>
              <option value="trend">Sort: Trend</option>
              <option value="name">Sort: Name</option>
            </select>
          </div>
          <div className="flex flex-col gap-2">
            {pool.length === 0 && <p className="text-sm text-zinc-400">No undrafted players match.</p>}
            {pool.map((p) => (
              <PlayerCard key={p.name} player={p} onAssign={(team) => assign(p.name, team)} />
            ))}
          </div>
        </div>

        <TeamColumn title="My Team" players={myTeam} />
        <TeamColumn title="Opponent Team" players={opponentTeam} />
      </div>
    </div>
  );
}
