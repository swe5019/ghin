import { PlayerCard } from "./PlayerCard";
import type { RosterPlayer } from "@/types/draft";

export function TeamColumn({ title, players }: { title: string; players: RosterPlayer[] }) {
  const avg = players.length > 0 ? players.reduce((sum, p) => sum + p.handicapIndex, 0) / players.length : null;

  return (
    <div className="flex-1">
      <div className="mb-2 flex items-baseline justify-between">
        <h2 className="font-semibold text-zinc-900 dark:text-zinc-100">{title}</h2>
        <span className="text-xs text-zinc-500 dark:text-zinc-400">
          {players.length} player{players.length === 1 ? "" : "s"}
          {avg !== null && ` · avg ${avg.toFixed(1)}`}
        </span>
      </div>
      <div className="flex flex-col gap-2">
        {players.length === 0 && (
          <p className="text-sm text-zinc-400 dark:text-zinc-600">No players yet</p>
        )}
        {players.map((p) => (
          <PlayerCard key={p.name} player={p} />
        ))}
      </div>
    </div>
  );
}
