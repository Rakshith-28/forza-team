/**
 * DissolveFooter — a footer whose top edge "dissolves" into the page: tiny
 * black squares scattered sparsely across a transition band at the top, getting
 * denser going down until the footer becomes fully solid black.
 *
 * Rendered as a single inline SVG of 1×1 unit tiles (pixel-art look, no
 * rounding). The scatter pattern comes from a deterministic seeded PRNG keyed
 * by tile index, so the server and client produce the identical pattern —
 * never use Math.random() here, it would cause a hydration mismatch.
 *
 * Dependency-free: no canvas, no libraries.
 */

/** Deterministic PRNG — same seed always yields the same value (SSR-safe). */
function mulberry32(seed: number): () => number {
  return function () {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export interface DissolveFooterProps {
  /** Rendered footer height in px (the SVG stretches to fill width). */
  height?: number;
  /** Horizontal tile count. */
  cols?: number;
  /** Vertical tile count. */
  rows?: number;
  /** Fraction of rows (from the top) that form the dissolve band. */
  bandRatio?: number;
  /** Tile color (resolved via `currentColor`). */
  color?: string;
  className?: string;
}

export default function DissolveFooter({
  height = 360,
  cols = 120,
  rows = 72,
  bandRatio = 0.2,
  color = "black",
  className,
}: DissolveFooterProps) {
  const bandRows = Math.round(rows * bandRatio);

  // Transition band: per-tile fill probability ramps up quadratically from the
  // top (sparse) to the bottom (near-solid). Below the band is fully solid,
  // drawn as one rect (visually identical to filling every tile there).
  const tiles: React.ReactNode[] = [];
  for (let row = 0; row < bandRows; row++) {
    const t = row / bandRows; // 0 at top of band → ~1 at its bottom
    const p = t * t; // quadratic easing — density accelerates downward
    for (let col = 0; col < cols; col++) {
      const rng = mulberry32(row * cols + col);
      if (rng() < p) {
        tiles.push(<rect key={`${row}-${col}`} x={col} y={row} width={1} height={1} />);
      }
    }
  }

  return (
    <svg
      aria-hidden
      viewBox={`0 0 ${cols} ${rows}`}
      preserveAspectRatio="none"
      shapeRendering="crispEdges"
      fill="currentColor"
      className={className}
      style={{ color, width: "100%", height, display: "block" }}
    >
      {/* Solid lower region (equivalent to every tile below the band filled). */}
      <rect x={0} y={bandRows} width={cols} height={rows - bandRows} />
      {tiles}
    </svg>
  );
}
