import { createClient } from "@/lib/supabase/server";
import { computeE1RM } from "@/lib/e1rm";
import type { CalendarActivity, CalendarDayPlan, CalendarSkipOverride } from "@/lib/calendar";
import { getUserTimeZone } from "@/lib/queries/profile";
import { zonedDateKey } from "@/lib/time-zone";
import { computeStrengthBalance, strengthInputsFromExerciseSets, type StrengthSetDescriptor } from "@/lib/strength-balance";
import { addMuscleTagSets, muscleTagSummaries } from "@/lib/muscle-tags";
import { computeATLCTLTSB, normalizeStrengthTL, type DailyLoad } from "@/lib/training-load";
import type { MovementPattern, MuscleGroup, MuscleHeatmapDetails, MuscleTag } from "@/types";

export type TimeRange = "week" | "month" | "year" | "all";

function getStartDate(range: TimeRange): string | null {
  const now = new Date();
  if (range === "all") return null;
  if (range === "week") {
    const d = new Date(now);
    d.setDate(d.getDate() - 7);
    return d.toISOString();
  }
  if (range === "month") {
    const d = new Date(now);
    d.setMonth(d.getMonth() - 1);
    return d.toISOString();
  }
  const d = new Date(now);
  d.setFullYear(d.getFullYear() - 1);
  return d.toISOString();
}

function normalizeRelation<T>(raw: unknown): T | null {
  if (!raw) return null;
  return (Array.isArray(raw) ? raw[0] : raw) as T;
}

function setLabel(count: number): string {
  return `${count} set${count === 1 ? "" : "s"}`;
}

function workoutDateLabel(startTime: string): string {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
  }).format(new Date(startTime));
}

export async function getVolumeOverTime(range: TimeRange) {
  const supabase = await createClient();
  const since = getStartDate(range);

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
    const week = getISOWeek(new Date(act.start_time));
    weekly.set(week, (weekly.get(week) ?? 0) + s.reps * s.weight);
  }

  return Array.from(weekly.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([week, volume]) => ({ week, volume: Math.round(volume) }));
}

export async function getRunningStats(range: TimeRange) {
  const supabase = await createClient();
  const since = getStartDate(range);

  let query = supabase
    .from("activities")
    .select("id, name, start_time, distance, avg_pace, suffer_score, duration, avg_heartrate, best_efforts")
    .in("type", ["run", "manual_run"])
    .order("start_time");

  if (since) query = query.gte("start_time", since);

  const { data, error } = await query;
  if (error) console.error("[query] getRunningStats failed", error.message);
  return data ?? [];
}

export async function getBodyWeightStats(range: TimeRange) {
  const supabase = await createClient();
  const since = getStartDate(range);

  let query = supabase
    .from("daily_checkins")
    .select("date, body_weight")
    .order("date");

  if (since) query = query.gte("date", since.split("T")[0]);

  const { data, error } = await query;
  if (error) console.error("[query] getBodyWeightStats failed", error.message);
  return data ?? [];
}

export async function getE1RMHistory(exerciseId: string, range: TimeRange) {
  const supabase = await createClient();
  const since = getStartDate(range);

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
    const day = act.start_time.split("T")[0];
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
  const since = getStartDate(range);

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
    });
    addMuscleTagSets(tagBuckets, ex.muscle_tags);

    const dateLabel = activity?.start_time ? workoutDateLabel(activity.start_time) : "Workout";
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
  const since = new Date();
  since.setDate(since.getDate() - (getTrainingLoadWindow(range) - 1));
  since.setHours(0, 0, 0, 0);
  const sinceISO = since.toISOString();

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

  const dayLoads = new Map<string, { runTL: number; strengthTL: number }>();

  for (const a of activitiesRes.data ?? []) {
    const day = a.start_time.split("T")[0];
    const entry = dayLoads.get(day) ?? { runTL: 0, strengthTL: 0 };
    entry.runTL = Math.min(200, entry.runTL + (a.suffer_score ?? 0));
    dayLoads.set(day, entry);
  }

  for (const s of setsRes.data ?? []) {
    const actRaw = s.activities as unknown;
    const act = (Array.isArray(actRaw) ? actRaw[0] : actRaw) as { start_time: string };
    const day = act.start_time.split("T")[0];
    const entry = dayLoads.get(day) ?? { runTL: 0, strengthTL: 0 };
    const rpe = (s as { rpe?: number }).rpe ?? 7;
    entry.strengthTL += s.reps * s.weight * rpe;
    dayLoads.set(day, entry);
  }

  const loads: DailyLoad[] = [];
  const cursor = new Date(since);
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  while (cursor <= today) {
    const date = cursor.toISOString().split("T")[0];
    const { runTL, strengthTL } = dayLoads.get(date) ?? { runTL: 0, strengthTL: 0 };
    loads.push({
      date,
      runTL,
      strengthTL: normalizeStrengthTL(strengthTL),
    });
    cursor.setDate(cursor.getDate() + 1);
  }

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
  const since = getStartDate(range);
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
    overridesQuery = overridesQuery.gte("date", since.split("T")[0]);
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

function getISOWeek(date: Date): string {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + 4 - ((d.getDay() || 7) - 1));
  const yearStart = new Date(d.getFullYear(), 0, 1);
  const weekNo = Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
  return `${d.getFullYear()}-W${String(weekNo).padStart(2, "0")}`;
}
