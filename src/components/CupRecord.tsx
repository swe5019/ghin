import type { Record3 } from "@/lib/cup-history";
import type { RosterPlayer } from "@/types/draft";

function fmt(r: Record3): string {
  return `${r[0]}-${r[1]}-${r[2]}`;
}

function pct(v: number | null): string {
  return v === null ? "—" : `${Math.round(v * 100)}%`;
}

/** Compact career line for the collapsed row. */
export function CupSummary({ player }: { player: RosterPlayer }) {
  const c = player.cup;
  if (!c) return null;

  // Points per cup is the fair career comparison — appearances range from 2 to 6.
  const strong = c.pointsPerCup >= 1.7;
  const weak = c.pointsPerCup <= 1.2;

  return (
    <span
      className={
        strong
          ? "font-medium text-emerald-700 dark:text-emerald-400"
          : weak
            ? "text-rose-600 dark:text-rose-400"
            : "text-zinc-500 dark:text-zinc-400"
      }
      title={`Career ${c.record} over ${c.apps} cup${c.apps === 1 ? "" : "s"} · ${c.pts} pts · ${c.pointsPerCup.toFixed(2)} per cup · ${c.cupTitles} cup title${c.cupTitles === 1 ? "" : "s"}`}
    >
      {c.pointsPerCup.toFixed(2)} pts/cup
    </span>
  );
}

/** Full career breakdown for the expanded panel. */
export function CupDetail({ player }: { player: RosterPlayer }) {
  const c = player.cup;
  if (!c) {
    return (
      <p className="text-xs text-zinc-500 dark:text-zinc-400">No Barnard Cup history on record.</p>
    );
  }

  const partners = player.partnerships.slice(0, 5);

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-x-4 gap-y-2 sm:grid-cols-4">
        <Stat label="Career" value={c.record} sub={`${c.apps} cups · ${c.pts} pts`} />
        <Stat
          label="Per cup"
          value={c.pointsPerCup.toFixed(2)}
          sub={`${c.cupTitles} cup title${c.cupTitles === 1 ? "" : "s"}`}
          good={c.pointsPerCup >= 1.7}
          bad={c.pointsPerCup <= 1.2}
        />
        <Stat
          label="Best ball"
          value={fmt(c.fourball)}
          sub={pct(c.fourballWinPct)}
          good={(c.fourballWinPct ?? 0) >= 0.6}
          bad={c.fourballWinPct !== null && c.fourballWinPct <= 0.4}
        />
        <Stat
          label="Singles"
          value={fmt(c.singles)}
          sub={pct(c.singlesWinPct)}
          good={(c.singlesWinPct ?? 0) >= 0.6}
          bad={c.singlesWinPct !== null && c.singlesWinPct <= 0.4}
        />
      </div>

      <p className="text-xs text-zinc-500 dark:text-zinc-400">
        Head-to-head {fmt(c.h2h)} ({pct(c.h2hWinPct)} of all opponents faced)
        {c.handicapDrift !== null && (
          <>
            {" · index "}
            <span
              className={
                c.handicapDrift < -0.5
                  ? "font-medium text-emerald-700 dark:text-emerald-400"
                  : c.handicapDrift > 0.5
                    ? "text-rose-600 dark:text-rose-400"
                    : ""
              }
              title="Change since their last cup. Negative = they've improved since the record above was set, so it understates them."
            >
              {c.handicapDrift > 0 ? "+" : ""}
              {c.handicapDrift.toFixed(1)} since last cup
            </span>
          </>
        )}
      </p>

      {partners.length > 0 && (
        <div>
          <p className="mb-1 text-[10px] uppercase tracking-wide text-zinc-400 dark:text-zinc-500">
            Past partners (2-man rounds)
          </p>
          <div className="flex flex-wrap gap-1.5">
            {partners.map((p) => {
              const other = p.pair.find((n) => n !== player.name) ?? p.pair[0];
              const pts = p.w + 0.5 * p.h;
              const good = pts / p.g >= 0.75;
              const bad = pts / p.g <= 0.25;
              return (
                <span
                  key={other}
                  className={`rounded px-1.5 py-0.5 text-xs ${
                    good
                      ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                      : bad
                        ? "bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300"
                        : "bg-zinc-200 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400"
                  }`}
                  title={`${p.w}-${p.l}-${p.h} together over ${p.g} match${p.g === 1 ? "" : "es"}`}
                >
                  {other.split(" ")[0]} {p.w}-{p.l}-{p.h}
                </span>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function Stat({
  label,
  value,
  sub,
  good,
  bad,
}: {
  label: string;
  value: string;
  sub?: string;
  good?: boolean;
  bad?: boolean;
}) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wide text-zinc-400 dark:text-zinc-500">{label}</div>
      <div
        className={`text-sm font-medium tabular-nums ${
          good
            ? "text-emerald-700 dark:text-emerald-400"
            : bad
              ? "text-rose-600 dark:text-rose-400"
              : "text-zinc-800 dark:text-zinc-200"
        }`}
      >
        {value}
      </div>
      {sub && <div className="text-[10px] text-zinc-400 dark:text-zinc-500">{sub}</div>}
    </div>
  );
}
