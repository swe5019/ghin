import type { TrendResult } from "@/lib/trend";

const STYLES: Record<string, string> = {
  hot: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300",
  cold: "bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300",
  steady: "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300",
  insufficient_data: "bg-zinc-100 text-zinc-400 dark:bg-zinc-900 dark:text-zinc-500",
};

const LABELS: Record<string, string> = {
  hot: "Hot",
  cold: "Cold",
  steady: "Steady",
  insufficient_data: "No rounds",
};

export function TrendBadge({ trend }: { trend: TrendResult | null }) {
  const status = trend?.status ?? "insufficient_data";
  const provisional = trend?.lowConfidence && status !== "insufficient_data";

  const title =
    trend?.delta !== undefined
      ? `Averaging ${trend.avgRecent?.toFixed(1)}, which is ${trend.gap?.toFixed(1)} over their index. ` +
        `The field's typical gap is ${trend.fieldGap?.toFixed(1)}, so they're ${Math.abs(trend.delta).toFixed(1)} ` +
        `${trend.delta > 0 ? "worse" : "better"} than the field norm.` +
        (provisional ? ` Based on only ${trend.roundsUsed} round${trend.roundsUsed === 1 ? "" : "s"} — noisy.` : "")
      : "No rounds logged — ranked on handicap and the field average alone";

  return (
    <span
      className={`inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${STYLES[status]}`}
      title={title}
    >
      {LABELS[status]}
      {provisional && <span className="opacity-60">?</span>}
    </span>
  );
}
