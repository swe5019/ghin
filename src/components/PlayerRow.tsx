"use client";

import { CupDetail, CupSummary } from "./CupRecord";
import { RoundHistory } from "./RoundHistory";
import { Sparkline } from "./Sparkline";
import { TrendBadge } from "./TrendBadge";
import type { CaptainId } from "@/lib/draft";
import { formatCourseHandicap, formatHandicapIndex } from "@/lib/format";
import type { RosterPlayer } from "@/types/draft";

function Stat({ label, value, title }: { label: string; value: string; title?: string }) {
  return (
    <div className="text-center" title={title}>
      <div className="text-[10px] uppercase tracking-wide text-zinc-400 dark:text-zinc-500">{label}</div>
      <div className="text-sm font-medium tabular-nums text-zinc-700 dark:text-zinc-300">{value}</div>
    </div>
  );
}

export function PlayerRow({
  player,
  expanded,
  onToggle,
  onDraft,
  captains,
  onTheClock,
}: {
  player: RosterPlayer;
  expanded: boolean;
  onToggle: () => void;
  onDraft?: (captain: CaptainId) => void;
  captains?: Record<CaptainId, string>;
  onTheClock?: CaptainId | null;
}) {
  return (
    <div className="overflow-hidden rounded-lg border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950">
      <div className="flex items-center gap-3 p-3">
        <button
          onClick={onToggle}
          aria-expanded={expanded}
          className="flex min-w-0 flex-1 items-center gap-3 text-left"
        >
          <span className="w-7 shrink-0 text-center text-sm font-semibold tabular-nums text-zinc-400 dark:text-zinc-500">
            {player.overallRank}
          </span>

          <span className="min-w-0 flex-1">
            <span className="flex items-center gap-2">
              <span className="truncate font-medium text-zinc-900 dark:text-zinc-100">{player.name}</span>
              <TrendBadge trend={player.trend} />
            </span>
            <span className="mt-0.5 block text-xs text-zinc-500 dark:text-zinc-400">
              {formatHandicapIndex(player.handicapIndex)} index · plays to{" "}
              {formatCourseHandicap(player.eventCourseHandicap)}{" "}·{" "}
              {player.roundsLogged === 0
                ? "no rounds logged"
                : `${player.roundsLogged} round${player.roundsLogged === 1 ? "" : "s"}`}
              {player.cup && (
                <>
                  {" · "}
                  <CupSummary player={player} />
                </>
              )}
            </span>
          </span>

          {/* Stats need real room next to the name; below xl they move into the expanded panel. */}
          <span className="hidden shrink-0 items-center gap-4 xl:flex">
            <Sparkline data={player.trend?.sparklineData ?? []} referenceValue={player.handicapIndex} />
            <Stat
              label="Best ball"
              value={`#${player.bestBallRank}`}
              title="Rank as a best-ball partner — weights upside, since you count the better ball"
            />
            <Stat
              label="Singles"
              value={`#${player.singlesRank}`}
              title="Rank for the Saturday singles match — weights expected score"
            />
            <Stat
              label="Net"
              value={player.expectedNetBestBall.toFixed(1)}
              title="Expected score after strokes are applied. Lower is better."
            />
            <Stat
              label="Upside"
              value={player.upsideBestBall.toFixed(1)}
              title="A good (not best-ever) round, net of strokes — what they contribute in best ball. Lower is better."
            />
          </span>

          <span className="shrink-0 text-zinc-400 dark:text-zinc-500" aria-hidden>
            {expanded ? "▾" : "▸"}
          </span>
        </button>

        {onDraft && captains && (
          <div className="flex shrink-0 gap-1">
            {(["A", "B"] as CaptainId[]).map((c) => (
              <button
                key={c}
                onClick={() => onDraft(c)}
                className={`rounded px-2.5 py-1.5 text-xs font-medium transition-colors ${
                  onTheClock === c
                    ? "bg-emerald-600 text-white hover:bg-emerald-700"
                    : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"
                }`}
                title={`Draft to ${captains[c]}`}
              >
                {captains[c]}
              </button>
            ))}
          </div>
        )}
      </div>

      {expanded && (
        <div className="border-t border-zinc-200 p-3 dark:border-zinc-800">
          {/* Stats are hidden in the row above at this width, so repeat them here. */}
          <div className="mb-3 flex gap-4 lg:hidden">
            <Stat label="Best ball" value={`#${player.bestBallRank}`} />
            <Stat label="Singles" value={`#${player.singlesRank}`} />
            <Stat label="Net" value={player.expectedNetBestBall.toFixed(1)} />
            <Stat label="Upside" value={player.upsideBestBall.toFixed(1)} />
          </div>
          <div className="mb-3 rounded-md bg-zinc-50 p-3 dark:bg-zinc-900">
            <p className="mb-2 text-[10px] uppercase tracking-wide text-zinc-400 dark:text-zinc-500">
              Barnard Cup career
            </p>
            <CupDetail player={player} />
          </div>
          <RoundHistory player={player} />
        </div>
      )}
    </div>
  );
}
