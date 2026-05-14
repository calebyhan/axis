import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { getUserTimeZone } from "@/lib/queries/profile";
import {
  addDateKeyDays,
  dateKeyRangeUtc,
  dateKeyToLocalDate,
  formatZonedDate,
  isoDayFromDateKey,
  monthStartDateKey,
  startOfWeekDateKey,
  zonedDateKey,
  zonedDateTimeToUtc,
} from "@/lib/time-zone";
import { computeStrengthBalance, strengthInputsFromExerciseSets, type StrengthBalanceSummary, type StrengthSetDescriptor } from "@/lib/strength-balance";
import type { MovementPattern, MuscleGroup, MuscleHeatmapDetails } from "@/types";

// Returns "YYYY-MM-DD" in local time — avoids UTC drift for date-only columns
function localDateStr(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

type ActivityKind = "workout" | "cardio";
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

function getActivityKind(type: string): ActivityKind | null {
  if (type === "workout") return "workout";
  if (type === "run" || type === "manual_run" || type === "ride") return "cardio";
  return null;
}

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

function buildDailyKindMap(
  activities: { start_time: string; type: string }[],
  timeZone: string
): Map<string, Set<ActivityKind>> {
  const days = new Map<string, Set<ActivityKind>>();

  for (const activity of activities) {
    const kind = getActivityKind(activity.type);
    if (!kind) continue;
    const key = zonedDateKey(activity.start_time, timeZone);
    const kinds = days.get(key) ?? new Set<ActivityKind>();
    kinds.add(kind);
    days.set(key, kinds);
  }

  return days;
}

function applySkipOverrides(
  days: Map<string, Set<ActivityKind>>,
  overrides: SkipOverride[]
): Map<string, Set<ActivityKind>> {
  const merged = new Map<string, Set<ActivityKind>>();

  for (const [key, kinds] of days) {
    merged.set(key, new Set(kinds));
  }

  for (const override of overrides) {
    const kinds = merged.get(override.date) ?? new Set<ActivityKind>();
    kinds.add(override.slot);
    merged.set(override.date, kinds);
  }

  return merged;
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

function getDayCompletionCount(
  kinds: Set<ActivityKind> | undefined,
  plan?: DayPlan
): number {
  const workoutDone = !!plan?.workoutSatisfiedByRest || !!kinds?.has("workout");
  const cardioDone = !!plan?.cardioSatisfiedByRest || !!kinds?.has("cardio");

  if (plan?.hasWorkoutSlot && plan?.hasCardioSlot) {
    return Number(workoutDone) + Number(cardioDone);
  }

  if (plan?.hasWorkoutSlot) return workoutDone ? 1 : 0;
  if (plan?.hasCardioSlot) return cardioDone ? 1 : 0;

  return kinds ? kinds.size : 0;
}

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
    (a) => a.type === "workout"
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
    .select("exercise_id, exercise:exercises(name, primary_muscles, secondary_muscles, movement_pattern), activities!inner(start_time, name)")
    .gte("activities.start_time", weekStart);

  if (error) console.error("[query] getWeeklyMuscleCoverage failed", error.message);

  const coverage: Partial<Record<MuscleGroup, number>> = {};
  const detailBuckets: Partial<Record<MuscleGroup, Map<string, { label: string; count: number; sortTime: number }>>> = {};
  const totalSets = sets?.length ?? 0;
  const balanceRows: StrengthSetDescriptor[] = [];

  for (const set of sets ?? []) {
    const exercise = normalizeRelation<{ name: string | null; primary_muscles: MuscleGroup[]; secondary_muscles: MuscleGroup[]; movement_pattern: MovementPattern }>(set.exercise);
    const activity = normalizeRelation<{ start_time: string; name: string | null }>((set as { activities?: unknown }).activities);
    if (!exercise) continue;
    balanceRows.push({
      exerciseId: set.exercise_id,
      name: exercise.name,
      movementPattern: exercise.movement_pattern,
      primaryMuscles: exercise.primary_muscles,
      secondaryMuscles: exercise.secondary_muscles,
    });

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

  const details = Object.fromEntries(
    Object.entries(detailBuckets).map(([muscle, bucket]) => [
      muscle,
      {
        items: Array.from(bucket.values())
          .sort((a, b) => b.sortTime - a.sortTime || b.count - a.count || a.label.localeCompare(b.label))
          .map((item) => `${item.label} (${setLabel(item.count)})`),
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
  const since = new Date();
  since.setDate(since.getDate() - days);

  const { data, error } = await supabase
    .from("daily_checkins")
    .select("date, body_weight")
    .gte("date", localDateStr(since))
    .order("date", { ascending: true });

  if (error) console.error("[query] getBodyWeightHistory failed", error.message);
  return data ?? [];
}

export async function getActivityStreak() {
  const supabase = await createClient();
  const timeZone = await getUserTimeZone();
  const todayKey = zonedDateKey(new Date(), timeZone);
  const weekStart = startOfWeekDateKey(todayKey);
  const [{ data, error }, dayPlans, { data: overrides, error: overridesError }] = await Promise.all([
    supabase
      .from("activities")
      .select("start_time, type")
      .order("start_time", { ascending: false })
      .limit(120),
    fetchDayPlans(),
    supabase
      .from("schedule_overrides")
      .select("date, slot")
      .gte("date", weekStart)
      .lte("date", todayKey)
      .is("day_type_id", null),
  ]);

  if (error) console.error("[query] getActivityStreak failed", error.message);
  if (overridesError) console.error("[query] getActivityStreak overrides failed", overridesError.message);

  const activityDays = applySkipOverrides(buildDailyKindMap(data ?? [], timeZone), (overrides as SkipOverride[] | null) ?? []);
  let streak = 0;

  for (let i = 0; i < 120; i++) {
    const key = addDateKeyDays(todayKey, -i);
    const kinds = activityDays.get(key);
    const plan = key >= weekStart ? dayPlans.get(isoDayFromDateKey(key)) : undefined;
    const completionCount = getDayCompletionCount(kinds, plan);
    const requiredCount = plan?.hasWorkoutSlot && plan?.hasCardioSlot ? 2 : 1;

    if (completionCount >= requiredCount && requiredCount > 0) {
      streak++;
    } else if (i > 0) {
      break;
    }
  }

  return streak;
}

export type DayPlanEntry = {
  dayOfWeek: number;
  hasWorkoutSlot: boolean;
  hasCardioSlot: boolean;
  workoutSatisfiedByRest: boolean;
  cardioSatisfiedByRest: boolean;
};

export async function getMonthActiveDays(): Promise<{
  activities: { start_time: string; type: string }[];
  dayPlans: DayPlanEntry[];
  skipOverrides: SkipOverride[];
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

  return { activities: data ?? [], dayPlans, skipOverrides: (overrides as SkipOverride[] | null) ?? [] };
}

export async function getWeekChecklistData() {
  const supabase = await createClient();
  const timeZone = await getUserTimeZone();
  const weekStartStr = startOfWeekDateKey(zonedDateKey(new Date(), timeZone));
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
  };
}
