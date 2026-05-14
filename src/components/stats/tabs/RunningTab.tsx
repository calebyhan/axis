"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
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
import { CHART_LINE_TOOLTIP_PROPS, CHART_TOOLTIP_PROPS } from "@/components/stats/chartTheme";
import { Select } from "@/components/ui/Select";
import { distanceUnit, formatDistance, formatPace } from "@/lib/units";
import type { Units } from "@/types";

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
  personalRecords: RunningPersonalRecord[];
  units: Units;
}

interface RunningPersonalRecord {
  activityId: string;
  activityName: string | null;
  startTime: string;
  effortName: string;
  elapsedTime: number;
  distance: number;
}

const BEST_EFFORT_ORDER = [
  "400m", "1/2 mile", "1k", "1 mile", "2 mile", "5k", "10k",
  "15k", "10 mile", "20k", "Half-Marathon", "Marathon",
];

function effortSortValue(name: string): number {
  const index = BEST_EFFORT_ORDER.indexOf(name);
  return index === -1 ? BEST_EFFORT_ORDER.length : index;
}

function formatElapsedTime(secs: number): string {
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  const s = Math.round(secs % 60);
  return h > 0
    ? `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`
    : `${m}:${String(s).padStart(2, "0")}`;
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
  personalRecords,
  units,
}: Props) {
  const [prFilter, setPrFilter] = useState("all");
  const prFilterOptions = useMemo(() => {
    const effortNames = Array.from(new Set(personalRecords.map((record) => record.effortName)));
    effortNames.sort((a, b) => {
      const orderDelta = effortSortValue(a) - effortSortValue(b);
      return orderDelta === 0 ? a.localeCompare(b) : orderDelta;
    });
    return [
      { value: "all", label: "All PRs" },
      ...effortNames.map((name) => ({ value: name, label: name })),
    ];
  }, [personalRecords]);
  const activePrFilter = prFilterOptions.some((option) => option.value === prFilter) ? prFilter : "all";
  const filteredPersonalRecords = useMemo(() => {
    const records = activePrFilter === "all"
      ? personalRecords
      : personalRecords.filter((record) => record.effortName === activePrFilter);

    return [...records].sort((a, b) => {
      const effortDelta = effortSortValue(a.effortName) - effortSortValue(b.effortName);
      if (effortDelta !== 0) return effortDelta;
      return a.startTime.localeCompare(b.startTime);
    });
  }, [personalRecords, activePrFilter]);

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

      <div className="card p-4">
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3 className="text-sm font-medium">Personal Records</h3>
            <p className="mt-1 text-xs text-muted">
              {personalRecords.length > 0
                ? `${personalRecords.length} PR${personalRecords.length === 1 ? "" : "s"}`
                : "No PRs for this period."}
            </p>
          </div>
          {personalRecords.length > 0 && (
            <div className="w-full sm:w-44">
              <Select
                value={activePrFilter}
                options={prFilterOptions}
                onChange={setPrFilter}
                placeholder="All PRs"
                showEmptyOption={false}
              />
            </div>
          )}
        </div>
        {filteredPersonalRecords.length > 0 && (
          <div className="divide-y divide-border">
            {filteredPersonalRecords.map((record) => {
              const pace = record.distance > 0 ? record.elapsedTime / (record.distance / 1000) : null;
              return (
                <Link
                  key={`${record.activityId}-${record.effortName}`}
                  href={`/activity/${record.activityId}`}
                  className="-mx-2 grid grid-cols-[minmax(0,1fr)_auto] gap-3 rounded-lg px-2 py-3 transition-colors hover:bg-white/[0.04] first:pt-2 last:pb-3"
                  aria-label={`View ${record.effortName} PR activity`}
                >
                  <div className="min-w-0">
                    <div className="flex min-w-0 items-center gap-2">
                      <span className="rounded-full border border-amber-400/25 bg-amber-400/10 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-amber-300">
                        PR
                      </span>
                      <span className="truncate text-sm font-semibold">{record.effortName}</span>
                    </div>
                    <div className="mt-1 truncate text-xs text-muted">
                      {record.startTime.split("T")[0]}{record.activityName ? ` · ${record.activityName}` : ""}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-semibold">{formatElapsedTime(record.elapsedTime)}</div>
                    <div className="text-xs text-muted">{pace ? formatPace(pace, units) : "—"}</div>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>

      <div className="mobile-landscape-stack lg:grid lg:grid-cols-2 lg:gap-5 flex flex-col gap-5">
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
                  {...CHART_TOOLTIP_PROPS}
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
                  {...CHART_LINE_TOOLTIP_PROPS}
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
                <Tooltip {...CHART_TOOLTIP_PROPS} formatter={(v) => [v, "Suffer Score"]} />
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
                <Tooltip {...CHART_LINE_TOOLTIP_PROPS} formatter={(v) => [`${v} bpm`, "Avg HR"]} />
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
