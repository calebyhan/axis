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
  ReferenceLine,
  Legend,
} from "recharts";
import { classifyTrend } from "@/lib/body-weight-trend";
import { weightUnit, distanceUnit, formatWeight, formatDistance, formatPace } from "@/lib/units";
import { useState } from "react";
import type { TimeRange } from "@/lib/queries/stats";
import type { TrainingLoadPoint } from "@/lib/training-load";
import type { Units } from "@/types";

type Tab = "workout" | "running" | "body" | "load";

const TIME_RANGES: { label: string; value: TimeRange }[] = [
  { label: "Week", value: "week" },
  { label: "Month", value: "month" },
  { label: "Year", value: "year" },
  { label: "All", value: "all" },
];

const TABS: { label: string; value: Tab }[] = [
  { label: "Workout", value: "workout" },
  { label: "Running", value: "running" },
  { label: "Body", value: "body" },
  { label: "Load", value: "load" },
];

interface WorkoutSummary {
  sessionCount: number;
  totalSets: number;
  totalVolume: number;
  topExercises: { name: string; volume: number; sets: number }[];
}

interface Props {
  timeRange: TimeRange;
  initialVolumeData: { week: string; volume: number }[];
  initialRunningData: {
    start_time: string;
    distance: number | null;
    avg_pace: number | null;
    suffer_score: number | null;
    avg_heartrate?: number | null;
    duration?: number | null;
  }[];
  initialBodyData: { date: string; body_weight: number }[];
  workoutSummary: WorkoutSummary;
  trainingLoad: TrainingLoadPoint[];
  units: Units;
}

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

function computeRolling(data: { date: string; body_weight: number }[], window = 7) {
  return data.map((d, i) => {
    const start = Math.max(0, i - window + 1);
    const slice = data.slice(start, i + 1);
    const avg = slice.reduce((s, x) => s + x.body_weight, 0) / slice.length;
    return { ...d, rolling: Math.round(avg * 10) / 10 };
  });
}

function tsbStatus(tsb: number): { label: string; color: string } {
  if (tsb > 5) return { label: "Fresh", color: "text-green-400" };
  if (tsb > -10) return { label: "Neutral", color: "text-blue-400" };
  if (tsb > -30) return { label: "Fatigued", color: "text-orange-400" };
  return { label: "Overreaching", color: "text-red-400" };
}

export function StatsClient({
  timeRange,
  initialVolumeData,
  initialRunningData,
  initialBodyData,
  workoutSummary,
  trainingLoad,
  units,
}: Props) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<Tab>("workout");

  // ── Body weight computations ──────────────────────────────────────────────
  const convertedBodyData = initialBodyData.map((d) => ({
    ...d,
    body_weight:
      units === "imperial" ? Math.round(d.body_weight * 2.20462 * 10) / 10 : d.body_weight,
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

  const currentWeight =
    convertedBodyData.length > 0 ? convertedBodyData[convertedBodyData.length - 1].body_weight : null;
  const firstWeight = convertedBodyData.length > 0 ? convertedBodyData[0].body_weight : null;
  const weightDelta =
    currentWeight !== null && firstWeight !== null ? currentWeight - firstWeight : null;
  const minWeight = convertedBodyData.length > 0 ? Math.min(...convertedBodyData.map((d) => d.body_weight)) : null;
  const maxWeight = convertedBodyData.length > 0 ? Math.max(...convertedBodyData.map((d) => d.body_weight)) : null;

  // ── Running computations ──────────────────────────────────────────────────
  const totalDistanceKm = initialRunningData.reduce((s, r) => s + (r.distance ?? 0), 0) / 1000;
  const runCount = initialRunningData.length;
  const pacesWithData = initialRunningData.filter((r) => r.avg_pace);
  const bestPace = pacesWithData.length > 0 ? Math.min(...pacesWithData.map((r) => r.avg_pace!)) : null;
  const hrsWithData = initialRunningData.filter((r) => r.avg_heartrate);
  const avgHR =
    hrsWithData.length > 0
      ? Math.round(hrsWithData.reduce((s, r) => s + r.avg_heartrate!, 0) / hrsWithData.length)
      : null;

  const runChartData = initialRunningData.map((r) => {
    const km = r.distance ? r.distance / 1000 : 0;
    return {
      date: r.start_time.split("T")[0],
      dist: parseFloat(formatDistance(km, units)),
    };
  });

  const sufferChartData = initialRunningData
    .filter((r) => r.suffer_score != null)
    .map((r) => ({ date: r.start_time.split("T")[0], suffer: r.suffer_score }));

  const hrChartData = initialRunningData
    .filter((r) => r.avg_heartrate != null)
    .map((r) => ({ date: r.start_time.split("T")[0], hr: r.avg_heartrate }));

  // ── Workout volume with unit conversion ──────────────────────────────────
  const volumeChartData = initialVolumeData.map((d) => ({
    ...d,
    volume: units === "imperial" ? Math.round(d.volume * 2.20462) : d.volume,
  }));

  // ── Training load ─────────────────────────────────────────────────────────
  const latestLoad = trainingLoad.length > 0 ? trainingLoad[trainingLoad.length - 1] : null;
  const tsbInfo = latestLoad ? tsbStatus(latestLoad.tsb) : null;

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
        {TABS.map((t) => (
          <button
            key={t.value}
            onClick={() => setActiveTab(t.value)}
            className={`pb-2 text-sm font-medium border-b-2 transition-colors -mb-px ${
              activeTab === t.value
                ? "border-accent text-white"
                : "border-transparent text-muted"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* ── Workout tab ──────────────────────────────────────────────────────── */}
      {activeTab === "workout" && (
        <div className="flex flex-col gap-5">
          {/* Summary stat cards */}
          <div className="flex gap-2">
            <StatCard label="Sessions" value={String(workoutSummary.sessionCount)} />
            <StatCard
              label={`Volume (${weightUnit(units)})`}
              value={
                workoutSummary.totalVolume === 0
                  ? "—"
                  : formatWeight(workoutSummary.totalVolume, units)
              }
            />
            <StatCard label="Total Sets" value={String(workoutSummary.totalSets)} />
          </div>

          {/* Volume over time */}
          <div className="card p-4">
            <h3 className="text-sm font-medium mb-4">Volume Over Time ({weightUnit(units)})</h3>
            {volumeChartData.length === 0 ? (
              <p className="text-muted text-sm">No data for this period.</p>
            ) : (
              <div className="h-40">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={volumeChartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1F1F1F" />
                    <XAxis dataKey="week" tick={{ fill: "#666", fontSize: 10 }} tickLine={false} />
                    <YAxis
                      tick={{ fill: "#666", fontSize: 10 }}
                      tickLine={false}
                      axisLine={false}
                      tickFormatter={(v) => (v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v)}
                    />
                    <Tooltip
                      {...CHART_STYLE}
                      formatter={(v) => [`${v} ${weightUnit(units)}`, "Volume"]}
                    />
                    <Bar dataKey="volume" fill="var(--accent, #3B82F6)" radius={[3, 3, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>

          {/* Top exercises */}
          {workoutSummary.topExercises.length > 0 && (
            <div className="card p-4">
              <h3 className="text-sm font-medium mb-3">Top Exercises by Volume</h3>
              <div className="flex flex-col gap-3">
                {(() => {
                  const maxVol = workoutSummary.topExercises[0].volume;
                  return workoutSummary.topExercises.map((ex) => {
                    const displayVol =
                      units === "imperial" ? Math.round(ex.volume * 2.20462) : ex.volume;
                    return (
                      <div key={ex.name} className="flex flex-col gap-1">
                        <div className="flex justify-between text-sm">
                          <span className="font-medium truncate pr-2">{ex.name}</span>
                          <span className="text-muted shrink-0">
                            {formatWeight(ex.volume, units)} {weightUnit(units)} · {ex.sets} sets
                          </span>
                        </div>
                        <div className="h-1.5 bg-border rounded-full overflow-hidden">
                          <div
                            className="h-full rounded-full bg-accent"
                            style={{ width: `${(displayVol / (units === "imperial" ? Math.round(maxVol * 2.20462) : maxVol)) * 100}%` }}
                          />
                        </div>
                      </div>
                    );
                  });
                })()}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Running tab ──────────────────────────────────────────────────────── */}
      {activeTab === "running" && (
        <div className="flex flex-col gap-5">
          {/* Summary stat cards */}
          <div className="flex gap-2">
            <StatCard
              label={`Distance (${distanceUnit(units)})`}
              value={runCount === 0 ? "—" : formatDistance(totalDistanceKm, units)}
            />
            <StatCard label="Runs" value={String(runCount)} />
            <StatCard
              label="Best Pace"
              value={bestPace ? formatPace(bestPace, units) : "—"}
            />
            <StatCard label="Avg HR" value={avgHR ? `${avgHR} bpm` : "—"} />
          </div>

          {/* Distance per run */}
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

          {/* Pace trend */}
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

          {/* Suffer score */}
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

          {/* Heart rate trend */}
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
      )}

      {/* ── Body tab ─────────────────────────────────────────────────────────── */}
      {activeTab === "body" && (
        <div className="flex flex-col gap-5">
          {/* Summary stat cards */}
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
                label={`Min / Max`}
                value={
                  minWeight !== null && maxWeight !== null
                    ? `${formatWeight(minWeight, units)} / ${formatWeight(maxWeight, units)}`
                    : "—"
                }
              />
            </div>
          )}

          {/* Weight chart */}
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

          {/* Recent weigh-ins */}
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
      )}

      {/* ── Load tab ─────────────────────────────────────────────────────────── */}
      {activeTab === "load" && (
        <div className="flex flex-col gap-5">
          {/* TSB status + current values */}
          {latestLoad && tsbInfo && (
            <div className="flex gap-2">
              <StatCard label="Fitness (CTL)" value={String(latestLoad.ctl)} />
              <StatCard label="Fatigue (ATL)" value={String(latestLoad.atl)} />
              <div className="card p-3 flex flex-col gap-1 flex-1">
                <span className="text-xs text-muted">Form (TSB)</span>
                <span className={`text-base font-semibold leading-tight ${tsbInfo.color}`}>
                  {latestLoad.tsb > 0 ? "+" : ""}{latestLoad.tsb} · {tsbInfo.label}
                </span>
              </div>
            </div>
          )}

          {/* ATL / CTL / TSB chart */}
          {trainingLoad.length === 0 ? (
            <div className="card p-4">
              <p className="text-muted text-sm">No training data in the last 90 days.</p>
            </div>
          ) : (
            <>
              <div className="card p-4">
                <div className="flex items-center justify-between mb-1">
                  <h3 className="text-sm font-medium">Fitness & Fatigue</h3>
                  <span className="text-xs text-muted">Last 90 days</span>
                </div>
                <div className="h-48">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={trainingLoad}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#1F1F1F" />
                      <XAxis dataKey="date" tick={{ fill: "#666", fontSize: 10 }} tickLine={false} />
                      <YAxis tick={{ fill: "#666", fontSize: 10 }} tickLine={false} axisLine={false} />
                      <Tooltip
                        {...CHART_STYLE}
                        formatter={(v, name) => [
                          v,
                          name === "ctl" ? "Fitness (CTL)" : name === "atl" ? "Fatigue (ATL)" : name,
                        ]}
                      />
                      <Legend
                        formatter={(v) =>
                          v === "ctl" ? "Fitness (CTL)" : v === "atl" ? "Fatigue (ATL)" : v
                        }
                        wrapperStyle={{ fontSize: 11, color: "#666" }}
                      />
                      <Line
                        type="monotone"
                        dataKey="ctl"
                        stroke="var(--accent, #3B82F6)"
                        strokeWidth={2}
                        dot={false}
                      />
                      <Line
                        type="monotone"
                        dataKey="atl"
                        stroke="#f97316"
                        strokeWidth={2}
                        dot={false}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="card p-4">
                <div className="flex items-center justify-between mb-1">
                  <h3 className="text-sm font-medium">Form (TSB)</h3>
                  <span className="text-xs text-muted">+ fresh · − fatigued</span>
                </div>
                <div className="h-40">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={trainingLoad}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#1F1F1F" />
                      <XAxis dataKey="date" tick={{ fill: "#666", fontSize: 10 }} tickLine={false} />
                      <YAxis tick={{ fill: "#666", fontSize: 10 }} tickLine={false} axisLine={false} />
                      <ReferenceLine y={0} stroke="#444" strokeDasharray="4 4" />
                      <ReferenceLine y={5} stroke="#22c55e" strokeDasharray="3 6" strokeOpacity={0.4} />
                      <ReferenceLine y={-10} stroke="#f97316" strokeDasharray="3 6" strokeOpacity={0.4} />
                      <Tooltip
                        {...CHART_STYLE}
                        formatter={(v) => [v, "Form (TSB)"]}
                      />
                      <Line
                        type="monotone"
                        dataKey="tsb"
                        stroke="#a855f7"
                        strokeWidth={2}
                        dot={false}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
                <div className="flex gap-4 mt-3 text-xs text-muted">
                  <span className="text-green-400">+5 Fresh</span>
                  <span className="text-blue-400">−10–+5 Neutral</span>
                  <span className="text-orange-400">−30–−10 Fatigued</span>
                  <span className="text-red-400">&lt; −30 Overreaching</span>
                </div>
              </div>

              {/* Daily TL bar chart */}
              <div className="card p-4">
                <h3 className="text-sm font-medium mb-4">Daily Training Load</h3>
                <div className="h-36">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={trainingLoad}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#1F1F1F" />
                      <XAxis dataKey="date" tick={{ fill: "#666", fontSize: 10 }} tickLine={false} />
                      <YAxis tick={{ fill: "#666", fontSize: 10 }} tickLine={false} axisLine={false} />
                      <Tooltip {...CHART_STYLE} formatter={(v) => [v, "Daily TL"]} />
                      <Bar dataKey="dailyTL" fill="#6366f1" radius={[2, 2, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
