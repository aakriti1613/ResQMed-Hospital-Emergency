/**
 * Sparkline.tsx
 * ─────────────────────────────────────────────────────────────────────────────
 * A tiny dependency-free SVG sparkline. Renders one line + (optionally) a
 * filled area + last-point dot, sized to its container.
 *
 * Designed for the dashboard vitals tiles and the hospital pre-alert panel,
 * where we display 30 to 60 readings of HR / SpO₂ / vibration / distance in
 * ~40-80px of width.
 * ─────────────────────────────────────────────────────────────────────────────
 */
import { useMemo } from 'react';

type Props = {
  /** Series of numbers, oldest → newest. NaN values are dropped. */
  data: number[];
  width?: number;
  height?: number;
  /** Stroke color (CSS). */
  color?: string;
  /** Fill the area under the curve at low opacity. */
  fill?: boolean;
  /** Pin axis min/max instead of auto-fitting (useful when comparing). */
  yMin?: number;
  yMax?: number;
  /** Render a small dot at the last point. */
  dot?: boolean;
  className?: string;
  ariaLabel?: string;
};

export const Sparkline = ({
  data, width = 70, height = 22, color = '#38bdf8',
  fill = true, yMin, yMax, dot = true, className, ariaLabel,
}: Props) => {
  const { points, areaPath, last } = useMemo(() => {
    const clean = data.filter(Number.isFinite);
    if (clean.length < 2) return { points: '', areaPath: '', last: null as null | { x: number; y: number } };

    const min = yMin ?? Math.min(...clean);
    const max = yMax ?? Math.max(...clean);
    const span = max - min || 1;
    const stepX = clean.length > 1 ? width / (clean.length - 1) : width;

    const ys = clean.map(v => height - ((v - min) / span) * height);
    const pts = ys.map((y, i) => `${(i * stepX).toFixed(2)},${y.toFixed(2)}`);
    const lastPt = { x: (ys.length - 1) * stepX, y: ys[ys.length - 1] };

    return {
      points: pts.join(' '),
      areaPath: `M0,${height} L${pts.join(' L')} L${(ys.length - 1) * stepX},${height} Z`,
      last: lastPt,
    };
  }, [data, width, height, yMin, yMax]);

  if (!points) {
    return (
      <svg width={width} height={height} className={className} aria-label={ariaLabel}>
        <line x1={0} x2={width} y1={height / 2} y2={height / 2}
              stroke="currentColor" strokeOpacity={0.15} strokeDasharray="2 3" />
      </svg>
    );
  }

  return (
    <svg width={width} height={height} className={className} aria-label={ariaLabel}>
      {fill && (
        <path d={areaPath} fill={color} fillOpacity={0.15} />
      )}
      <polyline points={points} fill="none" stroke={color} strokeWidth={1.4}
                strokeLinejoin="round" strokeLinecap="round" />
      {dot && last && (
        <circle cx={last.x} cy={last.y} r={1.8} fill={color} />
      )}
    </svg>
  );
};
