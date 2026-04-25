"use client";

import { LineChart, Line, ResponsiveContainer, Tooltip, YAxis } from "recharts";
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
  const minWeight = Math.min(...data.map((d) => d.body_weight));
  const maxWeight = Math.max(...data.map((d) => d.body_weight));

  // Convert bounds for Y-axis domain
  const minDisplay = parseFloat(formatWeight(minWeight, units));
  const maxDisplay = parseFloat(formatWeight(maxWeight, units));
  const domain = [minDisplay - (units === "imperial" ? 2 : 1), maxDisplay + (units === "imperial" ? 2 : 1)];

  // Convert all data points for display
  const displayData = chartData.map((d) => ({
    ...d,
    body_weight: parseFloat(formatWeight(d.body_weight, units)),
    rolling: d.rolling !== undefined ? parseFloat(formatWeight(d.rolling, units)) : undefined,
  }));

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
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={displayData}>
            <YAxis domain={domain} hide />
            <Tooltip
              content={({ active, payload }) => {
                if (!active || !payload?.[0]) return null;
                const d = payload[0].payload as DataPoint;
                return (
                  <div className="card px-2 py-1 text-xs">
                    <div>{d.date}</div>
                    <div className="font-medium">{d.body_weight} {unit}</div>
                  </div>
                );
              }}
            />
            <Line
              type="monotone"
              dataKey="body_weight"
              stroke="rgba(255,255,255,0.18)"
              strokeWidth={1}
              dot={false}
              isAnimationActive={false}
            />
            <Line
              type="monotone"
              dataKey="rolling"
              stroke="var(--accent, #3B82F6)"
              strokeWidth={2}
              dot={false}
              isAnimationActive={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
      <p className="text-[10px] text-white/38 mt-1 text-right">7-day avg overlaid</p>
    </div>
  );
}
