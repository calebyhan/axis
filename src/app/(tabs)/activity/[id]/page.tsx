export const dynamic = "force-dynamic";

import { getActivityWithSets } from "@/lib/queries/activity";
import { getUserUnits } from "@/lib/queries/profile";
import { computeE1RM } from "@/lib/e1rm";
import { MuscleHeatmap } from "@/components/heatmap/MuscleHeatmap";
import { formatWeight, formatDistance, formatPace, weightUnit, distanceUnit } from "@/lib/units";
import { RunStreams } from "@/components/activity/RunStreams";
import { SplitsTable } from "@/components/activity/SplitsTable";
import type { MuscleGroup, BestEffort } from "@/types";
import Link from "next/link";
import { notFound } from "next/navigation";
import { DeleteActivityButton } from "@/components/activity/DeleteActivityButton";
import { RouteMapExpandable } from "@/components/activity/RouteMapExpandable";

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

function BestEfforts({ efforts }: { efforts: BestEffort[] }) {
  const prs = efforts.filter((e) => e.pr_rank === 1);
  if (!prs.length) return null;

  return (
    <div>
      <div className="text-xs text-muted uppercase tracking-wider mb-2">Personal Records</div>
      <div className="flex flex-wrap gap-2">
        {prs
          .sort((a, b) => BEST_EFFORT_ORDER.indexOf(a.name) - BEST_EFFORT_ORDER.indexOf(b.name))
          .map((e) => {
            const m = Math.floor(e.elapsed_time / 60);
            const s = e.elapsed_time % 60;
            return (
              <div
                key={e.name}
                className="card px-3 py-2 flex flex-col items-center gap-0.5"
              >
                <span className="text-[10px] text-amber-400 uppercase tracking-wider">PR</span>
                <span className="text-sm font-semibold">{e.name}</span>
                <span className="text-xs text-muted">{m}:{String(s).padStart(2, "0")}</span>
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

  type SetRow = { exercise_id: string; set_number: number; reps: number; weight: number; rpe: number; exercise?: unknown };
  const exerciseGroups = new Map<string, { name: string; sets: SetRow[] }>();
  for (const s of sets as SetRow[]) {
    const exId = s.exercise_id;
    const exName = normalizeExercise(s.exercise)?.name ?? "Unknown";
    if (!exerciseGroups.has(exId)) exerciseGroups.set(exId, { name: exName, sets: [] });
    exerciseGroups.get(exId)!.sets.push(s);
  }

  // ── Run: derived stats ──────────────────────────────────────────────────
  const distanceKm = activity.distance ? activity.distance / 1000 : null;
  const stoppedTime =
    activity.elapsed_time && activity.duration
      ? activity.elapsed_time - activity.duration
      : null;

  return (
    <div className="page-shell flex flex-col gap-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link
          href="/activity"
          className="shrink-0 w-9 h-9 flex items-center justify-center rounded-full border border-white/10 text-white/55 hover:text-white hover:border-white/20 transition-colors"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-4 h-4">
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
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
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
            {stoppedTime != null && stoppedTime > 30 && (
              <StatCard label="Stopped" value={formatDuration(stoppedTime)} />
            )}
            {activity.average_temp != null && (
              <StatCard label="Temp" value={`${Math.round(activity.average_temp)}°C`} />
            )}
          </div>

          {/* Splits */}
          {activity.splits && activity.splits.length > 0 && (
            <SplitsTable splits={activity.splits} units={units} />
          )}

          {/* Time-series charts — only for Strava runs */}
          {activity.strava_activity_id && (
            <div>
              <div className="text-xs text-muted uppercase tracking-wider mb-3">Charts</div>
              <div className="card p-4">
                <RunStreams stravaActivityId={activity.strava_activity_id} units={units} />
              </div>
            </div>
          )}

          {/* Best efforts / PRs */}
          {activity.best_efforts && activity.best_efforts.length > 0 && (
            <BestEfforts efforts={activity.best_efforts} />
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
          <div className="grid grid-cols-3 gap-2">
            <StatCard label="Duration" value={formatDuration(activity.duration)} />
            <StatCard label="Exercises" value={`${exerciseGroups.size}`} />
            <StatCard label="Sets" value={`${sets.length}`} />
          </div>

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
                const bestE1RM = Math.max(...exSets.map((s: SetRow) => computeE1RM(s.weight, s.reps)));
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
    <div className="card p-3 text-center">
      <div className="text-lg font-semibold tracking-tight">
        {value}
        {unit && <span className="text-xs font-normal text-muted ml-1">{unit}</span>}
      </div>
      <div className="text-xs text-muted mt-0.5">{label}</div>
    </div>
  );
}
