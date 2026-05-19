import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { addMuscleTagSets, muscleTagSummaries } from "@/lib/muscle-tags";
import { getUserTimeZone } from "@/lib/queries/profile";
import {
  addDateKeyDays,
  dateKeyRangeUtc,
  dateKeyToLocalDate,
  formatZonedDate,
  monthStartDateKey,
  startOfWeekDateKey,
  zonedDateKey,
  zonedDateTimeToUtc,
} from "@/lib/time-zone";
import { buildActivityStreak, type CalendarActivity } from "@/lib/calendar";
import { computeStrengthBalance, strengthInputsFromExerciseSets, type StrengthBalanceSummary, type StrengthSetDescriptor } from "@/lib/strength-balance";
import type { MovementPattern, MuscleGroup, MuscleHeatmapDetails, MuscleTag } from "@/types";

// Returns "YYYY-MM-DD" in local time — avoids UTC drift for date-only columns
function localDateStr(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

type DayPlan = {
  hasWorkoutSlot: boolean;
  hasCardioSlot: boolean;
  workoutSatisfiedByRest: boolean;
  cardioSatisfiedByRest: boolean;
};
type SkipOverride = {
  date: string;
  slot: "workout" | "cardio";
};

function normalizeRelation<T>(raw: unknown): T | null {
  if (!raw) return null;
  return (Array.isArray(raw) ? raw[0] : raw) as T;
}

function setLabel(count: number): string {
  return `${count} set${count === 1 ? "" : "s"}`;
}

function weeklyDateLabel(startTime: string, timeZone: string): string {
  return formatZonedDate(startTime, timeZone, {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

const fetchDayPlans = cache(async function fetchDayPlans(): Promise<Map<number, DayPlan>> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("weekly_schedule")
    .select(
      "day_of_week, day_type:day_types!weekly_schedule_day_type_id_fkey(name), cardio_day_type:day_types!weekly_schedule_cardio_day_type_id_fkey(name)"
    )
    .eq("active", true);

  const plans = new Map<number, DayPlan>();

  for (const row of data ?? []) {
    const dt = row.day_type as { name: string } | { name: string }[] | null;
    const cdt = row.cardio_day_type as { name: string } | { name: string }[] | null;
    const workoutName = Array.isArray(dt) ? dt[0]?.name : dt?.name;
    const cardioName = Array.isArray(cdt) ? cdt[0]?.name : cdt?.name;

    plans.set(row.day_of_week, {
      hasWorkoutSlot: true,
      hasCardioSlot: !!cardioName,
      workoutSatisfiedByRest: !workoutName || workoutName === "Rest",
      cardioSatisfiedByRest: cardioName === "Rest",
    });
  }

  return plans;
});

export async function getWeeklyStats() {
  const supabase = await createClient();
  const timeZone = await getUserTimeZone();
  const todayKey = zonedDateKey(new Date(), timeZone);
  const weekStartDate = startOfWeekDateKey(todayKey);
  const weekStart = zonedDateTimeToUtc(weekStartDate, timeZone).toISOString();
  const weekStartDateObj = dateKeyToLocalDate(weekStartDate);

  const [
    { data: activities, error: activitiesError },
    { data: sets, error: setsError },
  ] = await Promise.all([
    supabase
      .from("activities")
      .select("type, distance, duration")
      .gte("start_time", weekStart),
    supabase
      .from("session_sets")
      .select("reps, weight, activities!inner(start_time)")
      .gte("activities.start_time", weekStart),
  ]);

  if (activitiesError) console.error("[query] getWeeklyStats activities failed", activitiesError.message);
  if (setsError) console.error("[query] getWeeklyStats sets failed", setsError.message);

  const runDistance = (activities ?? [])
    .filter((a) => a.type === "run" || a.type === "manual_run")
    .reduce((sum, a) => sum + (a.distance ?? 0), 0) / 1000;

  const sessionCount = (activities ?? []).filter(
    (a) => a.type === "workout" || a.type === "run" || a.type === "manual_run"
  ).length;

  const totalVolume = (sets ?? []).reduce(
    (sum, s) => sum + s.reps * s.weight,
    0
  );

  const lastWeekStart = new Date(weekStartDateObj);
  lastWeekStart.setDate(lastWeekStart.getDate() - 7);
  const lastWeekStartDate = localDateStr(lastWeekStart);

  const [{ data: thisWeekWeights, error: twError }, { data: lastWeekWeights, error: lwError }] = await Promise.all([
    supabase
      .from("daily_checkins")
      .select("body_weight")
      .gte("date", weekStartDate),
    supabase
      .from("daily_checkins")
      .select("body_weight")
      .gte("date", lastWeekStartDate)
      .lt("date", weekStartDate),
  ]);

  if (twError) console.error("[query] getWeeklyStats this-week weight failed", twError.message);
  if (lwError) console.error("[query] getWeeklyStats last-week weight failed", lwError.message);

  const avg = (rows: { body_weight: number }[] | null) => {
    if (!rows || rows.length === 0) return null;
    return rows.reduce((s, r) => s + r.body_weight, 0) / rows.length;
  };

  const thisAvg = avg(thisWeekWeights);
  const lastAvg = avg(lastWeekWeights);
  const weightDelta = thisAvg !== null && lastAvg !== null ? thisAvg - lastAvg : null;

  return { runDistance, sessionCount, totalVolume, weightDelta };
}

export async function getWeeklyMuscleCoverageSummary(): Promise<{
  coverage: Partial<Record<MuscleGroup, number>>;
  details: MuscleHeatmapDetails;
  totalSets: number;
  strengthBalance: StrengthBalanceSummary;
}> {
  const supabase = await createClient();
  const timeZone = await getUserTimeZone();
  const weekStartKey = startOfWeekDateKey(zonedDateKey(new Date(), timeZone));
  const weekStart = zonedDateTimeToUtc(weekStartKey, timeZone).toISOString();

  const { data: sets, error } = await supabase
    .from("session_sets")
    .select("exercise_id, exercise:exercises(name, primary_muscles, secondary_muscles, muscle_tags, movement_pattern), activities!inner(start_time, name)")
    .gte("activities.start_time", weekStart);

  if (error) console.error("[query] getWeeklyMuscleCoverage failed", error.message);

  const coverage: Partial<Record<MuscleGroup, number>> = {};
  const detailBuckets: Partial<Record<MuscleGroup, Map<string, { label: string; count: number; sortTime: number }>>> = {};
  const tagBuckets: Partial<Record<MuscleGroup, Map<MuscleTag, number>>> = {};
  const totalSets = sets?.length ?? 0;
  const balanceRows: StrengthSetDescriptor[] = [];

  for (const set of sets ?? []) {
    const exercise = normalizeRelation<{ name: string | null; primary_muscles: MuscleGroup[]; secondary_muscles: MuscleGroup[]; muscle_tags?: string[]; movement_pattern: MovementPattern }>(set.exercise);
    const activity = normalizeRelation<{ start_time: string; name: string | null }>((set as { activities?: unknown }).activities);
    if (!exercise) continue;
    balanceRows.push({
      exerciseId: set.exercise_id,
      name: exercise.name,
      movementPattern: exercise.movement_pattern,
      primaryMuscles: exercise.primary_muscles,
      secondaryMuscles: exercise.secondary_muscles,
      muscleTags: exercise.muscle_tags,
    });
    addMuscleTagSets(tagBuckets, exercise.muscle_tags);

    const exerciseName = exercise.name ?? "Unknown exercise";
    const dateLabel = activity?.start_time ? weeklyDateLabel(activity.start_time, timeZone) : "Workout";
    const label = `${dateLabel} - ${exerciseName}`;
    const key = `${activity?.start_time ?? "unknown"}:${exerciseName}`;
    const sortTime = activity?.start_time ? new Date(activity.start_time).getTime() : 0;

    for (const muscle of exercise.primary_muscles ?? []) {
      coverage[muscle] = (coverage[muscle] ?? 0) + 1;

      const bucket = detailBuckets[muscle] ?? new Map<string, { label: string; count: number; sortTime: number }>();
      const item = bucket.get(key) ?? { label, count: 0, sortTime };
      item.count += 1;
      bucket.set(key, item);
      detailBuckets[muscle] = bucket;
    }
  }

  const detailMuscles = new Set<MuscleGroup>([
    ...(Object.keys(detailBuckets) as MuscleGroup[]),
    ...(Object.keys(tagBuckets) as MuscleGroup[]),
  ]);

  const details = Object.fromEntries(
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
    coverage,
    details,
    totalSets,
    strengthBalance: computeStrengthBalance(strengthInputsFromExerciseSets(balanceRows), { scopeLabel: "this week", nudgeLimit: 1 }),
  };
}

export async function getWeeklyMuscleCoverage(): Promise<Partial<Record<MuscleGroup, number>>> {
  return (await getWeeklyMuscleCoverageSummary()).coverage;
}

export async function getBodyWeightHistory(days = 30) {
  const supabase = await createClient();
  const timeZone = await getUserTimeZone();
  const sinceKey = addDateKeyDays(zonedDateKey(new Date(), timeZone), -days);

  const { data, error } = await supabase
    .from("daily_checkins")
    .select("date, body_weight")
    .gte("date", sinceKey)
    .order("date", { ascending: true });

  if (error) console.error("[query] getBodyWeightHistory failed", error.message);
  return data ?? [];
}

export async function getActivityStreak() {
  const supabase = await createClient();
  const timeZone = await getUserTimeZone();
  const todayKey = zonedDateKey(new Date(), timeZone);
  const streakStartKey = addDateKeyDays(todayKey, -119);
  const activityRange = dateKeyRangeUtc(streakStartKey, addDateKeyDays(todayKey, 1), timeZone);
  const [{ data, error }, dayPlans, { data: overrides, error: overridesError }] = await Promise.all([
    supabase
      .from("activities")
      .select("start_time, type")
      .gte("start_time", activityRange.start.toISOString())
      .lt("start_time", activityRange.end.toISOString())
      .order("start_time", { ascending: false }),
    fetchDayPlans(),
    supabase
      .from("schedule_overrides")
      .select("date, slot")
      .gte("date", streakStartKey)
      .lte("date", todayKey)
      .is("day_type_id", null),
  ]);

  if (error) console.error("[query] getActivityStreak failed", error.message);
  if (overridesError) console.error("[query] getActivityStreak overrides failed", overridesError.message);

  const activities: CalendarActivity[] = ((data ?? []) as { start_time: string; type: string }[]).map((activity) => ({
    ...activity,
    date: zonedDateKey(activity.start_time, timeZone),
  }));
  const plans = Array.from(dayPlans.entries()).map(([dayOfWeek, plan]) => ({ dayOfWeek, ...plan }));

  return buildActivityStreak(
    activities,
    plans,
    (overrides as SkipOverride[] | null) ?? [],
    dateKeyToLocalDate(todayKey)
  );
}

export type DayPlanEntry = {
  dayOfWeek: number;
  hasWorkoutSlot: boolean;
  hasCardioSlot: boolean;
  workoutSatisfiedByRest: boolean;
  cardioSatisfiedByRest: boolean;
};

export async function getMonthActiveDays(): Promise<{
  activities: CalendarActivity[];
  dayPlans: DayPlanEntry[];
  skipOverrides: SkipOverride[];
  todayKey: string;
}> {
  const supabase = await createClient();
  const timeZone = await getUserTimeZone();
  const todayStr = zonedDateKey(new Date(), timeZone);
  const monthStartStr = monthStartDateKey(todayStr);
  const monthStart = zonedDateTimeToUtc(monthStartStr, timeZone);

  const [{ data, error }, plansMap, { data: overrides, error: overridesError }] = await Promise.all([
    supabase
      .from("activities")
      .select("start_time, type")
      .gte("start_time", monthStart.toISOString()),
    fetchDayPlans(),
    supabase
      .from("schedule_overrides")
      .select("date, slot")
      .gte("date", monthStartStr)
      .lte("date", todayStr)
      .is("day_type_id", null),
  ]);

  if (error) console.error("[query] getMonthActiveDays failed", error.message);
  if (overridesError) console.error("[query] getMonthActiveDays overrides failed", overridesError.message);

  const dayPlans: DayPlanEntry[] = Array.from(plansMap.entries()).map(([dayOfWeek, plan]) => ({
    dayOfWeek,
    ...plan,
  }));

  const activities: CalendarActivity[] = (data ?? []).map((activity) => ({
    ...activity,
    date: zonedDateKey(activity.start_time, timeZone),
  }));

  return { activities, dayPlans, skipOverrides: (overrides as SkipOverride[] | null) ?? [], todayKey: todayStr };
}

export async function getWeekChecklistData() {
  const supabase = await createClient();
  const timeZone = await getUserTimeZone();
  const todayKey = zonedDateKey(new Date(), timeZone);
  const weekStartStr = startOfWeekDateKey(todayKey);
  const weekStart = dateKeyToLocalDate(weekStartStr);
  const weekEndStr = addDateKeyDays(weekStartStr, 6);
  const activityRange = dateKeyRangeUtc(weekStartStr, addDateKeyDays(weekStartStr, 7), timeZone);

  const [scheduleRes, activitiesRes, overridesRes, dayTypesRes] = await Promise.all([
    supabase
      .from("weekly_schedule")
      .select("*, day_type:day_types!weekly_schedule_day_type_id_fkey(*), cardio_day_type:day_types!weekly_schedule_cardio_day_type_id_fkey(*)")
      .eq("active", true),
    supabase
      .from("activities")
      .select("id, type, start_time, day_type_id")
      .gte("start_time", activityRange.start.toISOString())
      .lt("start_time", activityRange.end.toISOString()),
    supabase
      .from("schedule_overrides")
      .select("*")
      .gte("date", weekStartStr)
      .lte("date", weekEndStr),
    supabase
      .from("day_types")
      .select("*")
      .order("name"),
  ]);

  if (scheduleRes.error) console.error("[query] getWeekChecklistData schedule failed", scheduleRes.error.message);
  if (activitiesRes.error) console.error("[query] getWeekChecklistData activities failed", activitiesRes.error.message);
  if (overridesRes.error) console.error("[query] getWeekChecklistData overrides failed", overridesRes.error.message);
  if (dayTypesRes.error) console.error("[query] getWeekChecklistData dayTypes failed", dayTypesRes.error.message);

  return {
    schedule: scheduleRes.data ?? [],
    activities: activitiesRes.data ?? [],
    overrides: overridesRes.data ?? [],
    dayTypes: dayTypesRes.data ?? [],
    weekStart,
    todayKey,
  };
}
