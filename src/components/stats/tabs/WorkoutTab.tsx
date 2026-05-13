"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";
import { CHART_TOOLTIP_PROPS } from "@/components/stats/chartTheme";
import { MuscleHeatmap } from "@/components/heatmap/MuscleHeatmap";
import { BalanceScoreCard } from "@/components/strength/BalanceScoreCard";
import type { StrengthBalanceSummary } from "@/lib/strength-balance";
import { weightUnit, formatWeight } from "@/lib/units";
import type { TimeRange } from "@/lib/queries/stats";
import type { MuscleGroup, MuscleHeatmapDetails, Units } from "@/types";

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="card p-3 flex flex-col gap-1 flex-1">
      <span className="text-xs text-muted">{label}</span>
      <span className="text-base font-semibold leading-tight">{value}</span>
    </div>
  );
}

interface WorkoutSummary {
  sessionCount: number;
  totalSets: number;
  totalVolume: number;
  topExercises: { name: string; volume: number; sets: number }[];
  muscleCoverage: Partial<Record<MuscleGroup, number>>;
  muscleDetails: MuscleHeatmapDetails;
  strengthBalance: StrengthBalanceSummary;
}

interface Props {
  workoutSummary: WorkoutSummary;
  volumeChartData: { week: string; volume: number }[];
  timeRange: TimeRange;
  units: Units;
}

const RANGE_CONTEXT: Record<TimeRange, string> = {
  week: "this week",
  month: "this month",
  year: "this year",
  all: "all time",
};

export default function WorkoutTab({ workoutSummary, volumeChartData, timeRange, units }: Props) {
  const activeMuscleCount = Object.values(workoutSummary.muscleCoverage).filter((count) => (count ?? 0) > 0).length;
  const hasMuscleCoverage = activeMuscleCount > 0;

  return (
    <div className="flex flex-col gap-5">
      <div className="flex gap-2">
        <StatCard label="Sessions" value={String(workoutSummary.sessionCount)} />
        <StatCard
          label={`Volume (${weightUnit(units)})`}
          value={workoutSummary.totalVolume === 0 ? "—" : formatWeight(workoutSummary.totalVolume, units)}
        />
        <StatCard label="Total Sets" value={String(workoutSummary.totalSets)} />
      </div>

      <div className="md:grid md:grid-cols-2 md:gap-5 flex flex-col gap-5">
        <div className="card p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h3 className="text-sm font-medium">Muscle Coverage</h3>
              <p className="mt-1 text-xs text-muted">
                {hasMuscleCoverage ? `${activeMuscleCount} groups trained` : "No strength sets for this period."}
              </p>
            </div>
            {workoutSummary.totalSets > 0 && (
              <span className="rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1 text-xs text-accent">
                {workoutSummary.totalSets} sets
              </span>
            )}
          </div>
          <div className="mt-4 flex items-center justify-center gap-6">
            <MuscleHeatmap
              coverage={workoutSummary.muscleCoverage}
              details={workoutSummary.muscleDetails}
              tooltipContext={RANGE_CONTEXT[timeRange]}
              size="full"
            />
            <MuscleHeatmap
              coverage={workoutSummary.muscleCoverage}
              details={workoutSummary.muscleDetails}
              tooltipContext={RANGE_CONTEXT[timeRange]}
              size="full"
              showBack
            />
          </div>
        </div>

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
                    {...CHART_TOOLTIP_PROPS}
                    formatter={(v) => [`${v} ${weightUnit(units)}`, "Volume"]}
                  />
                  <Bar dataKey="volume" fill="var(--accent, #3B82F6)" radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        <BalanceScoreCard
          balance={workoutSummary.strengthBalance}
          contextLabel={RANGE_CONTEXT[timeRange]}
          compact
          showInactiveAxes={workoutSummary.totalSets > 0}
        />

        {workoutSummary.topExercises.length > 0 && (
          <div className="card p-4 md:col-span-2">
            <h3 className="text-sm font-medium mb-3">Top Exercises by Volume</h3>
            <div className="flex flex-col gap-3">
              {(() => {
                const maxVol = workoutSummary.topExercises[0].volume;
                return workoutSummary.topExercises.map((ex) => {
                  const displayVol = units === "imperial" ? Math.round(ex.volume * 2.20462) : ex.volume;
                  const maxDisplay = units === "imperial" ? Math.round(maxVol * 2.20462) : maxVol;
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
                          style={{ width: `${(displayVol / maxDisplay) * 100}%` }}
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
    </div>
  );
}
