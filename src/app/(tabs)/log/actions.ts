"use server";

import { revalidatePath } from "next/cache";
import { getSession } from "@/lib/supabase/server";
import { normalizeTimeZone } from "@/lib/time-zone";

interface WorkoutSetPayload {
  exercise_id: string;
  set_number: number;
  reps: number;
  weight: number;
  rpe: number;
}

interface SaveWorkoutPayload {
  start_time: string;
  duration: number;
  day_type_id: string | null;
  sets: WorkoutSetPayload[];
  timezone?: string;
}

interface SaveManualRunPayload {
  start_time?: string;
  duration: number;
  distance: number;
  suffer_score: number;
  notes: string | null;
  timezone?: string;
}

interface SaveBodyWeightPayload {
  date: string;
  body_weight: number;
}

async function rememberTimeZone(
  supabase: Awaited<ReturnType<typeof getSession>>["supabase"],
  userId: string,
  timeZone: string | null | undefined
) {
  const normalized = normalizeTimeZone(timeZone);
  if (!normalized) return;

  const { error } = await supabase.from("notification_preferences").upsert(
    {
      user_id: userId,
      timezone: normalized,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id" }
  );

  if (error) {
    console.warn("[action] timezone preference update failed", error.message);
  }
}

export async function saveWorkoutSession(payload: SaveWorkoutPayload): Promise<{ activityId: string | null; error: string | null }> {
  const { supabase, user } = await getSession();
  if (!user) return { activityId: null, error: "Not authenticated" };

  const startTime = new Date(payload.start_time);
  if (Number.isNaN(startTime.getTime())) {
    return { activityId: null, error: "Invalid session start time" };
  }

  if (!Number.isFinite(payload.duration) || payload.duration < 0) {
    return { activityId: null, error: "Invalid session duration" };
  }

  if (payload.sets.length === 0) {
    return { activityId: null, error: "Log at least one set before saving." };
  }

  for (const set of payload.sets) {
    if (!set.exercise_id) {
      return { activityId: null, error: "Invalid exercise in session." };
    }
    if (!Number.isInteger(set.set_number) || set.set_number <= 0) {
      return { activityId: null, error: "Invalid set number." };
    }
    if (!Number.isInteger(set.reps) || set.reps <= 0) {
      return { activityId: null, error: "Reps must be greater than zero." };
    }
    if (!Number.isFinite(set.weight) || set.weight < 0) {
      return { activityId: null, error: "Weight cannot be negative." };
    }
    if (!Number.isFinite(set.rpe) || set.rpe < 1 || set.rpe > 10) {
      return { activityId: null, error: "RPE must be between 1 and 10." };
    }
  }

  await rememberTimeZone(supabase, user.id, payload.timezone);

  const sets = payload.sets.map((set) => ({
    exercise_id: set.exercise_id,
    set_number: set.set_number,
    reps: set.reps,
    weight: set.weight,
    rpe: set.rpe,
  }));

  const { data, error } = await supabase.rpc("save_workout_session", {
    p_start_time: startTime.toISOString(),
    p_duration: Math.floor(payload.duration),
    p_day_type_id: payload.day_type_id,
    p_sets: sets,
  });

  if (error) {
    console.error("[action] saveWorkoutSession failed", error.message);
    return { activityId: null, error: "Failed to save session. Your draft is preserved - reopen to retry." };
  }

  revalidatePath("/dashboard");
  revalidatePath("/activity");
  revalidatePath("/stats");

  return { activityId: data as string, error: null };
}

export async function saveManualRun(payload: SaveManualRunPayload): Promise<{ error: string | null }> {
  const { supabase, user } = await getSession();
  if (!user) return { error: "Not authenticated" };

  const startTime = new Date(payload.start_time ?? Date.now());
  if (Number.isNaN(startTime.getTime())) {
    return { error: "Invalid run start time." };
  }

  if (!Number.isFinite(payload.duration) || payload.duration <= 0) {
    return { error: "Enter a valid duration." };
  }

  if (!Number.isFinite(payload.distance) || payload.distance <= 0) {
    return { error: "Enter a valid distance." };
  }

  await rememberTimeZone(supabase, user.id, payload.timezone);

  const { error } = await supabase.from("activities").insert({
    user_id: user.id,
    type: "manual_run",
    source: "manual",
    start_time: startTime.toISOString(),
    duration: Math.floor(payload.duration),
    distance: payload.distance,
    suffer_score: payload.suffer_score,
    notes: payload.notes,
  });

  if (error) {
    console.error("[action] saveManualRun failed", error.message);
    return { error: "Failed to save run. Please try again." };
  }

  revalidatePath("/dashboard");
  revalidatePath("/activity");
  revalidatePath("/stats");
  return { error: null };
}

export async function saveBodyWeight(payload: SaveBodyWeightPayload): Promise<{ error: string | null }> {
  const { supabase, user } = await getSession();
  if (!user) return { error: "Not authenticated" };

  if (!/^\d{4}-\d{2}-\d{2}$/.test(payload.date)) {
    return { error: "Invalid date." };
  }

  if (!Number.isFinite(payload.body_weight) || payload.body_weight <= 0) {
    return { error: "Enter a valid weight." };
  }

  const { error } = await supabase.from("daily_checkins").upsert(
    {
      user_id: user.id,
      date: payload.date,
      body_weight: payload.body_weight,
      notes: null,
    },
    { onConflict: "user_id,date" }
  );

  if (error) {
    console.error("[action] saveBodyWeight failed", error.message);
    return { error: "Failed to save weight. Please try again." };
  }

  revalidatePath("/dashboard");
  revalidatePath("/log");
  revalidatePath("/stats");
  return { error: null };
}

export async function deleteBodyWeight(date: string): Promise<{ error: string | null }> {
  const { supabase, user } = await getSession();
  if (!user) return { error: "Not authenticated" };

  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return { error: "Invalid date." };
  }

  const { error } = await supabase
    .from("daily_checkins")
    .delete()
    .eq("user_id", user.id)
    .eq("date", date);

  if (error) {
    console.error("[action] deleteBodyWeight failed", error.message);
    return { error: "Failed to delete weight. Please try again." };
  }

  revalidatePath("/dashboard");
  revalidatePath("/log");
  revalidatePath("/stats");
  return { error: null };
}
