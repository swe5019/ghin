import { formatCourseHandicap, formatHandicapIndex } from "@/lib/format";
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
  const nine = round.holes === 9;
  return (
    <span
      className={
        better
          ? "font-medium text-emerald-700 dark:text-emerald-400"
          : "font-medium text-zinc-600 dark:text-zinc-400"
      }
      title={
        nine
          ? `9-hole differential ${round.rawDifferential.toFixed(1)}, doubled to ${round.differential.toFixed(1)} ` +
            `so it's comparable to 18-hole rounds. ${better ? "Better" : "Worse"} than their index.`
          : better
            ? "Better than their Handicap Index"
            : "Worse than their Handicap Index"
      }
    >
      {round.differential.toFixed(1)}
      {nine && <span className="ml-0.5 text-[10px] font-normal opacity-60">×2</span>}
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
      {/* Course is the widest column and the least load-bearing — dropping it on a phone
          keeps the rest on screen without a sideways scroll. A 9-hole round is still
          marked by the ×2 on its differential. */}
      <table className="w-full text-left text-sm sm:min-w-[26rem]">
        <thead>
          <tr className="text-xs uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
            <th className="px-2 py-2 font-medium sm:px-3">When</th>
            <th className="hidden px-3 py-2 font-medium sm:table-cell">Course</th>
            <th className="px-2 py-2 text-right font-medium sm:px-3">Score</th>
            <th className="px-2 py-2 text-right font-medium sm:px-3">Rating/Slope</th>
            <th className="px-2 py-2 text-right font-medium sm:px-3">Diff</th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((round, i) => (
            <tr key={i} className="border-t border-zinc-200 dark:border-zinc-800">
              <td className="whitespace-nowrap px-2 py-2 text-zinc-600 sm:px-3 dark:text-zinc-400">
                {formatRoundDate(round.date)}
              </td>
              <td className="hidden px-3 py-2 text-zinc-600 sm:table-cell dark:text-zinc-400">
                {round.courseName ?? "—"}
                {round.tees ? ` (${round.tees})` : ""}
                {round.holes === 9 && (
                  <span className="ml-1.5 rounded bg-zinc-200 px-1 py-0.5 text-[10px] font-medium text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400">
                    9 holes
                  </span>
                )}
              </td>
              <td className="px-2 py-2 text-right tabular-nums text-zinc-900 sm:px-3 dark:text-zinc-100">
                {round.grossScore ?? "—"}
              </td>
              <td className="px-2 py-2 text-right tabular-nums text-zinc-500 sm:px-3 dark:text-zinc-400">
                {round.courseRating !== null && round.slopeRating !== null
                  ? `${round.courseRating.toFixed(1)}/${round.slopeRating}`
                  : "—"}
              </td>
              <td className="px-2 py-2 text-right tabular-nums sm:px-3">
                <DiffCell round={round} index={player.handicapIndex} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="px-3 py-2 text-xs text-zinc-500 dark:text-zinc-400">
        {/* Explicit {" "} around expressions — the JSX transform trims the literal spaces here. */}
        Handicap Index {formatHandicapIndex(player.handicapIndex)} · plays to about{" "}
        {formatCourseHandicap(player.eventCourseHandicap)}{" "}
        on these courses. Differential adjusts each score for course difficulty, so it&apos;s
        comparable across courses.
      </p>
    </div>
  );
}
