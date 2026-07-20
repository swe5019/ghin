import type { TrendResult } from "@/lib/trend";

const STYLES: Record<string, string> = {
  hot: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300",
  cold: "bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300",
  steady: "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300",
  insufficient_data: "bg-zinc-50 text-zinc-400 dark:bg-zinc-900 dark:text-zinc-500",
};

const LABELS: Record<string, string> = {
  hot: "Hot",
  cold: "Cold",
  steady: "Steady",
  insufficient_data: "No data",
};

const ARROWS: Record<string, string> = {
  hot: "↓",
  cold: "↑",
  steady: "→",
  insufficient_data: "",
};

export function TrendBadge({ trend }: { trend: TrendResult | null }) {
  const status = trend?.status ?? "insufficient_data";

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${STYLES[status]}`}
      title={
        trend?.delta !== undefined
          ? `Avg recent differential ${trend.avgRecent?.toFixed(1)} vs handicap index (${trend.delta > 0 ? "+" : ""}${trend.delta.toFixed(1)})`
          : "Not enough recent scores to compute a trend"
      }
    >
      {ARROWS[status]} {LABELS[status]}
    </span>
  );
}
