export const dynamic = "force-dynamic";

import { getActivityWithSets } from "@/lib/queries/activity";
import { getUserUnits } from "@/lib/queries/profile";
import { computeE1RM } from "@/lib/e1rm";
import { MuscleHeatmap } from "@/components/heatmap/MuscleHeatmap";
import { formatWeight, formatDistance, weightUnit, distanceUnit } from "@/lib/units";
import type { MuscleGroup } from "@/types";
import Link from "next/link";
import { notFound } from "next/navigation";
import { DeleteActivityButton } from "@/components/activity/DeleteActivityButton";

function formatDuration(secs: number | null): string {
  if (!secs) return "—";
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

export default async function ActivityDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [{ activity, sets }, units] = await Promise.all([
    getActivityWithSets(id),
    getUserUnits(),
  ]);

  if (!activity) notFound();

  const isRun = activity.type === "run" || activity.type === "manual_run";
  const isWorkout = activity.type === "workout";

  // Build muscle coverage from sets
  type ExerciseJoin = { name: string; primary_muscles: MuscleGroup[] };
  function normalizeExercise(raw: unknown): ExerciseJoin | null {
    if (!raw) return null;
    return (Array.isArray(raw) ? raw[0] : raw) as ExerciseJoin ?? null;
  }

  const coverage: Partial<Record<MuscleGroup, number>> = {};
  for (const s of sets) {
    const ex = normalizeExercise(s.exercise);
    if (!ex) continue;
    for (const m of ex.primary_muscles) {
      coverage[m] = (coverage[m] ?? 0) + 1;
    }
  }

  // Group sets by exercise
  type SetRow = { exercise_id: string; set_number: number; reps: number; weight: number; rpe: number; exercise?: unknown };
  const exerciseGroups = new Map<string, { name: string; sets: SetRow[] }>();
  for (const s of sets as SetRow[]) {
    const exId = s.exercise_id;
    const exName = normalizeExercise(s.exercise)?.name ?? "Unknown";
    if (!exerciseGroups.has(exId)) {
      exerciseGroups.set(exId, { name: exName, sets: [] });
    }
    exerciseGroups.get(exId)!.sets.push(s);
  }

  return (
    <div className="px-4 py-6 max-w-2xl mx-auto flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/activity" className="text-muted hover:text-white transition-colors">
            ← Back
          </Link>
          <h1 className="text-xl font-semibold">
            {isWorkout ? "Workout" : isRun ? "Run" : "Activity"}
          </h1>
        </div>
        <DeleteActivityButton activityId={activity.id} />
      </div>

      <div className="text-sm text-muted">
        {new Date(activity.start_time).toLocaleDateString("en-US", {
          weekday: "long",
          year: "numeric",
          month: "long",
          day: "numeric",
        })}
      </div>

      {/* Summary stats */}
      <div className="grid grid-cols-3 gap-2">
        <div className="card p-3 text-center">
          <div className="text-lg font-semibold">{formatDuration(activity.duration)}</div>
          <div className="text-xs text-muted mt-0.5">Duration</div>
        </div>
        {isRun && (
          <>
            <div className="card p-3 text-center">
              <div className="text-lg font-semibold">
                {activity.distance ? formatDistance(activity.distance / 1000, units) : "—"}
              </div>
              <div className="text-xs text-muted mt-0.5">{distanceUnit(units)}</div>
            </div>
            <div className="card p-3 text-center">
              <div className="text-lg font-semibold">
                {activity.avg_heartrate ? `${Math.round(activity.avg_heartrate)}` : "—"}
              </div>
              <div className="text-xs text-muted mt-0.5">Avg HR</div>
            </div>
          </>
        )}
        {isWorkout && (
          <>
            <div className="card p-3 text-center">
              <div className="text-lg font-semibold">{exerciseGroups.size}</div>
              <div className="text-xs text-muted mt-0.5">Exercises</div>
            </div>
            <div className="card p-3 text-center">
              <div className="text-lg font-semibold">{sets.length}</div>
              <div className="text-xs text-muted mt-0.5">Sets</div>
            </div>
          </>
        )}
      </div>

      {/* Workout detail */}
      {isWorkout && (
        <>
          <div>
            <h2 className="text-sm font-medium text-muted mb-3 uppercase tracking-wide">Muscle Coverage</h2>
            <div className="flex gap-6">
              <MuscleHeatmap coverage={coverage} size="full" />
              <MuscleHeatmap coverage={coverage} size="full" showBack />
            </div>
          </div>

          <div>
            <h2 className="text-sm font-medium text-muted mb-3 uppercase tracking-wide">Exercises</h2>
            <div className="flex flex-col gap-4">
              {Array.from(exerciseGroups.entries()).map(([exId, { name, sets: exSets }]) => {
                const bestE1RM = Math.max(
                  ...exSets.map((s: SetRow) => computeE1RM(s.weight, s.reps))
                );
                return (
                  <div key={exId} className="card p-4">
                    <div className="flex items-center justify-between mb-3">
                      <span className="font-medium">{name}</span>
                      {bestE1RM > 0 && (
                        <span className="text-xs text-muted">
                          Best e1RM: {formatWeight(bestE1RM, units)} {weightUnit(units)}
                        </span>
                      )}
                    </div>
                    <div className="flex flex-col gap-1.5">
                      {exSets.map((s: SetRow, i: number) => (
                        <div key={i} className="flex justify-between text-sm">
                          <span className="text-muted">Set {s.set_number}</span>
                          <span>
                            {formatWeight(s.weight, units)} {weightUnit(units)} × {s.reps}
                          </span>
                          <span className="text-muted">
                            RPE {s.rpe} · {formatWeight(computeE1RM(s.weight, s.reps), units)} e1RM
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </>
      )}

      {/* Run detail */}
      {isRun && activity.notes && (
        <div className="card p-4">
          <p className="text-sm text-muted">{activity.notes}</p>
        </div>
      )}
    </div>
  );
}
