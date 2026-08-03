import { Sparkline } from "./Sparkline";
import { TrendBadge } from "./TrendBadge";
import type { RosterPlayer, TeamId } from "@/types/draft";

export function PlayerCard({
  player,
  onAssign,
  compact,
}: {
  player: RosterPlayer;
  onAssign?: (team: TeamId) => void;
  compact?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border border-zinc-200 bg-white p-3 dark:border-zinc-800 dark:bg-zinc-950">
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-2">
          <span className="shrink-0 text-xs font-semibold tabular-nums text-zinc-400 dark:text-zinc-600">
            #{player.overallRank}
          </span>
          <span className="truncate font-medium text-zinc-900 dark:text-zinc-100">{player.name}</span>
          <span
            className="shrink-0 text-sm text-zinc-500 dark:text-zinc-400"
            title={`Handicap Index ${player.handicapIndex.toFixed(1)} · plays to ~${player.eventCourseHandicap.toFixed(0)} on these courses`}
          >
            {player.handicapIndex.toFixed(1)}
          </span>
        </div>

        {player.error ? (
          <p className="mt-1 text-xs text-amber-600 dark:text-amber-400">{player.error}</p>
        ) : (
          <>
            <div className="mt-1 flex items-center gap-2">
              <TrendBadge trend={player.trend} />
              {!compact && (
                <Sparkline data={player.trend?.sparklineData ?? []} referenceValue={player.handicapIndex} />
              )}
            </div>
            {!compact && (
              <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-zinc-500 dark:text-zinc-400">
                <span title="Rank as a best-ball partner — weights upside, since you count the better ball">
                  BB #{player.bestBallRank}
                </span>
                <span title="Rank for the Saturday singles match — weights expected score">
                  · Singles #{player.singlesRank}
                </span>
                <span
                  title={`Expected net score after strokes: ${player.expectedNetBestBall.toFixed(2)} · a good round: ${player.upsideBestBall.toFixed(2)} (lower is better)`}
                >
                  · net {player.expectedNetBestBall.toFixed(1)} / up {player.upsideBestBall.toFixed(1)}
                </span>
                {player.insufficientData ? (
                  <span className="text-amber-600 dark:text-amber-500" title="No rounds logged — ranked on the field average">
                    · no rounds
                  </span>
                ) : (
                  <span title={`${player.roundsLogged} rounds logged in 2026`}>· {player.roundsLogged}r</span>
                )}
              </div>
            )}
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
