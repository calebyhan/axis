import { createClient } from "@/lib/supabase/server";
import { computeE1RM } from "@/lib/e1rm";
import { computeATLCTLTSB, normalizeStrengthTL, type DailyLoad } from "@/lib/training-load";
import type { MuscleGroup, MuscleHeatmapDetails } from "@/types";

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
        .select("reps, weight, exercise_id, exercises!inner(name, primary_muscles), activities!inner(start_time, type)")
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
  let totalSets = 0;
  let totalVolume = 0;

  for (const s of sets) {
    const ex = normalizeRelation<{ name: string; primary_muscles: MuscleGroup[] }>(s.exercises);
    const activity = normalizeRelation<{ start_time: string }>(s.activities);
    if (!ex) continue;

    const vol = s.reps * s.weight;
    const existing = exerciseVolume.get(s.exercise_id) ?? { name: ex.name, volume: 0, sets: 0 };
    exerciseVolume.set(s.exercise_id, { name: ex.name, volume: existing.volume + vol, sets: existing.sets + 1 });
    totalSets++;
    totalVolume += vol;

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

  const muscleDetails = Object.fromEntries(
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
    sessionCount: sessionRes.count ?? 0,
    totalSets,
    totalVolume: Math.round(totalVolume),
    topExercises,
    muscleCoverage: coverage,
    muscleDetails,
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

function getISOWeek(date: Date): string {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + 4 - ((d.getDay() || 7) - 1));
  const yearStart = new Date(d.getFullYear(), 0, 1);
  const weekNo = Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
  return `${d.getFullYear()}-W${String(weekNo).padStart(2, "0")}`;
}
