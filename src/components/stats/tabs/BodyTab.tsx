"use client";

import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { weightUnit, formatWeight } from "@/lib/units";
import type { Units } from "@/types";

const CHART_STYLE = {
  contentStyle: {
    background: "#141414",
    border: "1px solid #1F1F1F",
    borderRadius: 8,
    fontSize: 12,
  },
  labelStyle: { color: "#666" },
};

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="card p-3 flex flex-col gap-1 flex-1">
      <span className="text-xs text-muted">{label}</span>
      <span className="text-base font-semibold leading-tight">{value}</span>
    </div>
  );
}

interface Props {
  bodyChartData: { date: string; body_weight: number; rolling: number }[];
  convertedBodyData: { date: string; body_weight: number }[];
  initialBodyData: { date: string; body_weight: number }[];
  trendBadge: { label: string; color: string };
  currentWeight: number | null;
  weightDelta: number | null;
  minWeight: number | null;
  maxWeight: number | null;
  units: Units;
}

export default function BodyTab({
  bodyChartData,
  convertedBodyData,
  initialBodyData,
  trendBadge,
  currentWeight,
  weightDelta,
  minWeight,
  maxWeight,
  units,
}: Props) {
  return (
    <div className="flex flex-col gap-5">
      {convertedBodyData.length > 0 && (
        <div className="flex gap-2">
          <StatCard
            label={`Current (${weightUnit(units)})`}
            value={currentWeight !== null ? `${formatWeight(currentWeight, units)}` : "—"}
          />
          <StatCard
            label="Change"
            value={
              weightDelta !== null
                ? `${weightDelta > 0 ? "+" : ""}${formatWeight(Math.abs(weightDelta), units)} ${weightUnit(units)}`
                : "—"
            }
          />
          <StatCard
            label="Min / Max"
            value={
              minWeight !== null && maxWeight !== null
                ? `${formatWeight(minWeight, units)} / ${formatWeight(maxWeight, units)}`
                : "—"
            }
          />
        </div>
      )}

      <div className="card p-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-medium">Body Weight ({weightUnit(units)})</h3>
          <span className={`text-xs font-medium ${trendBadge.color}`}>{trendBadge.label}</span>
        </div>
        {initialBodyData.length === 0 ? (
          <p className="text-muted text-sm">No weigh-ins for this period.</p>
        ) : (
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={bodyChartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1F1F1F" />
                <XAxis dataKey="date" tick={{ fill: "#666", fontSize: 10 }} tickLine={false} />
                <YAxis
                  tick={{ fill: "#666", fontSize: 10 }}
                  tickLine={false}
                  axisLine={false}
                  domain={["auto", "auto"]}
                />
                <Tooltip {...CHART_STYLE} />
                <Line
                  type="monotone"
                  dataKey="body_weight"
                  stroke="#333"
                  strokeWidth={1}
                  dot={{ r: 2, fill: "#555" }}
                />
                <Line
                  type="monotone"
                  dataKey="rolling"
                  stroke="var(--accent, #3B82F6)"
                  strokeWidth={2}
                  dot={false}
                  name="7-day avg"
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {initialBodyData.length > 0 && (
        <div className="card p-4">
          <h3 className="text-sm font-medium mb-3">Recent Weigh-ins</h3>
          <div className="flex flex-col gap-2">
            {[...initialBodyData].reverse().slice(0, 10).map((d) => (
              <div key={d.date} className="flex justify-between text-sm">
                <span className="text-muted">{d.date}</span>
                <span className="font-medium">
                  {formatWeight(d.body_weight, units)} {weightUnit(units)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
