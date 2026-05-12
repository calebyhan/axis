import { MuscleHeatmap } from "@/components/heatmap/MuscleHeatmap";
import type { MuscleGroup, MuscleHeatmapDetails } from "@/types";

interface Props {
  coverage: Partial<Record<MuscleGroup, number>>;
  details?: MuscleHeatmapDetails;
  totalSets?: number;
}

const MUSCLE_LABELS: Record<MuscleGroup, string> = {
  chest: "Chest",
  front_delt: "Front delts",
  rear_delt: "Rear delts",
  triceps: "Triceps",
  biceps: "Biceps",
  forearm: "Forearms",
  upper_back: "Upper back",
  lats: "Lats",
  traps: "Traps",
  lower_back: "Lower back",
  glutes: "Glutes",
  quads: "Quads",
  hamstrings: "Hamstrings",
  calves: "Calves",
  hip_flexors: "Hip flexors",
  adductors: "Adductors",
  abs: "Abs",
  obliques: "Obliques",
};

export function WeeklyMuscleCoverage({ coverage, details, totalSets }: Props) {
  const activeMuscles = Object.entries(coverage)
    .filter((entry): entry is [MuscleGroup, number] => entry[1] > 0)
    .sort((a, b) => b[1] - a[1]);

  const actualSetCount = totalSets ?? activeMuscles.reduce((sum, [, count]) => sum + count, 0);

  return (
    <div className="card p-5 sm:p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="text-[11px] uppercase tracking-[0.24em] text-white/45">Muscle Map</div>
          <div className="mt-2 text-sm text-white/60">
            {actualSetCount > 0 ? `${activeMuscles.length} groups hit this week` : "No strength sets logged yet"}
          </div>
        </div>
        {actualSetCount > 0 && (
          <div className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-xs font-medium text-accent">
            {actualSetCount} set{actualSetCount === 1 ? "" : "s"}
          </div>
        )}
      </div>

      <div className="mt-5 flex items-center justify-center gap-6">
        <MuscleHeatmap coverage={coverage} details={details} tooltipContext="this week" size="full" />
        <MuscleHeatmap coverage={coverage} details={details} tooltipContext="this week" size="full" showBack />
      </div>

      {activeMuscles.length > 0 && (
        <div className="mt-5 flex flex-wrap gap-2">
          {activeMuscles.slice(0, 8).map(([muscle, count]) => (
            <span
              key={muscle}
              className="rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1 text-xs text-white/70"
            >
              {MUSCLE_LABELS[muscle]} {count}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
