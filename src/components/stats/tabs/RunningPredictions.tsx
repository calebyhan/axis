"use client";

import { useMemo } from "react";
import {
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  Scatter,
  Cell,
  ComposedChart,
} from "recharts";
import { CHART_LINE_TOOLTIP_PROPS } from "@/components/stats/chartTheme";
import { classifyEffort } from "@/lib/effort-classification";
import { estimateVDOT, estimateVO2maxFromHR, computeVDOTTrend, type VDOTEffort, type VDOTTrend, type VO2maxEstimate } from "@/lib/vdot";
import { formatPace } from "@/lib/units";
import type { PredictionData } from "@/components/stats/StatsClient";
import type { Units } from "@/types";

const DIRECTION_LABELS: Record<VDOTTrend["direction"], { label: string; color: string; arrow: string }> = {
  improving: { label: "Improving", color: "text-green-400", arrow: "↑" },
  maintaining: { label: "Maintaining", color: "text-blue-400", arrow: "→" },
  declining: { label: "Declining", color: "text-orange-400", arrow: "↓" },
  insufficient: { label: "Insufficient data", color: "text-muted", arrow: "" },
};

const CONFIDENCE_LABELS: Record<string, string> = {
  high: "High",
  medium: "Medium",
  low: "Low",
};

const TIER_COLORS: Record<string, string> = {
  race: "#F59E0B",
  hard: "#3B82F6",
  moderate: "#6B7280",
  easy: "#4B5563",
};

function formatTime(totalSeconds: number): string {
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = Math.round(totalSeconds % 60);
  if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  return `${m}:${String(s).padStart(2, "0")}`;
}

interface Props {
  predictionData: PredictionData;
  units: Units;
}

export default function RunningPredictions({ predictionData, units }: Props) {
  const trend = useMemo(() => {
    const { activities, hrZones, paceZones, maxHeartRate } = predictionData;

    const efforts: VDOTEffort[] = [];
    const vo2maxEstimates: VO2maxEstimate[] = [];
    const prFloors = new Map<string, number>();

    const EFFORT_TO_RACE: Record<string, string> = {
      "1 mile": "1 Mile",
      "5k": "5K",
      "10k": "10K",
      "Half-Marathon": "Half",
    };

    for (const activity of activities) {
      const classification = classifyEffort(activity, hrZones, paceZones);

      for (const effort of activity.best_efforts ?? []) {
        if (effort.pr_rank !== 1) continue;
        const raceLabel = EFFORT_TO_RACE[effort.name];
        if (!raceLabel) continue;
        const existing = prFloors.get(raceLabel);
        if (!existing || effort.elapsed_time < existing) {
          prFloors.set(raceLabel, effort.elapsed_time);
        }
      }

      let bestVdot: number | null = null;
      let bestLabel = "";

      for (const effort of activity.best_efforts ?? []) {
        if (effort.distance < 1500 || effort.elapsed_time < 300) continue;
        const v = estimateVDOT(effort.distance, effort.elapsed_time);
        if (v && (!bestVdot || v > bestVdot)) {
          bestVdot = v;
          bestLabel = `${effort.name} ${formatTime(effort.elapsed_time)}`;
        }
      }

      if (!bestVdot && activity.distance && activity.duration) {
        bestVdot = estimateVDOT(activity.distance, activity.duration);
        if (bestVdot) {
          bestLabel = activity.name ?? "Run";
        }
      }

      if (bestVdot) {
        efforts.push({
          vdot: bestVdot,
          weight: classification.vdotWeight,
          date: activity.start_time,
          activityId: activity.id,
          distanceMeters: activity.distance ?? 0,
          tier: classification.tier,
          effortLabel: bestLabel,
        });
      }

      if (activity.avg_heartrate && activity.distance && activity.duration) {
        const vo2max = estimateVO2maxFromHR(
          activity.avg_heartrate,
          maxHeartRate,
          activity.distance,
          activity.duration
        );
        if (vo2max) {
          vo2maxEstimates.push({
            vo2max,
            date: activity.start_time,
            activityId: activity.id,
            weight: classification.vdotWeight,
          });
        }
      }
    }

    return computeVDOTTrend(efforts, prFloors, vo2maxEstimates);
  }, [predictionData]);

  if (!trend.current) {
    return (
      <div className="card p-4">
        <h3 className="text-sm font-medium">Race Predictions</h3>
        <p className="mt-2 text-sm text-muted">
          Log a tempo run, race, or hard effort to unlock race predictions.
        </p>
      </div>
    );
  }

  const dir = DIRECTION_LABELS[trend.direction];

  const chartData = trend.points.map((p, i) => ({
    date: new Date(p.date).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
    rawDate: p.date,
    vdot: p.vdot,
    smoothed: trend.smoothed[i]?.vdot ?? p.vdot,
    tier: p.tier,
    label: p.effortLabel,
    fill: TIER_COLORS[p.tier] ?? "#6B7280",
  }));

  return (
    <div className="flex flex-col gap-4">
      {/* VDOT & VO2max Header */}
      <div className="card p-4">
        <div className="flex items-baseline gap-3 flex-wrap">
          <div>
            <span className="text-xs text-muted uppercase tracking-wider">VDOT</span>
            <span className="ml-2 text-2xl font-bold">{trend.current}</span>
          </div>
          {trend.vo2max && (
            <div className="border-l border-white/10 pl-3">
              <span className="text-xs text-muted uppercase tracking-wider">Est. VO₂max</span>
              <span className="ml-2 text-2xl font-bold">{trend.vo2max}</span>
              <span className="ml-1 text-xs text-muted">ml/kg/min</span>
            </div>
          )}
          {trend.direction !== "insufficient" && (
            <span className={`text-sm font-medium ${dir.color}`}>
              {dir.arrow} {dir.label}
            </span>
          )}
        </div>
        <p className="mt-1 text-xs text-muted">
          Based on {trend.qualityEffortCount} quality effort{trend.qualityEffortCount === 1 ? "" : "s"} (last 365 days)
          {" · "}Confidence: {CONFIDENCE_LABELS[trend.confidence]}
          {trend.vo2max && ` · VO₂max from ${trend.vo2maxCount} run${trend.vo2maxCount === 1 ? "" : "s"} with HR`}
          {" · "}Max HR: {predictionData.maxHeartRate} bpm
          <span className="text-muted/60">
            {" "}(profile {predictionData.maxHeartRateSources.profile}
            {predictionData.maxHeartRateSources.observed > 0 && `, observed ${predictionData.maxHeartRateSources.observed}`})
          </span>
        </p>
      </div>

      {/* Race Time Predictions */}
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
        {trend.predictions.map((pred) => (
          <div key={pred.label} className="card p-3 flex flex-col gap-1 min-w-0">
            <span className="text-xs text-muted">{pred.label}</span>
            <span className="text-sm font-semibold">{formatTime(pred.predictedSeconds)}</span>
            <span className="text-[10px] text-muted">{formatPace(pred.paceSecondsPerKm, units)}</span>
            {pred.confidence === "low" && (
              <span className="text-[9px] text-orange-400/70">est.</span>
            )}
          </div>
        ))}
      </div>

      {/* VDOT Trend Chart */}
      {chartData.length >= 2 && (
        <div className="card p-4">
          <h3 className="text-sm font-medium mb-4">VDOT Trend</h3>
          <div className="mb-2 flex gap-3 text-[10px] text-muted">
            <span className="flex items-center gap-1">
              <span className="inline-block h-2 w-2 rounded-full" style={{ background: TIER_COLORS.race }} /> Race/PR
            </span>
            <span className="flex items-center gap-1">
              <span className="inline-block h-2 w-2 rounded-full" style={{ background: TIER_COLORS.hard }} /> Hard
            </span>
            <span className="flex items-center gap-1">
              <span className="inline-block h-2 w-2 rounded-full" style={{ background: TIER_COLORS.moderate }} /> Moderate
            </span>
          </div>
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1F1F1F" />
                <XAxis dataKey="date" tick={{ fill: "#666", fontSize: 10 }} tickLine={false} />
                <YAxis
                  tick={{ fill: "#666", fontSize: 10 }}
                  tickLine={false}
                  axisLine={false}
                  domain={["auto", "auto"]}
                />
                <Tooltip
                  {...CHART_LINE_TOOLTIP_PROPS}
                  formatter={(value: number, name: string) => {
                    if (name === "smoothed") return [value.toFixed(1), "Trend"];
                    return [value.toFixed(1), "VDOT"];
                  }}
                  labelFormatter={(label, payload) => {
                    const item = payload?.[0]?.payload;
                    return item?.label ? `${label} · ${item.label}` : label;
                  }}
                />
                <Line
                  type="monotone"
                  dataKey="smoothed"
                  stroke="rgba(255, 255, 255, 0.25)"
                  strokeWidth={2}
                  dot={false}
                  strokeDasharray="6 3"
                />
                <Scatter dataKey="vdot" fill="#3B82F6">
                  {chartData.map((entry, index) => (
                    <Cell key={index} fill={entry.fill} />
                  ))}
                </Scatter>
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
    </div>
  );
}
