import { createClient } from "@/lib/supabase/server";

// Returns "YYYY-MM-DD" in local time — avoids UTC drift for date-only columns
function localDateStr(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

export async function getWeeklyStats() {
  const supabase = await createClient();
  const now = new Date();
  const monday = new Date(now);
  monday.setDate(now.getDate() - ((now.getDay() + 6) % 7));
  monday.setHours(0, 0, 0, 0);
  const weekStart = monday.toISOString();
  const weekStartDate = localDateStr(monday);

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

  const lastWeekStart = new Date(monday);
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
  const { data, error } = await supabase
    .from("activities")
    .select("start_time")
    .order("start_time", { ascending: false })
    .limit(60);

  if (error) console.error("[query] getActivityStreak failed", error.message);
  if (!data || data.length === 0) return 0;

  const days = new Set(
    data.map((a) => a.start_time.split("T")[0])
  );

  let streak = 0;
  const today = new Date();

  for (let i = 0; i < 60; i++) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const key = d.toISOString().split("T")[0];
    if (days.has(key)) {
      streak++;
    } else if (i > 0) {
      break;
    }
  }

  return streak;
}

export async function getWeekChecklistData() {
  const supabase = await createClient();
  const now = new Date();
  const monday = new Date(now);
  monday.setDate(now.getDate() - ((now.getDay() + 6) % 7));
  monday.setHours(0, 0, 0, 0);

  const [scheduleRes, activitiesRes] = await Promise.all([
    supabase
      .from("weekly_schedule")
      .select("*, day_type:day_types!weekly_schedule_day_type_id_fkey(*)")
      .eq("active", true),
    supabase
      .from("activities")
      .select("id, type, start_time, day_type_id")
      .gte("start_time", monday.toISOString()),
  ]);

  if (scheduleRes.error) console.error("[query] getWeekChecklistData schedule failed", scheduleRes.error.message);
  if (activitiesRes.error) console.error("[query] getWeekChecklistData activities failed", activitiesRes.error.message);

  return {
    schedule: scheduleRes.data ?? [],
    activities: activitiesRes.data ?? [],
  };
}
