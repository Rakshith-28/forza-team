"use client";

/** Lightweight SVG radar chart (no chart lib). Renders one polygon per series
 * over a shared set of axes, scaled to maxValue. Purely presentational. */
export const RADAR_COLORS = ["#1e9e5a", "#2563eb", "#f59e0b", "#7c3aed"];

export function RadarChart({
  axes,
  series,
  maxValue,
}: {
  axes: string[];
  series: { name: string; values: number[] }[];
  maxValue: number;
}) {
  const size = 340;
  const cx = size / 2;
  const cy = size / 2;
  const radius = 110;
  const n = axes.length;
  const rings = 4;

  if (n < 3) {
    return <p className="py-8 text-center text-sm text-muted-foreground">Need at least 3 scored criteria to draw a radar.</p>;
  }

  const angle = (i: number) => -Math.PI / 2 + (i * 2 * Math.PI) / n;
  const point = (value: number, i: number) => {
    const r = radius * Math.min(1, value / maxValue);
    return [cx + r * Math.cos(angle(i)), cy + r * Math.sin(angle(i))] as const;
  };
  const polygon = (values: number[]) => values.map((v, i) => point(v, i).join(",")).join(" ");
  const ringPolygon = (frac: number) =>
    axes.map((_, i) => [cx + radius * frac * Math.cos(angle(i)), cy + radius * frac * Math.sin(angle(i))].join(",")).join(" ");

  return (
    <svg viewBox={`0 0 ${size} ${size}`} className="mx-auto h-auto w-full max-w-sm" role="img" aria-label="Player comparison radar">
      {/* grid rings */}
      {Array.from({ length: rings }).map((_, r) => (
        <polygon key={r} points={ringPolygon((r + 1) / rings)} fill="none" stroke="currentColor" className="text-border" />
      ))}
      {/* axes + labels */}
      {axes.map((label, i) => {
        const [x, y] = point(maxValue, i);
        const [lx, ly] = [cx + (radius + 16) * Math.cos(angle(i)), cy + (radius + 16) * Math.sin(angle(i))];
        const anchor = Math.abs(lx - cx) < 8 ? "middle" : lx > cx ? "start" : "end";
        return (
          <g key={label}>
            <line x1={cx} y1={cy} x2={x} y2={y} stroke="currentColor" className="text-border" />
            <text x={lx} y={ly} textAnchor={anchor} dominantBaseline="middle" className="fill-muted-foreground text-[9px]">
              {label.length > 14 ? `${label.slice(0, 13)}…` : label}
            </text>
          </g>
        );
      })}
      {/* series */}
      {series.map((s, idx) => {
        const color = RADAR_COLORS[idx % RADAR_COLORS.length];
        return (
          <polygon
            key={s.name}
            points={polygon(s.values)}
            fill={color}
            fillOpacity={0.15}
            stroke={color}
            strokeWidth={2}
            strokeLinejoin="round"
          />
        );
      })}
    </svg>
  );
}
