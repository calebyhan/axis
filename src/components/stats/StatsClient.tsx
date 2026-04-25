"use client";

import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import { classifyTrend } from "@/lib/body-weight-trend";
import { formatDistance, formatPace } from "@/lib/units";
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

const TabLoading = () => <div className="py-8 text-center text-muted text-sm">Loading…</div>;

const WorkoutTab = dynamic(() => import("./tabs/WorkoutTab"), { ssr: false, loading: TabLoading });
const RunningTab = dynamic(() => import("./tabs/RunningTab"), { ssr: false, loading: TabLoading });
const BodyTab = dynamic(() => import("./tabs/BodyTab"), { ssr: false, loading: TabLoading });
const LoadTab = dynamic(() => import("./tabs/LoadTab"), { ssr: false, loading: TabLoading });

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

function tsbStatus(tsb: number): { label: string; color: string } {
  if (tsb > 5) return { label: "Fresh", color: "text-green-400" };
  if (tsb > -10) return { label: "Neutral", color: "text-blue-400" };
  if (tsb > -30) return { label: "Fatigued", color: "text-orange-400" };
  return { label: "Overreaching", color: "text-red-400" };
}

function computeRolling(data: { date: string; body_weight: number }[], window = 7) {
  return data.map((d, i) => {
    const start = Math.max(0, i - window + 1);
    const slice = data.slice(start, i + 1);
    const avg = slice.reduce((s, x) => s + x.body_weight, 0) / slice.length;
    return { ...d, rolling: Math.round(avg * 10) / 10 };
  });
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

  // ── Workout ───────────────────────────────────────────────────────────────
  const volumeChartData = initialVolumeData.map((d) => ({
    ...d,
    volume: units === "imperial" ? Math.round(d.volume * 2.20462) : d.volume,
  }));

  // ── Running ───────────────────────────────────────────────────────────────
  const totalDistanceKm = initialRunningData.reduce((s, r) => s + (r.distance ?? 0), 0) / 1000;
  const runCount = initialRunningData.length;
  const pacesWithData = initialRunningData.filter((r) => r.avg_pace);
  const bestPace = pacesWithData.length > 0 ? Math.min(...pacesWithData.map((r) => r.avg_pace!)) : null;
  const hrsWithData = initialRunningData.filter((r) => r.avg_heartrate);
  const avgHR =
    hrsWithData.length > 0
      ? Math.round(hrsWithData.reduce((s, r) => s + r.avg_heartrate!, 0) / hrsWithData.length)
      : null;
  const runChartData = initialRunningData.map((r) => ({
    date: r.start_time.split("T")[0],
    dist: parseFloat(formatDistance(r.distance ? r.distance / 1000 : 0, units)),
  }));
  const sufferChartData = initialRunningData
    .filter((r) => r.suffer_score != null)
    .map((r) => ({ date: r.start_time.split("T")[0], suffer: r.suffer_score }));
  const hrChartData = initialRunningData
    .filter((r) => r.avg_heartrate != null)
    .map((r) => ({ date: r.start_time.split("T")[0], hr: r.avg_heartrate ?? null }));

  // ── Body ──────────────────────────────────────────────────────────────────
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
  const currentWeight = initialBodyData.length > 0 ? initialBodyData[initialBodyData.length - 1].body_weight : null;
  const firstWeight = initialBodyData.length > 0 ? initialBodyData[0].body_weight : null;
  const weightDelta = currentWeight !== null && firstWeight !== null ? currentWeight - firstWeight : null;
  const minWeight = initialBodyData.length > 0 ? Math.min(...initialBodyData.map((d) => d.body_weight)) : null;
  const maxWeight = initialBodyData.length > 0 ? Math.max(...initialBodyData.map((d) => d.body_weight)) : null;

  // ── Load ──────────────────────────────────────────────────────────────────
  const latestLoad = trainingLoad.length > 0 ? trainingLoad[trainingLoad.length - 1] : null;
  const tsbInfo = latestLoad ? tsbStatus(latestLoad.tsb) : null;

  return (
    <div className="flex flex-col gap-5">
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

      <div className="flex gap-4 border-b border-border">
        {TABS.map((t) => (
          <button
            key={t.value}
            onClick={() => setActiveTab(t.value)}
            className={`pb-2 text-sm font-medium border-b-2 transition-colors -mb-px ${
              activeTab === t.value ? "border-accent text-white" : "border-transparent text-muted"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {activeTab === "workout" && (
        <WorkoutTab workoutSummary={workoutSummary} volumeChartData={volumeChartData} units={units} />
      )}
      {activeTab === "running" && (
        <RunningTab
          runChartData={runChartData}
          pacesWithData={pacesWithData}
          sufferChartData={sufferChartData}
          hrChartData={hrChartData}
          totalDistanceKm={totalDistanceKm}
          runCount={runCount}
          bestPace={bestPace}
          avgHR={avgHR}
          units={units}
        />
      )}
      {activeTab === "body" && (
        <BodyTab
          bodyChartData={bodyChartData}
          convertedBodyData={convertedBodyData}
          initialBodyData={initialBodyData}
          trendBadge={trendBadge}
          currentWeight={currentWeight}
          weightDelta={weightDelta}
          minWeight={minWeight}
          maxWeight={maxWeight}
          units={units}
        />
      )}
      {activeTab === "load" && (
        <LoadTab trainingLoad={trainingLoad} latestLoad={latestLoad} tsbInfo={tsbInfo} />
      )}
    </div>
  );
}
