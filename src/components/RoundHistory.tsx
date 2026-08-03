import type { PlayerRound, RosterPlayer } from "@/types/draft";

/**
 * Every date in the source sheet is the 1st of a month, so it carries month-level
 * precision at best — showing "Jul 2026" rather than "Jul 1, 2026" avoids implying more.
 */
function formatRoundDate(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, { month: "short", year: "numeric", timeZone: "UTC" });
}

function DiffCell({ round, index }: { round: PlayerRound; index: number }) {
  const better = round.differential < index;
  return (
    <span
      className={
        better
          ? "font-medium text-emerald-700 dark:text-emerald-400"
          : "font-medium text-zinc-600 dark:text-zinc-400"
      }
      title={better ? "Better than their Handicap Index" : "Worse than their Handicap Index"}
    >
      {round.differential.toFixed(1)}
    </span>
  );
}

export function RoundHistory({ player }: { player: RosterPlayer }) {
  if (player.rounds.length === 0) {
    return (
      <div className="rounded-md bg-zinc-50 px-3 py-4 text-sm text-zinc-500 dark:bg-zinc-900 dark:text-zinc-400">
        No rounds logged yet. Their ranking falls back to the field average, so treat it as a guess
        based on handicap alone — add rounds to the Round Log sheet to sharpen it.
      </div>
    );
  }

  const sorted = [...player.rounds].sort((a, b) => (b.date ?? "").localeCompare(a.date ?? ""));

  return (
    <div className="overflow-x-auto rounded-md bg-zinc-50 dark:bg-zinc-900">
      <table className="w-full min-w-[26rem] text-left text-sm">
        <thead>
          <tr className="text-xs uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
            <th className="px-3 py-2 font-medium">When</th>
            <th className="px-3 py-2 font-medium">Course</th>
            <th className="px-3 py-2 text-right font-medium">Score</th>
            <th className="px-3 py-2 text-right font-medium">Rating/Slope</th>
            <th className="px-3 py-2 text-right font-medium">Diff</th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((round, i) => (
            <tr key={i} className="border-t border-zinc-200 dark:border-zinc-800">
              <td className="whitespace-nowrap px-3 py-2 text-zinc-600 dark:text-zinc-400">
                {formatRoundDate(round.date)}
              </td>
              <td className="px-3 py-2 text-zinc-600 dark:text-zinc-400">
                {round.courseName ?? "—"}
                {round.tees ? ` (${round.tees})` : ""}
              </td>
              <td className="px-3 py-2 text-right tabular-nums text-zinc-900 dark:text-zinc-100">
                {round.grossScore ?? "—"}
              </td>
              <td className="px-3 py-2 text-right tabular-nums text-zinc-500 dark:text-zinc-400">
                {round.courseRating !== null && round.slopeRating !== null
                  ? `${round.courseRating.toFixed(1)}/${round.slopeRating}`
                  : "—"}
              </td>
              <td className="px-3 py-2 text-right tabular-nums">
                <DiffCell round={round} index={player.handicapIndex} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="px-3 py-2 text-xs text-zinc-500 dark:text-zinc-400">
        Handicap Index {player.handicapIndex.toFixed(1)} · plays to about{" "}
        {player.eventCourseHandicap.toFixed(0)} on these courses. Differential adjusts each score
        for course difficulty, so it&apos;s comparable across courses.
      </p>
    </div>
  );
}
