import { createClient } from "@/lib/supabase/server";
import { computeE1RM } from "@/lib/e1rm";
import type { CalendarActivity, CalendarDayPlan, CalendarSkipOverride } from "@/lib/calendar";
import { getUserTimeZone } from "@/lib/queries/profile";
import { addDateKeyDays, formatZonedDate, zonedDateKey } from "@/lib/time-zone";
import {
  getPreviousStatsRangeBounds,
  getStatsChartBucketDateKey,
  getStatsRangeBounds,
  type StatsRangeBounds,
  type TimeRange,
} from "@/lib/stats-ranges";
import { computeStrengthBalance, strengthInputsFromExerciseSets, type StrengthSetDescriptor } from "@/lib/strength-balance";
import { addMuscleTagSets, muscleTagSummaries } from "@/lib/muscle-tags";
import { buildDailyTrainingLoads, computeATLCTLTSB } from "@/lib/training-load";
import {
  DEFAULT_HR_ZONES,
  DEFAULT_MAX_HEART_RATE,
  maxHeartRateToZones,
  normalizeHRZoneMethod,
  normalizeHRZones,
} from "@/lib/hr-zones";
import { deriveWorkoutPersonalRecords, type WorkoutPersonalRecord, type WorkoutPrSetRow } from "@/lib/workout-prs";
import type { MovementPattern, MuscleGroup, MuscleHeatmapDetails, MuscleTag } from "@/types";

export type { WorkoutPersonalRecord };

export interface StatsOverviewSnapshot {
  activeDays: number;
  totalSessions: number;
  workoutSessions: number;
  totalSets: number;
  totalVolume: number;
  runDistanceKm: number;
  runCount: number;
  bestPace: number | null;
  avgHR: number | null;
  bodyWeight: number | null;
  bodyWeightDelta: number | null;
  weighIns: number;
}

function normalizeRelation<T>(raw: unknown): T | null {
  if (!raw) return null;
  return (Array.isArray(raw) ? raw[0] : raw) as T;
}

function setLabel(count: number): string {
  return `${count} set${count === 1 ? "" : "s"}`;
}

function workoutDateLabel(startTime: string, timeZone: string): string {
  return formatZonedDate(startTime, timeZone, {
    month: "short",
    day: "numeric",
  });
}

function emptyVolumeBuckets(range: TimeRange, startDateKey: string | null, endDateKey: string): Map<string, number> {
  const buckets = new Map<string, number>();
  if (range !== "week" || !startDateKey) return buckets;

  for (let date = startDateKey; date <= endDateKey; date = addDateKeyDays(date, 1)) {
    buckets.set(date, 0);
  }

  return buckets;
}

export async function getVolumeOverTime(range: TimeRange) {
  const supabase = await createClient();
  const timeZone = await getUserTimeZone();
  const bounds = getStatsRangeBounds(range, timeZone);

  let query = supabase
    .from("session_sets")
    .select("reps, weight, activities!inner(start_time, type)")
    .eq("activities.type", "workout")
    .lt("activities.start_time", bounds.endExclusiveInstant);

  if (bounds.startInstant) query = query.gte("activities.start_time", bounds.startInstant);

  const { data, error } = await query;
  if (error) console.error("[query] getVolumeOverTime failed", error.message);
  if (!data) return [];

  const volumeByPeriod = emptyVolumeBuckets(range, bounds.startDateKey, bounds.endDateKey);
  let hasVolume = false;

  for (const s of data) {
    const actRaw = s.activities as unknown;
    const act = (Array.isArray(actRaw) ? actRaw[0] : actRaw) as { start_time: string };
    const dateKey = zonedDateKey(act.start_time, timeZone);
    const period = getStatsChartBucketDateKey(range, dateKey, bounds.startDateKey);
    const volume = s.reps * s.weight;
    if (volume > 0) hasVolume = true;
    volumeByPeriod.set(period, (volumeByPeriod.get(period) ?? 0) + volume);
  }

  if (!hasVolume) return [];

  return Array.from(volumeByPeriod.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([period, volume]) => ({ period, volume: Math.round(volume) }));
}

async function getStatsOverviewSnapshotForBounds(
  bounds: StatsRangeBounds,
  timeZone: string
): Promise<StatsOverviewSnapshot> {
  const supabase = await createClient();

  let activitiesQuery = supabase
    .from("activities")
    .select("type, start_time, distance, avg_pace, avg_heartrate")
    .in("type", ["workout", "run", "manual_run", "ride"])
    .lt("start_time", bounds.endExclusiveInstant);

  let setsQuery = supabase
    .from("session_sets")
    .select("reps, weight, activities!inner(start_time, type)")
    .eq("activities.type", "workout")
    .lt("activities.start_time", bounds.endExclusiveInstant);

  let bodyQuery = supabase
    .from("daily_checkins")
    .select("date, body_weight")
    .lt("date", bounds.endExclusiveDateKey)
    .order("date");

  if (bounds.startInstant) {
    activitiesQuery = activitiesQuery.gte("start_time", bounds.startInstant);
    setsQuery = setsQuery.gte("activities.start_time", bounds.startInstant);
  }

  if (bounds.startDateKey) {
    bodyQuery = bodyQuery.gte("date", bounds.startDateKey);
  }

  const [activitiesRes, setsRes, bodyRes] = await Promise.all([activitiesQuery, setsQuery, bodyQuery]);

  if (activitiesRes.error) console.error("[query] getStatsOverviewSnapshot activities failed", activitiesRes.error.message);
  if (setsRes.error) console.error("[query] getStatsOverviewSnapshot sets failed", setsRes.error.message);
  if (bodyRes.error) console.error("[query] getStatsOverviewSnapshot body failed", bodyRes.error.message);

  const activities = (activitiesRes.data ?? []) as {
    type: string;
    start_time: string;
    distance: number | null;
    avg_pace: number | null;
    avg_heartrate: number | null;
  }[];
  const sets = (setsRes.data ?? []) as { reps: number; weight: number }[];
  const body = bodyRes.data ?? [];
  const runs = activities.filter((activity) => activity.type === "run" || activity.type === "manual_run");
  const heartRateRuns = runs.filter((activity) => activity.avg_heartrate != null);
  const paces = runs.flatMap((activity) => (activity.avg_pace ? [activity.avg_pace] : []));
  const activeDays = new Set(activities.map((activity) => zonedDateKey(activity.start_time, timeZone))).size;
  const firstWeight = body[0]?.body_weight ?? null;
  const lastWeight = body[body.length - 1]?.body_weight ?? null;

  return {
    activeDays,
    totalSessions: activities.length,
    workoutSessions: activities.filter((activity) => activity.type === "workout").length,
    totalSets: sets.length,
    totalVolume: Math.round(sets.reduce((sum, set) => sum + set.reps * set.weight, 0)),
    runDistanceKm: runs.reduce((sum, run) => sum + (run.distance ?? 0), 0) / 1000,
    runCount: runs.length,
    bestPace: paces.length > 0 ? Math.min(...paces) : null,
    avgHR:
      heartRateRuns.length > 0
        ? Math.round(heartRateRuns.reduce((sum, run) => sum + (run.avg_heartrate ?? 0), 0) / heartRateRuns.length)
        : null,
    bodyWeight: lastWeight,
    bodyWeightDelta: firstWeight !== null && lastWeight !== null ? lastWeight - firstWeight : null,
    weighIns: body.length,
  };
}

export async function getPreviousStatsOverviewSnapshot(range: TimeRange): Promise<StatsOverviewSnapshot | null> {
  const timeZone = await getUserTimeZone();
  const bounds = getPreviousStatsRangeBounds(range, timeZone);
  if (!bounds) return null;
  return getStatsOverviewSnapshotForBounds(bounds, timeZone);
}

export async function getRunningStats(range: TimeRange) {
  const supabase = await createClient();
  const timeZone = await getUserTimeZone();
  const bounds = getStatsRangeBounds(range, timeZone);

  let query = supabase
    .from("activities")
    .select("id, name, start_time, distance, avg_pace, suffer_score, duration, avg_heartrate, best_efforts")
    .in("type", ["run", "manual_run"])
    .lt("start_time", bounds.endExclusiveInstant)
    .order("start_time");

  if (bounds.startInstant) query = query.gte("start_time", bounds.startInstant);

  const { data, error } = await query;
  if (error) console.error("[query] getRunningStats failed", error.message);
  return (data ?? []).map((activity) => ({
    ...activity,
    date: zonedDateKey(activity.start_time, timeZone),
  }));
}

export async function getBodyWeightStats(range: TimeRange) {
  const supabase = await createClient();
  const timeZone = await getUserTimeZone();
  const bounds = getStatsRangeBounds(range, timeZone);

  let query = supabase
    .from("daily_checkins")
    .select("date, body_weight")
    .lt("date", bounds.endExclusiveDateKey)
    .order("date");

  if (bounds.startDateKey) query = query.gte("date", bounds.startDateKey);

  const { data, error } = await query;
  if (error) console.error("[query] getBodyWeightStats failed", error.message);
  return data ?? [];
}

export async function getE1RMHistory(exerciseId: string, range: TimeRange) {
  const supabase = await createClient();
  const timeZone = await getUserTimeZone();
  const bounds = getStatsRangeBounds(range, timeZone);

  let query = supabase
    .from("session_sets")
    .select("reps, weight, activities!inner(start_time)")
    .eq("exercise_id", exerciseId)
    .lt("activities.start_time", bounds.endExclusiveInstant)
    .order("activities.start_time");

  if (bounds.startInstant) query = query.gte("activities.start_time", bounds.startInstant);

  const { data, error } = await query;
  if (error) console.error("[query] getE1RMHistory failed", error.message);
  if (!data) return [];

  const sessions = new Map<string, number>();
  for (const s of data) {
    const actRaw = s.activities as unknown;
    const act = (Array.isArray(actRaw) ? actRaw[0] : actRaw) as { start_time: string };
    const day = zonedDateKey(act.start_time, timeZone);
    const e1rm = computeE1RM(s.weight, s.reps);
    sessions.set(day, Math.max(sessions.get(day) ?? 0, e1rm));
  }

  return Array.from(sessions.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, e1rm]) => ({ date, e1rm: Math.round(e1rm * 10) / 10 }));
}

export async function getExercisesForDropdown() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("exercises")
    .select("id, name")
    .order("name");
  if (error) console.error("[query] getExercisesForDropdown failed", error.message);
  return data ?? [];
}

export async function getWorkoutPersonalRecords(range: TimeRange): Promise<WorkoutPersonalRecord[]> {
  const supabase = await createClient();
  const timeZone = await getUserTimeZone();
  const bounds = getStatsRangeBounds(range, timeZone);

  const { data, error } = await supabase
    .from("session_sets")
    .select("id, exercise_id, set_number, reps, weight, created_at, activities!inner(id, start_time, type), exercises!inner(name)")
    .eq("activities.type", "workout")
    .lt("activities.start_time", bounds.endExclusiveInstant);

  if (error) {
    console.error("[query] getWorkoutPersonalRecords failed", error.message);
    return [];
  }

  return deriveWorkoutPersonalRecords((data ?? []) as WorkoutPrSetRow[], {
    startInstant: bounds.startInstant,
    endExclusiveInstant: bounds.endExclusiveInstant,
    timeZone,
  });
}

export async function getWorkoutSummary(range: TimeRange) {
  const supabase = await createClient();
  const timeZone = await getUserTimeZone();
  const bounds = getStatsRangeBounds(range, timeZone);

  const [sessionRes, setsRes] = await Promise.all([
    (() => {
      let q = supabase
        .from("activities")
        .select("id", { count: "exact", head: true })
        .eq("type", "workout")
        .lt("start_time", bounds.endExclusiveInstant);
      if (bounds.startInstant) q = q.gte("start_time", bounds.startInstant);
      return q;
    })(),
    (() => {
      let q = supabase
        .from("session_sets")
        .select("reps, weight, exercise_id, exercises!inner(name, primary_muscles, secondary_muscles, muscle_tags, movement_pattern), activities!inner(start_time, type)")
        .eq("activities.type", "workout")
        .lt("activities.start_time", bounds.endExclusiveInstant);
      if (bounds.startInstant) q = q.gte("activities.start_time", bounds.startInstant);
      return q;
    })(),
  ]);

  if (setsRes.error) console.error("[query] getWorkoutSummary failed", setsRes.error.message);
  const sets = setsRes.data ?? [];

  const exerciseVolume = new Map<string, { name: string; volume: number; sets: number }>();
  const coverage: Partial<Record<MuscleGroup, number>> = {};
  const detailBuckets: Partial<Record<MuscleGroup, Map<string, { label: string; count: number; sortTime: number }>>> = {};
  const tagBuckets: Partial<Record<MuscleGroup, Map<MuscleTag, number>>> = {};
  const balanceRows: StrengthSetDescriptor[] = [];
  let totalSets = 0;
  let totalVolume = 0;

  for (const s of sets) {
    const ex = normalizeRelation<{ name: string; primary_muscles: MuscleGroup[]; secondary_muscles: MuscleGroup[]; muscle_tags?: string[]; movement_pattern: MovementPattern }>(s.exercises);
    const activity = normalizeRelation<{ start_time: string }>(s.activities);
    if (!ex) continue;

    const vol = s.reps * s.weight;
    const existing = exerciseVolume.get(s.exercise_id) ?? { name: ex.name, volume: 0, sets: 0 };
    exerciseVolume.set(s.exercise_id, { name: ex.name, volume: existing.volume + vol, sets: existing.sets + 1 });
    totalSets++;
    totalVolume += vol;
    balanceRows.push({
      exerciseId: s.exercise_id,
      name: ex.name,
      movementPattern: ex.movement_pattern,
      primaryMuscles: ex.primary_muscles,
      secondaryMuscles: ex.secondary_muscles,
      muscleTags: ex.muscle_tags,
    });
    addMuscleTagSets(tagBuckets, ex.muscle_tags);

    const dateLabel = activity?.start_time ? workoutDateLabel(activity.start_time, timeZone) : "Workout";
    const label = `${dateLabel} - ${ex.name}`;
    const key = `${activity?.start_time ?? "unknown"}:${s.exercise_id}`;
    const sortTime = activity?.start_time ? new Date(activity.start_time).getTime() : 0;

    for (const muscle of ex.primary_muscles ?? []) {
      coverage[muscle] = (coverage[muscle] ?? 0) + 1;

      const bucket = detailBuckets[muscle] ?? new Map<string, { label: string; count: number; sortTime: number }>();
      const item = bucket.get(key) ?? { label, count: 0, sortTime };
      item.count += 1;
      bucket.set(key, item);
      detailBuckets[muscle] = bucket;
    }
  }

  const topExercises = Array.from(exerciseVolume.values())
    .sort((a, b) => b.volume - a.volume)
    .slice(0, 5)
    .map((e) => ({ name: e.name, volume: Math.round(e.volume), sets: e.sets }));

  const detailMuscles = new Set<MuscleGroup>([
    ...(Object.keys(detailBuckets) as MuscleGroup[]),
    ...(Object.keys(tagBuckets) as MuscleGroup[]),
  ]);

  const muscleDetails = Object.fromEntries(
    Array.from(detailMuscles).map((muscle) => [
      muscle,
      {
        items: Array.from((detailBuckets[muscle] ?? new Map()).values())
          .sort((a, b) => b.sortTime - a.sortTime || b.count - a.count || a.label.localeCompare(b.label))
          .map((item) => `${item.label} (${setLabel(item.count)})`),
        tags: muscleTagSummaries(tagBuckets[muscle]),
      },
    ])
  ) as MuscleHeatmapDetails;

  return {
    sessionCount: sessionRes.count ?? 0,
    totalSets,
    totalVolume: Math.round(totalVolume),
    topExercises,
    muscleCoverage: coverage,
    muscleDetails,
    strengthBalance: computeStrengthBalance(strengthInputsFromExerciseSets(balanceRows), { scopeLabel: "this period", nudgeLimit: 1 }),
  };
}

export async function getTrainingLoadHistory(range: TimeRange = "month") {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const timeZone = await getUserTimeZone();
  const bounds = getStatsRangeBounds(range, timeZone);

  const [activitiesRes, setsRes, profileRes] = await Promise.all([
    supabase
      .from("activities")
      .select("type, source, start_time, duration, avg_heartrate, suffer_score")
      .in("type", ["run", "manual_run"])
      .lt("start_time", bounds.endExclusiveInstant)
      .order("start_time"),
    supabase
      .from("session_sets")
      .select("reps, weight, rpe, activities!inner(start_time)")
      .eq("activities.type", "workout")
      .lt("activities.start_time", bounds.endExclusiveInstant),
    user
      ? supabase
          .from("profiles")
          .select("hr_zones, hr_zone_method, max_heart_rate, strava_hr_zones")
          .eq("id", user.id)
          .maybeSingle()
      : Promise.resolve({ data: null, error: null }),
  ]);

  if (activitiesRes.error) console.error("[query] getTrainingLoadHistory activities failed", activitiesRes.error.message);
  if (setsRes.error) console.error("[query] getTrainingLoadHistory sets failed", setsRes.error.message);
  if (profileRes.error) console.error("[query] getTrainingLoadHistory profile failed", profileRes.error.message);

  const activities = activitiesRes.data ?? [];
  const customHRZones = normalizeHRZones(profileRes.data?.hr_zones);
  const stravaHRZones = normalizeHRZones(profileRes.data?.strava_hr_zones);
  const maxHRZones = maxHeartRateToZones(profileRes.data?.max_heart_rate ?? DEFAULT_MAX_HEART_RATE) ?? DEFAULT_HR_ZONES;
  const hrZoneMethod = normalizeHRZoneMethod(profileRes.data?.hr_zone_method) ?? (customHRZones ? "custom" : stravaHRZones ? "strava" : "max_hr");
  const activeHRZones = hrZoneMethod === "custom"
    ? customHRZones ?? maxHRZones
    : hrZoneMethod === "strava"
      ? stravaHRZones ?? maxHRZones
      : maxHRZones;
  const strengthSets = (setsRes.data ?? []).flatMap((set) => {
    const act = normalizeRelation<{ start_time: string }>(set.activities);
    if (!act) return [];
    return [{
      start_time: act.start_time,
      reps: set.reps,
      weight: set.weight,
      rpe: set.rpe,
    }];
  });
  const dataDateKeys = [
    ...activities.map((activity) => zonedDateKey(activity.start_time, timeZone)),
    ...strengthSets.map((set) => zonedDateKey(set.start_time, timeZone)),
  ].sort();

  if (dataDateKeys.length === 0) return [];

  const firstDataKey = dataDateKeys[0];
  const visibleStartKey = bounds.startDateKey ?? firstDataKey;
  const computeStartKey = firstDataKey < visibleStartKey ? firstDataKey : visibleStartKey;

  const loads = buildDailyTrainingLoads(
    activities,
    strengthSets,
    computeStartKey,
    bounds.endDateKey,
    timeZone,
    activeHRZones
  );

  return computeATLCTLTSB(loads).filter((point) => point.date >= visibleStartKey);
}

export interface HistoricalPlanCalendarData {
  activities: CalendarActivity[];
  dayPlans: CalendarDayPlan[];
  skipOverrides: CalendarSkipOverride[];
  todayKey: string;
}

export async function getHistoricalPlanCalendarData(range: TimeRange): Promise<HistoricalPlanCalendarData> {
  const supabase = await createClient();
  const timeZone = await getUserTimeZone();
  const bounds = getStatsRangeBounds(range, timeZone);

  let activitiesQuery = supabase
    .from("activities")
    .select("start_time, type")
    .lt("start_time", bounds.endExclusiveInstant)
    .order("start_time", { ascending: true });

  let overridesQuery = supabase
    .from("schedule_overrides")
    .select("date, slot")
    .lt("date", bounds.endExclusiveDateKey)
    .is("day_type_id", null);

  if (bounds.startDateKey && bounds.startInstant) {
    activitiesQuery = activitiesQuery.gte("start_time", bounds.startInstant);
    overridesQuery = overridesQuery.gte("date", bounds.startDateKey);
  }

  const [activitiesRes, plansRes, overridesRes] = await Promise.all([
    activitiesQuery,
    supabase
      .from("weekly_schedule")
      .select(
        "day_of_week, day_type:day_types!weekly_schedule_day_type_id_fkey(name), cardio_day_type:day_types!weekly_schedule_cardio_day_type_id_fkey(name)"
      )
      .eq("active", true),
    overridesQuery,
  ]);

  if (activitiesRes.error) console.error("[query] getHistoricalPlanCalendarData activities failed", activitiesRes.error.message);
  if (plansRes.error) console.error("[query] getHistoricalPlanCalendarData plans failed", plansRes.error.message);
  if (overridesRes.error) console.error("[query] getHistoricalPlanCalendarData overrides failed", overridesRes.error.message);

  const dayPlans: CalendarDayPlan[] = (plansRes.data ?? []).map((row) => {
    const raw = row as { day_of_week: number; day_type?: unknown; cardio_day_type?: unknown };
    const dayType = normalizeRelation<{ name: string }>(raw.day_type);
    const cardioDayType = normalizeRelation<{ name: string }>(raw.cardio_day_type);

    return {
      dayOfWeek: raw.day_of_week,
      hasWorkoutSlot: true,
      hasCardioSlot: !!cardioDayType?.name,
      workoutSatisfiedByRest: !dayType?.name || dayType.name === "Rest",
      cardioSatisfiedByRest: cardioDayType?.name === "Rest",
    };
  });

  return {
    activities: ((activitiesRes.data ?? []) as { start_time: string; type: string }[]).map((activity) => ({
      ...activity,
      date: zonedDateKey(activity.start_time, timeZone),
    })),
    dayPlans,
    skipOverrides: (overridesRes.data ?? []) as CalendarSkipOverride[],
    todayKey: bounds.endDateKey,
  };
}
