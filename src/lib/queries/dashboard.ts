import { cache } from "react";
import { createClient } from "@/lib/supabase/server";

// Returns "YYYY-MM-DD" in local time — avoids UTC drift for date-only columns
function localDateStr(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

// Returns the Sunday that starts the current Sun–Sat week (local time)
function startOfCurrentWeek(today = new Date()): Date {
  const sunday = new Date(today);
  sunday.setDate(today.getDate() - today.getDay()); // JS getDay(): 0=Sun, so this always lands on Sunday
  sunday.setHours(0, 0, 0, 0);
  return sunday;
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

function buildDailyKindMap(
  activities: { start_time: string; type: string }[]
): Map<string, Set<ActivityKind>> {
  const days = new Map<string, Set<ActivityKind>>();

  for (const activity of activities) {
    const kind = getActivityKind(activity.type);
    if (!kind) continue;
    const key = activity.start_time.split("T")[0];
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
      hasWorkoutSlot: !!workoutName,
      hasCardioSlot: !!cardioName,
      workoutSatisfiedByRest: workoutName === "Rest",
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
  const now = new Date();
  const weekStartDateObj = startOfCurrentWeek(now);
  const weekStart = weekStartDateObj.toISOString();
  const weekStartDate = localDateStr(weekStartDateObj);

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
  const today = new Date();
  const weekStart = localDateStr(startOfCurrentWeek(today));
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
      .lte("date", localDateStr(today))
      .is("day_type_id", null),
  ]);

  if (error) console.error("[query] getActivityStreak failed", error.message);
  if (overridesError) console.error("[query] getActivityStreak overrides failed", overridesError.message);

  const activityDays = applySkipOverrides(buildDailyKindMap(data ?? []), (overrides as SkipOverride[] | null) ?? []);
  let streak = 0;

  for (let i = 0; i < 120; i++) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const key = localDateStr(d);
    const kinds = activityDays.get(key);
    const plan = key >= weekStart ? dayPlans.get((d.getDay() + 6) % 7) : undefined;
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
  const now = new Date();
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const monthStartStr = localDateStr(new Date(now.getFullYear(), now.getMonth(), 1));
  const todayStr = localDateStr(now);

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
  const weekStart = startOfCurrentWeek();
  const weekStartStr = localDateStr(weekStart);
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekEnd.getDate() + 6);
  const weekEndStr = localDateStr(weekEnd);

  const [scheduleRes, activitiesRes, overridesRes, dayTypesRes] = await Promise.all([
    supabase
      .from("weekly_schedule")
      .select("*, day_type:day_types!weekly_schedule_day_type_id_fkey(*), cardio_day_type:day_types!weekly_schedule_cardio_day_type_id_fkey(*)")
      .eq("active", true),
    supabase
      .from("activities")
      .select("id, type, start_time, day_type_id")
      .gte("start_time", weekStart.toISOString())
      .lt("start_time", new Date(weekStart.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString()),
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
