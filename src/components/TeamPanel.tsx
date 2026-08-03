import { TrendBadge } from "./TrendBadge";
import type { RosterPlayer } from "@/types/draft";

export function TeamPanel({
  title,
  players,
  isMine,
  picksRemaining,
}: {
  title: string;
  players: RosterPlayer[];
  isMine: boolean;
  picksRemaining: number;
}) {
  const avgIndex =
    players.length > 0 ? players.reduce((sum, p) => sum + p.handicapIndex, 0) / players.length : null;
  const avgNet =
    players.length > 0
      ? players.reduce((sum, p) => sum + p.expectedNetBestBall, 0) / players.length
      : null;

  return (
    <section
      className={`rounded-lg border p-3 ${
        isMine
          ? "border-blue-300 bg-blue-50/40 dark:border-blue-900 dark:bg-blue-950/20"
          : "border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950"
      }`}
    >
      <div className="mb-2 flex items-baseline justify-between gap-2">
        <h2 className="font-semibold text-zinc-900 dark:text-zinc-100">
          {title}
          {isMine && <span className="ml-1.5 text-xs font-normal text-blue-700 dark:text-blue-400">you</span>}
        </h2>
        <span className="text-xs text-zinc-500 dark:text-zinc-400">
          {players.length} drafted{picksRemaining > 0 && ` · ${picksRemaining} left`}
        </span>
      </div>

      {avgIndex !== null && avgNet !== null && (
        <div className="mb-3 flex gap-4 border-b border-zinc-200 pb-2 text-xs dark:border-zinc-800">
          <span className="text-zinc-500 dark:text-zinc-400">
            Avg index <span className="font-medium text-zinc-700 dark:text-zinc-300">{avgIndex.toFixed(1)}</span>
          </span>
          <span className="text-zinc-500 dark:text-zinc-400" title="Average expected score after strokes. Lower is better.">
            Avg net <span className="font-medium text-zinc-700 dark:text-zinc-300">{avgNet.toFixed(2)}</span>
          </span>
        </div>
      )}

      {players.length === 0 ? (
        <p className="py-3 text-sm text-zinc-400 dark:text-zinc-600">No picks yet</p>
      ) : (
        <ol className="flex flex-col gap-1.5">
          {players.map((p, i) => (
            <li key={p.name} className="flex items-center gap-2 text-sm">
              <span className="w-4 shrink-0 text-xs tabular-nums text-zinc-400 dark:text-zinc-600">{i + 1}</span>
              <span className="min-w-0 flex-1 truncate text-zinc-900 dark:text-zinc-100">{p.name}</span>
              <TrendBadge trend={p.trend} />
              <span className="w-9 shrink-0 text-right tabular-nums text-zinc-500 dark:text-zinc-400">
                {p.handicapIndex.toFixed(1)}
              </span>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
