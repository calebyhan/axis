import { createClient } from "@/lib/supabase/server";
import { computeE1RM } from "@/lib/e1rm";
import type { CalendarActivity, CalendarDayPlan, CalendarSkipOverride } from "@/lib/calendar";
import { getUserTimeZone } from "@/lib/queries/profile";
import { addDateKeyDays, formatZonedDate, zonedDateKey, zonedDateTimeToUtc } from "@/lib/time-zone";
import { computeStrengthBalance, strengthInputsFromExerciseSets, type StrengthSetDescriptor } from "@/lib/strength-balance";
import { addMuscleTagSets, muscleTagSummaries } from "@/lib/muscle-tags";
import { buildDailyTrainingLoads, computeATLCTLTSB } from "@/lib/training-load";
import type { MovementPattern, MuscleGroup, MuscleHeatmapDetails, MuscleTag } from "@/types";

export type TimeRange = "week" | "month" | "year" | "all";

function getRangeStartDateKey(range: TimeRange, timeZone: string): string | null {
  const now = new Date();
  if (range === "all") return null;
  if (range === "week") return addDateKeyDays(zonedDateKey(now, timeZone), -7);

  const d = new Date(now);
  if (range === "month") {
    d.setMonth(d.getMonth() - 1);
    return zonedDateKey(d, timeZone);
  }

  d.setFullYear(d.getFullYear() - 1);
  return zonedDateKey(d, timeZone);
}

function getRangeStartInstant(range: TimeRange, timeZone: string): string | null {
  const dateKey = getRangeStartDateKey(range, timeZone);
  return dateKey ? zonedDateTimeToUtc(dateKey, timeZone).toISOString() : null;
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

export async function getVolumeOverTime(range: TimeRange) {
  const supabase = await createClient();
  const timeZone = await getUserTimeZone();
  const since = getRangeStartInstant(range, timeZone);

  let query = supabase
    .from("session_sets")
    .select("reps, weight, activities!inner(start_time, type)")
    .eq("activities.type", "workout");

  if (since) query = query.gte("activities.start_time", since);

  const { data, error } = await query;
  if (error) console.error("[query] getVolumeOverTime failed", error.message);
  if (!data) return [];

  const weekly = new Map<string, number>();
  for (const s of data) {
    const actRaw = s.activities as unknown;
    const act = (Array.isArray(actRaw) ? actRaw[0] : actRaw) as { start_time: string };
    const week = getISOWeek(zonedDateKey(act.start_time, timeZone));
    weekly.set(week, (weekly.get(week) ?? 0) + s.reps * s.weight);
  }

  return Array.from(weekly.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([week, volume]) => ({ week, volume: Math.round(volume) }));
}

export async function getRunningStats(range: TimeRange) {
  const supabase = await createClient();
  const timeZone = await getUserTimeZone();
  const since = getRangeStartInstant(range, timeZone);

  let query = supabase
    .from("activities")
    .select("id, name, start_time, distance, avg_pace, suffer_score, duration, avg_heartrate, best_efforts")
    .in("type", ["run", "manual_run"])
    .order("start_time");

  if (since) query = query.gte("start_time", since);

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
  const since = getRangeStartDateKey(range, timeZone);

  let query = supabase
    .from("daily_checkins")
    .select("date, body_weight")
    .order("date");

  if (since) query = query.gte("date", since);

  const { data, error } = await query;
  if (error) console.error("[query] getBodyWeightStats failed", error.message);
  return data ?? [];
}

export async function getE1RMHistory(exerciseId: string, range: TimeRange) {
  const supabase = await createClient();
  const timeZone = await getUserTimeZone();
  const since = getRangeStartInstant(range, timeZone);

  let query = supabase
    .from("session_sets")
    .select("reps, weight, activities!inner(start_time)")
    .eq("exercise_id", exerciseId)
    .order("activities.start_time");

  if (since) query = query.gte("activities.start_time", since);

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

export async function getWorkoutSummary(range: TimeRange) {
  const supabase = await createClient();
  const timeZone = await getUserTimeZone();
  const since = getRangeStartInstant(range, timeZone);

  const [sessionRes, setsRes] = await Promise.all([
    (() => {
      let q = supabase
        .from("activities")
        .select("id", { count: "exact", head: true })
        .eq("type", "workout");
      if (since) q = q.gte("start_time", since);
      return q;
    })(),
    (() => {
      let q = supabase
        .from("session_sets")
        .select("reps, weight, exercise_id, exercises!inner(name, primary_muscles, secondary_muscles, muscle_tags, movement_pattern), activities!inner(start_time, type)")
        .eq("activities.type", "workout");
      if (since) q = q.gte("activities.start_time", since);
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

function getTrainingLoadWindow(range: TimeRange): number {
  if (range === "week") return 7;
  if (range === "month") return 30;
  if (range === "year") return 365;
  return 730;
}

export async function getTrainingLoadHistory(range: TimeRange = "month") {
  const supabase = await createClient();
  const timeZone = await getUserTimeZone();
  const todayKey = zonedDateKey(new Date(), timeZone);
  const sinceKey = addDateKeyDays(todayKey, -(getTrainingLoadWindow(range) - 1));
  const sinceISO = zonedDateTimeToUtc(sinceKey, timeZone).toISOString();

  const [activitiesRes, setsRes] = await Promise.all([
    supabase
      .from("activities")
      .select("start_time, suffer_score")
      .in("type", ["run", "manual_run"])
      .gte("start_time", sinceISO)
      .order("start_time"),
    supabase
      .from("session_sets")
      .select("reps, weight, rpe, activities!inner(start_time)")
      .eq("activities.type", "workout")
      .gte("activities.start_time", sinceISO),
  ]);

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

  const loads = buildDailyTrainingLoads(
    activitiesRes.data ?? [],
    strengthSets,
    sinceKey,
    todayKey,
    timeZone
  );

  return computeATLCTLTSB(loads);
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
  const sinceKey = getRangeStartDateKey(range, timeZone);
  const since = sinceKey ? zonedDateTimeToUtc(sinceKey, timeZone).toISOString() : null;
  const today = new Date();
  const todayKey = zonedDateKey(today, timeZone);

  let activitiesQuery = supabase
    .from("activities")
    .select("start_time, type")
    .lte("start_time", today.toISOString())
    .order("start_time", { ascending: true });

  let overridesQuery = supabase
    .from("schedule_overrides")
    .select("date, slot")
    .lte("date", todayKey)
    .is("day_type_id", null);

  if (since) {
    activitiesQuery = activitiesQuery.gte("start_time", since);
    overridesQuery = overridesQuery.gte("date", sinceKey);
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
    todayKey,
  };
}

function getISOWeek(dateKey: string): string {
  const [year, month, day] = dateKey.split("-").map(Number);
  const d = new Date(Date.UTC(year, month - 1, day, 12));
  d.setUTCDate(d.getUTCDate() + 4 - ((d.getUTCDay() || 7) - 1));
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1, 12));
  const weekNo = Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(weekNo).padStart(2, "0")}`;
}
