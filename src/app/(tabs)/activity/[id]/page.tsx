export const dynamic = "force-dynamic";
export const metadata = { title: "Activity — Axis", description: "Activity detail" };

import { getActivityWithSets, getPreviousWorkoutByType } from "@/lib/queries/activity";
import { getUserTimeZone, getUserUnits } from "@/lib/queries/profile";
import { addMuscleTagSets, muscleTagSummaries } from "@/lib/muscle-tags";
import { hasSplits, resolveSplitsForUnits } from "@/lib/splits";
import { computeRunTrainingLoad } from "@/lib/training-load";
import { formatZonedDate } from "@/lib/time-zone";
import { MuscleHeatmap } from "@/components/heatmap/MuscleHeatmap";
import { formatDistance, formatPace, distanceUnit, formatWeight, weightUnit } from "@/lib/units";
import { RunStreams } from "@/components/activity/RunStreams";
import { SplitsTable } from "@/components/activity/SplitsTable";
import type { MuscleGroup, MuscleHeatmapDetails, BestEffort, Units, MuscleTag } from "@/types";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { DeleteActivityButton } from "@/components/activity/DeleteActivityButton";
import { RefreshStravaButton } from "@/components/activity/RefreshStravaButton";
import { RouteMapExpandable } from "@/components/activity/RouteMapExpandable";
import { WorkoutSetsEditor } from "@/components/activity/WorkoutSetsEditor";
import { LapsTable } from "@/components/activity/LapsTable";

function formatDuration(secs: number | null): string {
  if (!secs) return "—";
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

function formatLoad(load: number): string {
  return Number.isInteger(load) ? String(load) : load.toFixed(1);
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
                <span className={`size-2.5 rounded-full ${meta.dot}`} aria-hidden="true" />
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
  const [{ activity, sets }, units, timeZone] = await Promise.all([
    getActivityWithSets(id),
    getUserUnits(),
    getUserTimeZone(),
  ]);

  if (!activity) notFound();

  const isRun = activity.type === "run" || activity.type === "manual_run";
  const isWorkout = activity.type === "workout";

  // ── Previous same-name workout for comparison ───────────────────────────
  const prevWorkoutOpts = isWorkout
    ? activity.day_type_id
      ? { dayTypeId: activity.day_type_id }
      : activity.name
      ? { name: activity.name }
      : null
    : null;
  const prevWorkout = prevWorkoutOpts
    ? await getPreviousWorkoutByType(prevWorkoutOpts, activity.start_time, activity.id)
    : null;

  type PrevSetRow = { exercise_id: string; reps: number; weight: number; exercise?: unknown };
  type PrevExercise = { name: string };
  function normalizePrevExercise(raw: unknown): PrevExercise | null {
    if (!raw) return null;
    return (Array.isArray(raw) ? raw[0] : raw) as PrevExercise ?? null;
  }

  type ExerciseSummary = { name: string; volume: number; sets: number; bestE1rm: number };
  function summarizeSets(rows: PrevSetRow[]): Map<string, ExerciseSummary> {
    const map = new Map<string, ExerciseSummary>();
    for (const s of rows) {
      const exName = normalizePrevExercise(s.exercise)?.name ?? "Unknown";
      const entry = map.get(s.exercise_id) ?? { name: exName, volume: 0, sets: 0, bestE1rm: 0 };
      entry.volume += (s.weight ?? 0) * (s.reps ?? 0);
      entry.sets += 1;
      const e1rm = (s.reps ?? 0) === 1 ? (s.weight ?? 0) : (s.weight ?? 0) * (1 + (s.reps ?? 0) / 30);
      if (e1rm > entry.bestE1rm) entry.bestE1rm = e1rm;
      map.set(s.exercise_id, entry);
    }
    return map;
  }

  const prevByExercise = prevWorkout ? summarizeSets(prevWorkout.sets as PrevSetRow[]) : new Map<string, ExerciseSummary>();

  // ── Workout: muscle coverage + exercise groups ──────────────────────────
  type ExerciseJoin = { name: string; primary_muscles: MuscleGroup[]; secondary_muscles?: MuscleGroup[]; muscle_tags?: string[] };
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
  const tagBuckets: Partial<Record<MuscleGroup, Map<MuscleTag, number>>> = {};
  const workoutSets = sets as SetRow[];

  for (const s of workoutSets) {
    const ex = normalizeExercise(s.exercise);
    if (!ex) continue;
    addMuscleTagSets(tagBuckets, ex.muscle_tags);

    for (const m of ex.primary_muscles) {
      coverage[m] = (coverage[m] ?? 0) + 1;

      const bucket = detailBuckets[m] ?? new Map<string, { label: string; count: number }>();
      const item = bucket.get(s.exercise_id) ?? { label: ex.name, count: 0 };
      item.count += 1;
      bucket.set(s.exercise_id, item);
      detailBuckets[m] = bucket;
    }
  }

  const detailMuscles = new Set<MuscleGroup>([
    ...(Object.keys(detailBuckets) as MuscleGroup[]),
    ...(Object.keys(tagBuckets) as MuscleGroup[]),
  ]);

  const muscleDetails = Object.fromEntries(
    Array.from(detailMuscles).map((muscle) => [
      muscle,
      {
        items: Array.from((detailBuckets[muscle] ?? new Map()).values())
          .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label))
          .map((item) => `${item.label} (${setLabel(item.count)})`),
        tags: muscleTagSummaries(tagBuckets[muscle]),
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
  const runLoad = isRun ? computeRunTrainingLoad(activity) : null;
  const hasRunPrimaryContent = isRun && Boolean(activity.summary_polyline || activity.strava_activity_id);

  // Compute vertical marker positions (seconds from start) for chart lap/split lines
  const chartMarkers: number[] = (() => {
    if (Array.isArray(activity.laps) && activity.laps.length > 1) {
      const markers: number[] = [];
      let t = 0;
      for (let i = 0; i < activity.laps.length - 1; i++) {
        t += activity.laps[i].elapsed_time;
        markers.push(t);
      }
      return markers;
    }
    if (hasSplits(activity.splits)) {
      const resolved = resolveSplitsForUnits(activity.splits, units);
      const markers: number[] = [];
      let t = 0;
      for (let i = 0; i < resolved.length - 1; i++) {
        t += resolved[i].elapsed_time;
        markers.push(t);
      }
      return markers;
    }
    return [];
  })();

  return (
    <div className="page-shell flex flex-col gap-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link
          href="/activity"
          aria-label="Back to activity"
          className="shrink-0 size-9 flex items-center justify-center rounded-full border border-white/10 text-white/55 hover:text-white hover:border-white/20 transition-colors"
        >
          <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="size-4">
            <path d="M15 18l-6-6 6-6" />
          </svg>
        </Link>
        <h1 className="flex-1 text-lg font-semibold truncate">
          {activity.name ?? (isWorkout ? "Workout" : isRun ? "Run" : "Activity")}
        </h1>
        {isRun && activity.strava_activity_id && (
          <RefreshStravaButton stravaActivityId={activity.strava_activity_id} />
        )}
        <DeleteActivityButton activityId={activity.id} />
      </div>

      <div className="text-sm text-muted" suppressHydrationWarning>
        {formatZonedDate(activity.start_time, timeZone, {
          weekday: "long",
          year: "numeric",
          month: "long",
          day: "numeric",
        })}
      </div>

      {activity.description && (
        <p className="text-sm text-white/70 leading-relaxed -mt-2">{activity.description}</p>
      )}

      {/* ── RUN DETAIL ─────────────────────────────────────────────────── */}
      {isRun && (
        <div
          className={
            hasRunPrimaryContent
              ? "mobile-landscape-stack grid gap-5 xl:grid-cols-[minmax(0,1fr)_24rem] xl:items-start"
              : "grid gap-5"
          }
        >
          {hasRunPrimaryContent && (
            <div className="contents xl:flex xl:min-w-0 xl:flex-col xl:gap-5">
              {/* Route map */}
              {activity.summary_polyline && (
                <div className="order-1 card h-56 overflow-hidden rounded-2xl xl:order-none xl:h-[22rem]">
                  <RouteMapExpandable polyline={activity.summary_polyline} />
                </div>
              )}

              {/* Time-series charts — only for Strava runs */}
              {activity.strava_activity_id && (
                <div className="order-4 xl:order-none">
                  <div className="text-xs text-muted uppercase tracking-wider mb-3">Charts</div>
                  <div className="card p-4">
                    <Suspense fallback={<div className="text-sm text-muted py-4 text-center">Loading charts…</div>}>
                      <RunStreams stravaActivityId={activity.strava_activity_id} units={units} markers={chartMarkers} />
                    </Suspense>
                  </div>
                </div>
              )}
            </div>
          )}

          <div className={hasRunPrimaryContent ? "contents xl:flex xl:min-w-0 xl:flex-col xl:gap-5" : "contents"}>
            {/* Summary stats grid */}
            <div className="order-2 grid grid-cols-2 gap-2 min-[380px]:grid-cols-3 sm:grid-cols-4 xl:order-none xl:grid-cols-2">
              <StatCard label="Distance" value={distanceKm ? formatDistance(distanceKm, units) : "—"} unit={distanceUnit(units)} />
              <StatCard label="Duration" value={formatDuration(activity.duration)} />
              {runLoad != null && runLoad > 0 && (
                <StatCard label="Run Load" value={formatLoad(runLoad)} />
              )}
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

            {/* Laps (intervals) */}
            {Array.isArray(activity.laps) && activity.laps.length > 0 && (
              <div className="order-3 xl:order-none">
                <LapsTable laps={activity.laps} units={units} />
              </div>
            )}

            {/* Splits */}
            {hasSplits(activity.splits) && (
              <div className="order-3 xl:order-none">
                <SplitsTable splits={activity.splits} units={units} />
              </div>
            )}

            {/* Best efforts / PRs */}
            {bestEfforts.length > 0 && (
              <div className="order-5 xl:order-none">
                <RunAchievements efforts={bestEfforts} units={units} />
              </div>
            )}

            {/* Notes */}
            {activity.notes && (
              <div className="order-6 card p-4 xl:order-none">
                <p className="text-sm text-muted">{activity.notes}</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── WORKOUT DETAIL ─────────────────────────────────────────────── */}
      {isWorkout && (
        <div className="mobile-landscape-stack grid gap-5 xl:grid-cols-[minmax(0,1fr)_24rem] xl:items-start">
          <div className="contents xl:flex xl:min-w-0 xl:flex-col xl:gap-5">
            <div className="order-3 xl:order-none">
              <WorkoutSetsEditor activityId={activity.id} initialSets={editableWorkoutSets} units={units} />
            </div>

            {prevWorkout && (
              <div className="order-4 xl:order-none">
                <WorkoutComparison
                  prevDate={prevWorkout.activity.start_time}
                  timeZone={timeZone}
                  currentSets={workoutSets}
                  prevByExercise={prevByExercise}
                  units={units}
                />
              </div>
            )}

            {activity.strava_activity_id && (
              <div className="order-5 xl:order-none">
                <div className="text-xs text-muted uppercase tracking-wider mb-3">Heart Rate</div>
                <div className="card p-4">
                  <RunStreams stravaActivityId={activity.strava_activity_id} units={units} markers={chartMarkers} />
                </div>
              </div>
            )}
          </div>

          <div className="contents xl:flex xl:min-w-0 xl:flex-col xl:gap-5">
            <div className="order-1 grid grid-cols-2 gap-2 min-[380px]:grid-cols-3 sm:grid-cols-4 xl:order-none xl:grid-cols-2">
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

            <div className="order-2 xl:order-none">
              <h2 className="text-sm font-medium text-muted mb-3 uppercase tracking-wide">Muscle Coverage</h2>
              <div className="card p-4">
                <div className="flex flex-wrap justify-center gap-4 sm:gap-6 xl:gap-4">
                  <MuscleHeatmap coverage={coverage} details={muscleDetails} tooltipContext="in this workout" size="full" />
                  <MuscleHeatmap coverage={coverage} details={muscleDetails} tooltipContext="in this workout" size="full" showBack />
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

type ExerciseSummaryForComp = { name: string; volume: number; sets: number; bestE1rm: number };

function WorkoutComparison({
  prevDate,
  timeZone,
  currentSets,
  prevByExercise,
  units,
}: {
  prevDate: string;
  timeZone: string;
  currentSets: { exercise_id: string; reps: number; weight: number; exercise?: unknown }[];
  prevByExercise: Map<string, ExerciseSummaryForComp>;
  units: import("@/types").Units;
}) {
  type ExJoin = { name: string };
  function exName(raw: unknown): string {
    if (!raw) return "Unknown";
    const ex = (Array.isArray(raw) ? raw[0] : raw) as ExJoin | null;
    return ex?.name ?? "Unknown";
  }

  // Summarize current sets per exercise
  const curr = new Map<string, ExerciseSummaryForComp>();
  for (const s of currentSets) {
    const entry = curr.get(s.exercise_id) ?? { name: exName(s.exercise), volume: 0, sets: 0, bestE1rm: 0 };
    entry.volume += (s.weight ?? 0) * (s.reps ?? 0);
    entry.sets += 1;
    const e1rm = (s.reps ?? 0) === 1 ? (s.weight ?? 0) : (s.weight ?? 0) * (1 + (s.reps ?? 0) / 30);
    if (e1rm > entry.bestE1rm) entry.bestE1rm = e1rm;
    curr.set(s.exercise_id, entry);
  }

  const rows = Array.from(curr.entries()).map(([exId, c]) => {
    const p = prevByExercise.get(exId);
    return { exId, name: c.name, curr: c, prev: p ?? null };
  });

  const unit = weightUnit(units);

  function Delta({ curr: c, prev: p }: { curr: number; prev: number | null }) {
    if (p === null) return <span className="text-xs text-muted">new</span>;
    const diff = c - p;
    const pct = p > 0 ? (diff / p) * 100 : 0;
    const color = diff > 0 ? "text-green-400" : diff < 0 ? "text-red-400" : "text-muted";
    const displayDiff = diff >= 0
      ? `+${formatWeight(diff, units)}`
      : `−${formatWeight(Math.abs(diff), units)}`;
    const displayPct = `${pct >= 0 ? "+" : ""}${pct.toFixed(0)}%`;
    return (
      <span className={`text-xs font-medium ${color}`}>
        {displayDiff} <span className="font-normal opacity-70">({displayPct})</span>
      </span>
    );
  }

  const prevLabel = formatZonedDate(prevDate, timeZone, { month: "short", day: "numeric" });

  return (
    <div>
      <div className="flex items-center justify-between gap-3 mb-2">
        <div className="text-xs text-muted uppercase tracking-wider">vs {prevLabel}</div>
      </div>
      <div className="card overflow-hidden">
        <div className="hidden sm:grid grid-cols-[minmax(0,1fr)_7rem_7rem_7rem] px-3 py-2 text-[10px] text-muted uppercase tracking-wider border-b border-border">
          <span>Exercise</span>
          <span className="text-right">Volume ({unit})</span>
          <span className="text-right">Sets</span>
          <span className="text-right">Best e1RM ({unit})</span>
        </div>
        {rows.map(({ exId, name, curr: c, prev: p }) => (
          <div
            key={exId}
            className="grid gap-1 px-3 py-3 border-b border-border/50 last:border-0 sm:grid-cols-[minmax(0,1fr)_7rem_7rem_7rem] sm:items-center sm:gap-3"
          >
            <div className="text-sm font-medium truncate">{name}</div>
            <div className="flex items-center justify-between sm:block sm:text-right gap-3">
              <span className="text-[10px] text-muted uppercase tracking-wider sm:hidden">Volume</span>
              <Delta curr={c.volume} prev={p?.volume ?? null}  />
            </div>
            <div className="flex items-center justify-between sm:block sm:text-right gap-3">
              <span className="text-[10px] text-muted uppercase tracking-wider sm:hidden">Sets</span>
              {p === null ? (
                <span className="text-xs text-muted">new</span>
              ) : (
                <span className={`text-xs font-medium ${c.sets > p.sets ? "text-green-400" : c.sets < p.sets ? "text-red-400" : "text-muted"}`}>
                  {c.sets > p.sets ? `+${c.sets - p.sets}` : c.sets < p.sets ? `−${p.sets - c.sets}` : "—"}
                </span>
              )}
            </div>
            <div className="flex items-center justify-between sm:block sm:text-right gap-3">
              <span className="text-[10px] text-muted uppercase tracking-wider sm:hidden">Best e1RM</span>
              <Delta curr={c.bestE1rm} prev={p?.bestE1rm ?? null}  />
            </div>
          </div>
        ))}
      </div>
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
      <div className="break-words text-base font-semibold tracking-normal sm:text-lg">
        {value}
        {unit && <span className="text-xs font-normal text-muted ml-1">{unit}</span>}
      </div>
      <div className="text-xs text-muted mt-0.5">{label}</div>
    </div>
  );
}
