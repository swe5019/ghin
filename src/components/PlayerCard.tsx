import { Sparkline } from "./Sparkline";
import { TrendBadge } from "./TrendBadge";
import type { RosterPlayer, TeamId } from "@/types/draft";

export function PlayerCard({
  player,
  onAssign,
}: {
  player: RosterPlayer;
  onAssign?: (team: TeamId) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border border-zinc-200 bg-white p-3 dark:border-zinc-800 dark:bg-zinc-950">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="truncate font-medium text-zinc-900 dark:text-zinc-100">{player.name}</span>
          <span className="shrink-0 text-sm text-zinc-500 dark:text-zinc-400">{player.handicapIndex.toFixed(1)}</span>
        </div>
        {player.error ? (
          <p className="mt-1 text-xs text-amber-600 dark:text-amber-400">{player.error}</p>
        ) : (
          <>
            <div className="mt-1 flex items-center gap-2">
              <TrendBadge trend={player.trend} />
              <Sparkline data={player.trend?.sparklineData ?? []} referenceValue={player.handicapIndex} />
            </div>
            <div className="mt-1 flex items-center gap-2 text-xs text-zinc-500 dark:text-zinc-400">
              <span title="Rank from the spreadsheet's own handicap-weighted formula">Rank #{player.draftRank}</span>
              <span
                title="Best-Ball Value: also weighs consistency and the mid-handicap sweet spot"
                className={player.bestBallRank === null ? "text-zinc-400 dark:text-zinc-600" : undefined}
              >
                · BB #{player.bestBallRank ?? "—"}
              </span>
            </div>
          </>
        )}
      </div>
      {onAssign && (
        <div className="flex shrink-0 flex-col gap-1">
          <button
            onClick={() => onAssign("myTeam")}
            className="rounded bg-blue-600 px-2 py-1 text-xs font-medium text-white hover:bg-blue-700"
          >
            → My Team
          </button>
          <button
            onClick={() => onAssign("opponentTeam")}
            className="rounded bg-zinc-600 px-2 py-1 text-xs font-medium text-white hover:bg-zinc-700"
          >
            → Opponent
          </button>
        </div>
      )}
    </div>
  );
}
