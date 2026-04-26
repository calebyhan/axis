"use client";

import {
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";
import { distanceUnit, formatDistance, formatPace } from "@/lib/units";
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
  runChartData: { date: string; dist: number }[];
  pacesWithData: { start_time: string; avg_pace: number | null }[];
  sufferChartData: { date: string; suffer: number | null }[];
  hrChartData: { date: string; hr: number | null }[];
  totalDistanceKm: number;
  runCount: number;
  bestPace: number | null;
  avgHR: number | null;
  units: Units;
}

export default function RunningTab({
  runChartData,
  pacesWithData,
  sufferChartData,
  hrChartData,
  totalDistanceKm,
  runCount,
  bestPace,
  avgHR,
  units,
}: Props) {
  return (
    <div className="flex flex-col gap-5">
      <div className="flex gap-2">
        <StatCard
          label={`Distance (${distanceUnit(units)})`}
          value={runCount === 0 ? "—" : formatDistance(totalDistanceKm, units)}
        />
        <StatCard label="Runs" value={String(runCount)} />
        <StatCard label="Best Pace" value={bestPace ? formatPace(bestPace, units) : "—"} />
        <StatCard label="Avg HR" value={avgHR ? `${avgHR} bpm` : "—"} />
      </div>

      <div className="md:grid md:grid-cols-2 md:gap-5 flex flex-col gap-5">
      <div className="card p-4">
        <h3 className="text-sm font-medium mb-4">Distance ({distanceUnit(units)})</h3>
        {runCount === 0 ? (
          <p className="text-muted text-sm">No runs for this period.</p>
        ) : (
          <div className="h-40">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={runChartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1F1F1F" />
                <XAxis dataKey="date" tick={{ fill: "#666", fontSize: 10 }} tickLine={false} />
                <YAxis tick={{ fill: "#666", fontSize: 10 }} tickLine={false} axisLine={false} />
                <Tooltip
                  {...CHART_STYLE}
                  formatter={(v) => [`${v} ${distanceUnit(units)}`, "Distance"]}
                />
                <Bar dataKey="dist" fill="var(--accent, #3B82F6)" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {pacesWithData.length > 0 && (
        <div className="card p-4">
          <h3 className="text-sm font-medium mb-4">Pace Trend</h3>
          <div className="h-40">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart
                data={pacesWithData.map((r) => ({
                  date: r.start_time.split("T")[0],
                  pace: r.avg_pace,
                }))}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#1F1F1F" />
                <XAxis dataKey="date" tick={{ fill: "#666", fontSize: 10 }} tickLine={false} />
                <YAxis
                  tick={{ fill: "#666", fontSize: 10 }}
                  tickLine={false}
                  axisLine={false}
                  reversed
                  tickFormatter={(v) => formatPace(v, units)}
                />
                <Tooltip
                  {...CHART_STYLE}
                  formatter={(v) => [formatPace(v as number, units), "Pace"]}
                />
                <Line
                  type="monotone"
                  dataKey="pace"
                  stroke="var(--accent, #3B82F6)"
                  strokeWidth={2}
                  dot={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {sufferChartData.length > 0 && (
        <div className="card p-4">
          <h3 className="text-sm font-medium mb-4">Suffer Score</h3>
          <div className="h-40">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={sufferChartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1F1F1F" />
                <XAxis dataKey="date" tick={{ fill: "#666", fontSize: 10 }} tickLine={false} />
                <YAxis
                  tick={{ fill: "#666", fontSize: 10 }}
                  tickLine={false}
                  axisLine={false}
                  domain={[0, 200]}
                />
                <Tooltip {...CHART_STYLE} formatter={(v) => [v, "Suffer Score"]} />
                <Bar dataKey="suffer" fill="#f97316" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {hrChartData.length > 0 && (
        <div className="card p-4">
          <h3 className="text-sm font-medium mb-4">Heart Rate Trend</h3>
          <div className="h-40">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={hrChartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1F1F1F" />
                <XAxis dataKey="date" tick={{ fill: "#666", fontSize: 10 }} tickLine={false} />
                <YAxis
                  tick={{ fill: "#666", fontSize: 10 }}
                  tickLine={false}
                  axisLine={false}
                  domain={["auto", "auto"]}
                />
                <Tooltip {...CHART_STYLE} formatter={(v) => [`${v} bpm`, "Avg HR"]} />
                <Line
                  type="monotone"
                  dataKey="hr"
                  stroke="#ef4444"
                  strokeWidth={2}
                  dot={{ r: 3, fill: "#ef4444" }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
      </div>
    </div>
  );
}
