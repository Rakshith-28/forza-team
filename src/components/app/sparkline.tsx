/**
 * Minimal dependency-free attendance sparkline (line + soft area fill). Values
 * are percentages (0–100), oldest → newest. Shared by the coach dashboard tile
 * and the Attendance overview.
 */
export function Sparkline({
  series,
  width = 100,
  height = 40,
  label = "Recent attendance trend",
  emptyText = "No attendance yet",
}: {
  series: number[];
  width?: number;
  height?: number;
  label?: string;
  emptyText?: string;
}) {
  if (series.length === 0) {
    return <p className="text-right text-xs text-muted-foreground">{emptyText}</p>;
  }
  const w = width;
  const h = height;
  const pad = 4;
  const max = 100;
  const n = series.length;
  const x = (i: number) => (n === 1 ? w / 2 : pad + (i / (n - 1)) * (w - pad * 2));
  const y = (v: number) => pad + (1 - v / max) * (h - pad * 2);
  const points = series.map((v, i) => `${x(i)},${y(v)}`).join(" ");
  const area = `M ${pad},${h - pad} L ${series.map((v, i) => `${x(i)},${y(v)}`).join(" L ")} L ${x(n - 1)},${h - pad} Z`;
  const last = series[n - 1];

  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} className="text-primary" role="img" aria-label={label}>
      <path d={area} className="fill-primary/10" />
      <polyline points={points} fill="none" stroke="currentColor" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
      <circle cx={x(n - 1)} cy={y(last)} r={3} className="fill-primary" />
    </svg>
  );
}
