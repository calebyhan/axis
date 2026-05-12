export const dynamic = "force-dynamic";
export const metadata = { title: "Activity — Axis", description: "Activity detail" };

import { getActivityWithSets } from "@/lib/queries/activity";
import { getUserUnits } from "@/lib/queries/profile";
import { hasSplits } from "@/lib/splits";
import { MuscleHeatmap } from "@/components/heatmap/MuscleHeatmap";
import { formatDistance, formatPace, distanceUnit } from "@/lib/units";
import { RunStreams } from "@/components/activity/RunStreams";
import { SplitsTable } from "@/components/activity/SplitsTable";
import type { MuscleGroup, MuscleHeatmapDetails, BestEffort, Units } from "@/types";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { DeleteActivityButton } from "@/components/activity/DeleteActivityButton";
import { RouteMapExpandable } from "@/components/activity/RouteMapExpandable";
import { WorkoutSetsEditor } from "@/components/activity/WorkoutSetsEditor";

function formatDuration(secs: number | null): string {
  if (!secs) return "—";
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

const BEST_EFFORT_ORDER = [
  "400m", "1/2 mile", "1k", "1 mile", "2 mile", "5k", "10k",
  "15k", "10 mile", "20k", "Half-Marathon", "Marathon",
];

function formatClockDuration(secs: number): string {
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  const s = secs % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  return `${m}:${String(s).padStart(2, "0")}`;
}

function bestEffortSortIndex(name: string): number {
  const index = BEST_EFFORT_ORDER.indexOf(name);
  return index === -1 ? BEST_EFFORT_ORDER.length : index;
}

function achievementMeta(rank: number | null) {
  if (rank === 1) {
    return {
      label: "Gold",
      detail: "PR",
      dot: "bg-amber-300",
      text: "text-amber-200",
      row: "bg-amber-300/[0.045]",
    };
  }
  if (rank === 2) {
    return {
      label: "Silver",
      detail: "2nd best",
      dot: "bg-zinc-300",
      text: "text-zinc-200",
      row: "",
    };
  }
  if (rank === 3) {
    return {
      label: "Bronze",
      detail: "3rd best",
      dot: "bg-orange-400",
      text: "text-orange-200",
      row: "",
    };
  }
  return null;
}

function RunAchievements({ efforts, units }: { efforts: BestEffort[]; units: Units }) {
  const achievements = efforts
    .filter((effort) => achievementMeta(effort.pr_rank) !== null)
    .sort((a, b) => bestEffortSortIndex(a.name) - bestEffortSortIndex(b.name) || a.name.localeCompare(b.name));

  if (!achievements.length) return null;

  return (
    <div>
      <div className="flex items-center justify-between gap-3 mb-2">
        <div className="text-xs text-muted uppercase tracking-wider">Achievements</div>
        <div className="text-xs text-muted">
          {achievements.length} {achievements.length === 1 ? "medal" : "medals"}
        </div>
      </div>
      <div className="card overflow-hidden">
        <div className="hidden sm:grid grid-cols-[6rem_minmax(0,1fr)_6rem_7rem] px-3 py-2 text-[10px] text-muted uppercase tracking-wider border-b border-border">
          <span>Medal</span>
          <span>Distance</span>
          <span className="text-right">Time</span>
          <span className="text-right">Pace</span>
        </div>
        {achievements.map((effort) => {
          const meta = achievementMeta(effort.pr_rank);
          if (!meta) return null;

          const pace =
            effort.distance > 0 ? formatPace(effort.elapsed_time / (effort.distance / 1000), units) : "—";

          return (
            <div
              key={`${effort.name}-${effort.pr_rank}`}
              className={`grid gap-2 px-3 py-3 border-b border-border/50 last:border-0 sm:grid-cols-[6rem_minmax(0,1fr)_6rem_7rem] sm:items-center sm:gap-3 ${meta.row}`}
            >
              <div className="flex items-center gap-2">
                <span className={`h-2.5 w-2.5 rounded-full ${meta.dot}`} aria-hidden="true" />
                <span className={`text-xs font-medium ${meta.text}`}>{meta.label}</span>
              </div>
              <div className="min-w-0">
                <div className="text-sm font-medium truncate">{effort.name}</div>
                <div className="text-xs text-muted">{meta.detail}</div>
              </div>
              <div className="flex items-baseline justify-between gap-3 sm:block sm:text-right">
                <span className="text-[10px] text-muted uppercase tracking-wider sm:hidden">Time</span>
                <span className="text-sm font-medium">{formatClockDuration(effort.elapsed_time)}</span>
              </div>
              <div className="flex items-baseline justify-between gap-3 sm:block sm:text-right">
                <span className="text-[10px] text-muted uppercase tracking-wider sm:hidden">Pace</span>
                <span className="text-sm text-muted">{pace}</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
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

  // ── Workout: muscle coverage + exercise groups ──────────────────────────
  type ExerciseJoin = { name: string; primary_muscles: MuscleGroup[]; secondary_muscles?: MuscleGroup[] };
  type SetRow = { id: string; exercise_id: string; set_number: number; reps: number; weight: number; rpe: number; exercise?: unknown };
  function normalizeExercise(raw: unknown): ExerciseJoin | null {
    if (!raw) return null;
    return (Array.isArray(raw) ? raw[0] : raw) as ExerciseJoin ?? null;
  }
  function setLabel(count: number): string {
    return `${count} set${count === 1 ? "" : "s"}`;
  }

  const coverage: Partial<Record<MuscleGroup, number>> = {};
  const detailBuckets: Partial<Record<MuscleGroup, Map<string, { label: string; count: number }>>> = {};
  const workoutSets = sets as SetRow[];

  for (const s of workoutSets) {
    const ex = normalizeExercise(s.exercise);
    if (!ex) continue;

    for (const m of ex.primary_muscles) {
      coverage[m] = (coverage[m] ?? 0) + 1;

      const bucket = detailBuckets[m] ?? new Map<string, { label: string; count: number }>();
      const item = bucket.get(s.exercise_id) ?? { label: ex.name, count: 0 };
      item.count += 1;
      bucket.set(s.exercise_id, item);
      detailBuckets[m] = bucket;
    }
  }

  const muscleDetails = Object.fromEntries(
    Object.entries(detailBuckets).map(([muscle, bucket]) => [
      muscle,
      {
        items: Array.from(bucket.values())
          .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label))
          .map((item) => `${item.label} (${setLabel(item.count)})`),
      },
    ])
  ) as MuscleHeatmapDetails;

  const exerciseGroups = new Map<string, { name: string; sets: SetRow[] }>();
  for (const s of workoutSets) {
    const exId = s.exercise_id;
    const exName = normalizeExercise(s.exercise)?.name ?? "Unknown";
    if (!exerciseGroups.has(exId)) exerciseGroups.set(exId, { name: exName, sets: [] });
    exerciseGroups.get(exId)!.sets.push(s);
  }

  const editableWorkoutSets = workoutSets.map((set, idx) => {
    const exercise = normalizeExercise(set.exercise);
    return {
      row_id: set.id ?? `${set.exercise_id}-${set.set_number}-${idx}`,
      exercise_id: set.exercise_id,
      exercise_name: exercise?.name ?? "Unknown",
      primary_muscles: exercise?.primary_muscles ?? [],
      secondary_muscles: exercise?.secondary_muscles ?? [],
      set_number: set.set_number,
      reps: set.reps,
      weight: set.weight,
      rpe: set.rpe,
    };
  });

  // ── Run: derived stats ──────────────────────────────────────────────────
  const distanceKm = activity.distance ? activity.distance / 1000 : null;
  const stoppedTime =
    activity.elapsed_time && activity.duration
      ? activity.elapsed_time - activity.duration
      : null;
  const bestEfforts = Array.isArray(activity.best_efforts) ? (activity.best_efforts as BestEffort[]) : [];
  const medalCount =
    bestEfforts.filter((effort) => achievementMeta(effort.pr_rank) !== null).length;

  return (
    <div className="page-shell flex flex-col gap-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link
          href="/activity"
          aria-label="Back to activity"
          className="shrink-0 w-9 h-9 flex items-center justify-center rounded-full border border-white/10 text-white/55 hover:text-white hover:border-white/20 transition-colors"
        >
          <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-4 h-4">
            <path d="M15 18l-6-6 6-6" />
          </svg>
        </Link>
        <h1 className="flex-1 text-lg font-semibold truncate">
          {activity.name ?? (isWorkout ? "Workout" : isRun ? "Run" : "Activity")}
        </h1>
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

      {/* ── RUN DETAIL ─────────────────────────────────────────────────── */}
      {isRun && (
        <>
          {/* Route map */}
          {activity.summary_polyline && (
            <div className="card overflow-hidden rounded-2xl" style={{ height: "14rem" }}>
              <RouteMapExpandable polyline={activity.summary_polyline} />
            </div>
          )}

          {/* Summary stats grid */}
          <div className="grid grid-cols-2 gap-2 min-[380px]:grid-cols-3 sm:grid-cols-4">
            <StatCard label="Distance" value={distanceKm ? formatDistance(distanceKm, units) : "—"} unit={distanceUnit(units)} />
            <StatCard label="Duration" value={formatDuration(activity.duration)} />
            <StatCard label="Avg Pace" value={formatPace(activity.avg_pace, units)} />
            <StatCard label="Avg HR" value={activity.avg_heartrate ? `${Math.round(activity.avg_heartrate)}` : "—"} unit={activity.avg_heartrate ? "bpm" : undefined} />
            {activity.max_heartrate != null && (
              <StatCard label="Max HR" value={`${Math.round(activity.max_heartrate)}`} unit="bpm" />
            )}
            {activity.elevation_gain != null && (
              <StatCard label="Elevation" value={`+${Math.round(activity.elevation_gain)}`} unit="m" />
            )}
            {activity.calories != null && (
              <StatCard label="Calories" value={`${activity.calories}`} unit="kcal" />
            )}
            {activity.avg_cadence != null && (
              <StatCard label="Cadence" value={`${Math.round(activity.avg_cadence * 2)}`} unit="spm" />
            )}
            {activity.avg_watts != null && (
              <StatCard label="Power" value={`${Math.round(activity.avg_watts)}`} unit="W" />
            )}
            {activity.suffer_score != null && (
              <StatCard label="Suffer" value={`${activity.suffer_score}`} />
            )}
            {medalCount > 0 && (
              <StatCard label="Medals" value={`${medalCount}`} />
            )}
            {stoppedTime != null && stoppedTime > 30 && (
              <StatCard label="Stopped" value={formatDuration(stoppedTime)} />
            )}
            {activity.average_temp != null && (
              <StatCard label="Temp" value={`${Math.round(activity.average_temp)}°C`} />
            )}
          </div>

          {/* Splits */}
          {hasSplits(activity.splits) && (
            <SplitsTable splits={activity.splits} units={units} />
          )}

          {/* Time-series charts — only for Strava runs */}
          {activity.strava_activity_id && (
            <div>
              <div className="text-xs text-muted uppercase tracking-wider mb-3">Charts</div>
              <div className="card p-4">
                <Suspense fallback={<div className="text-sm text-muted py-4 text-center">Loading charts...</div>}>
                  <RunStreams stravaActivityId={activity.strava_activity_id} units={units} />
                </Suspense>
              </div>
            </div>
          )}

          {/* Best efforts / PRs */}
          {bestEfforts.length > 0 && (
            <RunAchievements efforts={bestEfforts} units={units} />
          )}

          {/* Notes */}
          {activity.notes && (
            <div className="card p-4">
              <p className="text-sm text-muted">{activity.notes}</p>
            </div>
          )}
        </>
      )}

      {/* ── WORKOUT DETAIL ─────────────────────────────────────────────── */}
      {isWorkout && (
        <>
          <div className="grid grid-cols-2 gap-2 min-[380px]:grid-cols-3 sm:grid-cols-4">
            <StatCard label="Duration" value={formatDuration(activity.duration)} />
            <StatCard label="Exercises" value={`${exerciseGroups.size}`} />
            <StatCard label="Sets" value={`${sets.length}`} />
            {activity.avg_heartrate != null && (
              <StatCard label="Avg HR" value={`${Math.round(activity.avg_heartrate)}`} unit="bpm" />
            )}
            {activity.max_heartrate != null && (
              <StatCard label="Max HR" value={`${Math.round(activity.max_heartrate)}`} unit="bpm" />
            )}
            {activity.calories != null && (
              <StatCard label="Calories" value={`${activity.calories}`} unit="kcal" />
            )}
            {activity.suffer_score != null && (
              <StatCard label="Suffer" value={`${activity.suffer_score}`} />
            )}
          </div>

          <div>
            <h2 className="text-sm font-medium text-muted mb-3 uppercase tracking-wide">Muscle Coverage</h2>
            <div className="flex flex-wrap justify-center gap-4 sm:gap-6">
              <MuscleHeatmap coverage={coverage} details={muscleDetails} tooltipContext="in this workout" size="full" />
              <MuscleHeatmap coverage={coverage} details={muscleDetails} tooltipContext="in this workout" size="full" showBack />
            </div>
          </div>

          <WorkoutSetsEditor activityId={activity.id} initialSets={editableWorkoutSets} units={units} />

          {activity.strava_activity_id && (
            <div>
              <div className="text-xs text-muted uppercase tracking-wider mb-3">Heart Rate</div>
              <div className="card p-4">
                <RunStreams stravaActivityId={activity.strava_activity_id} units={units} />
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function StatCard({
  label,
  value,
  unit,
}: {
  label: string;
  value: string;
  unit?: string;
}) {
  return (
    <div className="card p-3 text-center min-w-0">
      <div className="text-base font-semibold tracking-tight sm:text-lg">
        {value}
        {unit && <span className="text-xs font-normal text-muted ml-1">{unit}</span>}
      </div>
      <div className="text-xs text-muted mt-0.5">{label}</div>
    </div>
  );
}
