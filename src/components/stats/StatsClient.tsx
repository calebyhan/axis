"use client";

import { useRouter } from "next/navigation";
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
import { classifyTrend } from "@/lib/body-weight-trend";
import { weightUnit, distanceUnit, formatWeight, formatPace } from "@/lib/units";
import { useState } from "react";
import type { TimeRange } from "@/lib/queries/stats";
import type { Units } from "@/types";

type Tab = "workout" | "running" | "body";

const TIME_RANGES: { label: string; value: TimeRange }[] = [
  { label: "Week", value: "week" },
  { label: "Month", value: "month" },
  { label: "Year", value: "year" },
  { label: "All", value: "all" },
];

interface Props {
  timeRange: TimeRange;
  initialVolumeData: { week: string; volume: number }[];
  initialRunningData: {
    start_time: string;
    distance: number | null;
    avg_pace: number | null;
    suffer_score: number | null;
  }[];
  initialBodyData: { date: string; body_weight: number }[];
  units: Units;
}

function computeRolling(
  data: { date: string; body_weight: number }[],
  window = 7
) {
  return data.map((d, i) => {
    const start = Math.max(0, i - window + 1);
    const slice = data.slice(start, i + 1);
    const avg = slice.reduce((s, x) => s + x.body_weight, 0) / slice.length;
    return { ...d, rolling: Math.round(avg * 10) / 10 };
  });
}

export function StatsClient({ timeRange, initialVolumeData, initialRunningData, initialBodyData, units }: Props) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<Tab>("workout");

  const convertedBodyData = initialBodyData.map((d) => ({
    ...d,
    body_weight: units === "imperial" ? Math.round(d.body_weight * 2.20462 * 10) / 10 : d.body_weight,
  }));
  const bodyChartData = computeRolling(convertedBodyData);
  const trend = classifyTrend(
    initialBodyData.map((d) => ({ date: new Date(d.date), weight: d.body_weight }))
  );

  const trendBadge = {
    gaining: { label: "Gaining", color: "text-green-400" },
    maintaining: { label: "Maintaining", color: "text-blue-400" },
    losing: { label: "Losing", color: "text-red-400" },
  }[trend];

  return (
    <div className="flex flex-col gap-5">
      {/* Time filter — updates URL, triggers server re-fetch */}
      <div className="flex gap-1 bg-surface rounded-lg p-1">
        {TIME_RANGES.map((r) => (
          <button
            key={r.value}
            onClick={() => router.push(`/stats?range=${r.value}`)}
            className={`flex-1 py-1.5 rounded-md text-sm font-medium transition-colors ${
              timeRange === r.value ? "bg-border text-white" : "text-muted"
            }`}
          >
            {r.label}
          </button>
        ))}
      </div>

      {/* Tab selector */}
      <div className="flex gap-4 border-b border-border">
        {(["workout", "running", "body"] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setActiveTab(t)}
            className={`pb-2 text-sm font-medium capitalize border-b-2 transition-colors -mb-px ${
              activeTab === t
                ? "border-accent text-white"
                : "border-transparent text-muted"
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {/* Workout charts */}
      {activeTab === "workout" && (
        <div className="flex flex-col gap-5">
          <div className="card p-4">
            <h3 className="text-sm font-medium mb-4">Volume Over Time ({weightUnit(units)})</h3>
            {initialVolumeData.length === 0 ? (
              <p className="text-muted text-sm">No data for this period.</p>
            ) : (
              <div className="h-40">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={initialVolumeData.map((d) => ({
                    ...d,
                    volume: units === "imperial" ? Math.round(d.volume * 2.20462) : d.volume,
                  }))}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1F1F1F" />
                    <XAxis
                      dataKey="week"
                      tick={{ fill: "#666", fontSize: 10 }}
                      tickLine={false}
                    />
                    <YAxis
                      tick={{ fill: "#666", fontSize: 10 }}
                      tickLine={false}
                      axisLine={false}
                      tickFormatter={(v) => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v}
                    />
                    <Tooltip
                      contentStyle={{ background: "#141414", border: "1px solid #1F1F1F", borderRadius: 8, fontSize: 12 }}
                      labelStyle={{ color: "#666" }}
                      formatter={(v) => [`${v} ${weightUnit(units)}`, "Volume"]}
                    />
                    <Bar dataKey="volume" fill="var(--accent, #3B82F6)" radius={[3, 3, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Running charts */}
      {activeTab === "running" && (
        <div className="flex flex-col gap-5">
          <div className="card p-4">
            <h3 className="text-sm font-medium mb-4">Distance ({distanceUnit(units)})</h3>
            {initialRunningData.length === 0 ? (
              <p className="text-muted text-sm">No runs for this period.</p>
            ) : (
              <div className="h-40">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={initialRunningData.map((r) => {
                      const km = r.distance ? r.distance / 1000 : 0;
                      const dist = units === "imperial" ? +(km * 0.621371).toFixed(2) : +km.toFixed(2);
                      return { date: r.start_time.split("T")[0], dist };
                    })}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#1F1F1F" />
                    <XAxis dataKey="date" tick={{ fill: "#666", fontSize: 10 }} tickLine={false} />
                    <YAxis tick={{ fill: "#666", fontSize: 10 }} tickLine={false} axisLine={false} />
                    <Tooltip
                      contentStyle={{ background: "#141414", border: "1px solid #1F1F1F", borderRadius: 8, fontSize: 12 }}
                      formatter={(v) => [`${v} ${distanceUnit(units)}`, "Distance"]}
                    />
                    <Bar dataKey="dist" fill="var(--accent, #3B82F6)" radius={[3, 3, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>

          <div className="card p-4">
            <h3 className="text-sm font-medium mb-4">Pace Trend</h3>
            {initialRunningData.filter((r) => r.avg_pace).length === 0 ? (
              <p className="text-muted text-sm">No pace data.</p>
            ) : (
              <div className="h-40">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart
                    data={initialRunningData
                      .filter((r) => r.avg_pace)
                      .map((r) => ({ date: r.start_time.split("T")[0], pace: r.avg_pace }))}
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
                      contentStyle={{ background: "#141414", border: "1px solid #1F1F1F", borderRadius: 8, fontSize: 12 }}
                      formatter={(v) => [formatPace(v as number, units), "Pace"]}
                    />
                    <Line type="monotone" dataKey="pace" stroke="var(--accent, #3B82F6)" strokeWidth={2} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Body charts */}
      {activeTab === "body" && (
        <div className="flex flex-col gap-5">
          <div className="card p-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-medium">Body Weight ({weightUnit(units)})</h3>
              <span className={`text-xs font-medium ${trendBadge.color}`}>
                {trendBadge.label}
              </span>
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
                    <Tooltip
                      contentStyle={{ background: "#141414", border: "1px solid #1F1F1F", borderRadius: 8, fontSize: 12 }}
                    />
                    <Line type="monotone" dataKey="body_weight" stroke="#333" strokeWidth={1} dot={{ r: 2, fill: "#555" }} />
                    <Line type="monotone" dataKey="rolling" stroke="var(--accent, #3B82F6)" strokeWidth={2} dot={false} name="7-day avg" />
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
                    <span className="font-medium">{formatWeight(d.body_weight, units)} {weightUnit(units)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
