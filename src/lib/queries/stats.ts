import { createClient } from "@/lib/supabase/server";
import { computeE1RM } from "@/lib/e1rm";
import { computeATLCTLTSB, normalizeStrengthTL, type DailyLoad } from "@/lib/training-load";

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
    .select("start_time, distance, avg_pace, suffer_score, duration, avg_heartrate")
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
        .select("reps, weight, exercise_id, exercises!inner(name), activities!inner(start_time, type)")
        .eq("activities.type", "workout");
      if (since) q = q.gte("activities.start_time", since);
      return q;
    })(),
  ]);

  if (setsRes.error) console.error("[query] getWorkoutSummary failed", setsRes.error.message);
  const sets = setsRes.data ?? [];

  const exerciseVolume = new Map<string, { name: string; volume: number; sets: number }>();
  let totalSets = 0;
  let totalVolume = 0;

  for (const s of sets) {
    const exRaw = s.exercises as unknown;
    const ex = (Array.isArray(exRaw) ? exRaw[0] : exRaw) as { name: string };
    const vol = s.reps * s.weight;
    const existing = exerciseVolume.get(s.exercise_id) ?? { name: ex.name, volume: 0, sets: 0 };
    exerciseVolume.set(s.exercise_id, { name: ex.name, volume: existing.volume + vol, sets: existing.sets + 1 });
    totalSets++;
    totalVolume += vol;
  }

  const topExercises = Array.from(exerciseVolume.values())
    .sort((a, b) => b.volume - a.volume)
    .slice(0, 5)
    .map((e) => ({ name: e.name, volume: Math.round(e.volume), sets: e.sets }));

  return {
    sessionCount: sessionRes.count ?? 0,
    totalSets,
    totalVolume: Math.round(totalVolume),
    topExercises,
  };
}

export async function getTrainingLoadHistory() {
  const supabase = await createClient();
  const since = new Date();
  since.setDate(since.getDate() - 90);
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

  const loads: DailyLoad[] = Array.from(dayLoads.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, { runTL, strengthTL }]) => ({
      date,
      runTL,
      strengthTL: normalizeStrengthTL(strengthTL),
    }));

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
