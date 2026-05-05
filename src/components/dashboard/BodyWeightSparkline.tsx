"use client";

import { formatWeight, weightUnit } from "@/lib/units";
import type { Units } from "@/types";

interface DataPoint {
  date: string;
  body_weight: number;
  rolling?: number;
}

interface Props {
  data: { date: string; body_weight: number }[];
  units: Units;
}

function computeRollingAverage(
  data: { date: string; body_weight: number }[],
  window = 7
): DataPoint[] {
  return data.map((d, i) => {
    const start = Math.max(0, i - window + 1);
    const slice = data.slice(start, i + 1);
    const avg = slice.reduce((s, x) => s + x.body_weight, 0) / slice.length;
    return { ...d, rolling: Math.round(avg * 10) / 10 };
  });
}

function buildPath(points: { x: number; y: number }[]): string {
  return points
    .map((point, index) => `${index === 0 ? "M" : "L"} ${point.x.toFixed(2)} ${point.y.toFixed(2)}`)
    .join(" ");
}

export function BodyWeightSparkline({ data, units }: Props) {
  if (data.length === 0) {
    return (
      <div className="card p-4">
        <div className="flex items-center justify-between mb-3">
          <span className="text-sm font-medium">Body Weight</span>
        </div>
        <p className="text-sm text-muted">No weigh-ins logged yet.</p>
      </div>
    );
  }

  const unit = weightUnit(units);
  const chartData = computeRollingAverage(data);
  const latest = data[data.length - 1]?.body_weight;
  const displayData = chartData.map((d) => ({
    ...d,
    body_weight: parseFloat(formatWeight(d.body_weight, units)),
    rolling: d.rolling !== undefined ? parseFloat(formatWeight(d.rolling, units)) : undefined,
  }));
  const values = displayData.flatMap((d) => [d.body_weight, d.rolling ?? d.body_weight]);
  const minValue = Math.min(...values);
  const maxValue = Math.max(...values);
  const padding = units === "imperial" ? 2 : 1;
  const minY = minValue - padding;
  const maxY = maxValue + padding;
  const range = Math.max(maxY - minY, 1);
  const width = 320;
  const height = 96;
  const xStep = displayData.length > 1 ? width / (displayData.length - 1) : 0;
  const toY = (value: number) => height - ((value - minY) / range) * height;
  const bodyPath = buildPath(displayData.map((d, index) => ({ x: index * xStep, y: toY(d.body_weight) })));
  const rollingPath = buildPath(displayData.map((d, index) => ({ x: index * xStep, y: toY(d.rolling ?? d.body_weight) })));

  return (
    <div className="card p-4">
      <div className="flex items-center justify-between mb-3">
        <span className="text-sm font-medium">Body Weight</span>
        {latest && (
          <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-sm font-semibold">
            {formatWeight(latest, units)} {unit}
          </span>
        )}
      </div>

      <div className="h-24">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          role="img"
          aria-label={`Body weight trend, latest ${formatWeight(latest, units)} ${unit}`}
          className="h-full w-full overflow-visible"
          preserveAspectRatio="none"
        >
          <path d={bodyPath} fill="none" stroke="rgba(255,255,255,0.18)" strokeWidth="1.5" vectorEffect="non-scaling-stroke" />
          <path d={rollingPath} fill="none" stroke="var(--accent, #3B82F6)" strokeWidth="2.5" vectorEffect="non-scaling-stroke" />
        </svg>
      </div>
      <p className="text-[10px] text-white/38 mt-1 text-right">7-day avg overlaid</p>
    </div>
  );
}
