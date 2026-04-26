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

interface WorkoutSummary {
  sessionCount: number;
  totalSets: number;
  totalVolume: number;
  topExercises: { name: string; volume: number; sets: number }[];
}

interface Props {
  workoutSummary: WorkoutSummary;
  volumeChartData: { week: string; volume: number }[];
  units: Units;
}

export default function WorkoutTab({ workoutSummary, volumeChartData, units }: Props) {
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

      {workoutSummary.topExercises.length > 0 && (
        <div className="card p-4">
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
