import { createClient } from "@/lib/supabase/server";
import type { MuscleGroup } from "@/types";

export async function getActivitiesFeed(type?: "run" | "workout", limit = 30) {
  const supabase = await createClient();

  let query = supabase
    .from("activities")
    .select("*")
    .order("start_time", { ascending: false })
    .limit(limit);

  if (type === "run") {
    query = query.in("type", ["run", "manual_run"]);
  } else if (type === "workout") {
    query = query.eq("type", "workout");
  }

  const { data, error } = await query;
  if (error) console.error("[query] getActivitiesFeed failed", error.message);
  return data ?? [];
}

export async function getActivityWithSets(activityId: string) {
  const supabase = await createClient();

  const [{ data: activity, error: activityError }, { data: sets, error: setsError }] = await Promise.all([
    supabase.from("activities").select("*").eq("id", activityId).single(),
    supabase
      .from("session_sets")
      .select("*, exercise:exercises(*)")
      .eq("activity_id", activityId)
      .order("set_number"),
  ]);

  if (activityError) console.error("[query] getActivityWithSets activity failed", activityError.message);
  if (setsError) console.error("[query] getActivityWithSets sets failed", setsError.message);

  return { activity, sets: sets ?? [] };
}

export async function getWorkoutMuscleCoverage(activityId: string): Promise<Partial<Record<MuscleGroup, number>>> {
  const supabase = await createClient();
  const { data: sets, error } = await supabase
    .from("session_sets")
    .select("exercise:exercises(primary_muscles, secondary_muscles)")
    .eq("activity_id", activityId);

  if (error) console.error("[query] getWorkoutMuscleCoverage failed", error.message);

  const coverage: Partial<Record<MuscleGroup, number>> = {};
  for (const s of sets ?? []) {
    const exRaw = s.exercise as unknown;
    const ex = (Array.isArray(exRaw) ? exRaw[0] : exRaw) as { primary_muscles: MuscleGroup[]; secondary_muscles: MuscleGroup[] } | null;
    if (!ex) continue;
    for (const m of ex.primary_muscles ?? []) {
      coverage[m] = (coverage[m] ?? 0) + 1;
    }
  }
  return coverage;
}

export async function getWorkoutCoverageAndStats(activityId: string): Promise<{
  coverage: Partial<Record<MuscleGroup, number>>;
  exerciseCount: number;
  totalVolume: number;
}> {
  const supabase = await createClient();
  const { data: sets, error } = await supabase
    .from("session_sets")
    .select("exercise_id, weight, reps, exercise:exercises(primary_muscles, secondary_muscles)")
    .eq("activity_id", activityId);

  if (error) console.error("[query] getWorkoutCoverageAndStats failed", error.message);

  const coverage: Partial<Record<MuscleGroup, number>> = {};
  const exerciseIds = new Set<string>();
  let totalVolume = 0;

  for (const s of sets ?? []) {
    exerciseIds.add(s.exercise_id);
    totalVolume += (s.weight ?? 0) * (s.reps ?? 0);

    const exRaw = s.exercise as unknown;
    const ex = (Array.isArray(exRaw) ? exRaw[0] : exRaw) as { primary_muscles: MuscleGroup[]; secondary_muscles: MuscleGroup[] } | null;
    if (!ex) continue;
    for (const m of ex.primary_muscles ?? []) {
      coverage[m] = (coverage[m] ?? 0) + 1;
    }
  }

  return { coverage, exerciseCount: exerciseIds.size, totalVolume };
}
