export function Sparkline({ data, referenceValue }: { data: number[]; referenceValue?: number | null }) {
  if (data.length < 2) {
    return <div className="h-6 w-20 shrink-0" />;
  }

  const width = 80;
  const height = 24;
  const padding = 2;

  const allValues = referenceValue != null ? [...data, referenceValue] : data;
  const min = Math.min(...allValues);
  const max = Math.max(...allValues);
  const range = max - min || 1;

  const toXY = (value: number, i: number): [number, number] => {
    const x = padding + (i / (data.length - 1)) * (width - padding * 2);
    const y = height - padding - ((value - min) / range) * (height - padding * 2);
    return [x, y];
  };

  const points = data.map((v, i) => toXY(v, i).join(",")).join(" ");
  const refY = referenceValue != null ? toXY(referenceValue, 0)[1] : null;

  return (
    <svg width={width} height={height} className="shrink-0 text-zinc-400">
      {refY !== null && (
        <line x1={0} y1={refY} x2={width} y2={refY} stroke="currentColor" strokeDasharray="2,2" strokeWidth={1} />
      )}
      <polyline
        points={points}
        fill="none"
        stroke="currentColor"
        className="text-blue-500 dark:text-blue-400"
        strokeWidth={1.5}
      />
    </svg>
  );
}
