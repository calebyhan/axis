import { createClient } from "@/lib/supabase/server";
import { computeE1RM } from "@/lib/e1rm";

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

function getISOWeek(date: Date): string {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + 4 - ((d.getDay() || 7) - 1));
  const yearStart = new Date(d.getFullYear(), 0, 1);
  const weekNo = Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
  return `${d.getFullYear()}-W${String(weekNo).padStart(2, "0")}`;
}
