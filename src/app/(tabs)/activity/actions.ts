"use server";

import { getSession } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

interface WorkoutSetPayload {
  exercise_id: string;
  set_number: number;
  reps: number;
  weight: number;
  rpe: number;
}

export async function deleteActivity(activityId: string): Promise<{ error: string | null }> {
  const { supabase, user } = await getSession();
  if (!user) return { error: "Not authenticated" };

  // session_sets cascade deletes via FK, so deleting the activity is sufficient
  const { error } = await supabase
    .from("activities")
    .delete()
    .eq("id", activityId);

  if (error) return { error: error.message };

  redirect("/activity");
}

export async function updateWorkoutSession(
  activityId: string,
  setsPayload: WorkoutSetPayload[]
): Promise<{ error: string | null }> {
  const { supabase, user } = await getSession();
  if (!user) return { error: "Not authenticated" };

  if (!activityId) {
    return { error: "Invalid workout." };
  }

  if (setsPayload.length === 0) {
    return { error: "A workout needs at least one set." };
  }

  for (const set of setsPayload) {
    if (!set.exercise_id) {
      return { error: "Invalid exercise in workout." };
    }
    if (!Number.isInteger(set.set_number) || set.set_number <= 0) {
      return { error: "Invalid set number." };
    }
    if (!Number.isInteger(set.reps) || set.reps <= 0) {
      return { error: "Reps must be greater than zero." };
    }
    if (!Number.isFinite(set.weight) || set.weight < 0) {
      return { error: "Weight cannot be negative." };
    }
    if (!Number.isFinite(set.rpe) || set.rpe < 1 || set.rpe > 10) {
      return { error: "RPE must be between 1 and 10." };
    }
  }

  const sets = setsPayload.map((set) => ({
    exercise_id: set.exercise_id,
    set_number: set.set_number,
    reps: set.reps,
    weight: set.weight,
    rpe: set.rpe,
  }));

  const { error } = await supabase.rpc("update_workout_session", {
    p_activity_id: activityId,
    p_sets: sets,
  });

  if (error) {
    console.error("[action] updateWorkoutSession failed", error.message);
    return { error: "Failed to update workout. Please try again." };
  }

  revalidatePath("/dashboard");
  revalidatePath("/activity");
  revalidatePath(`/activity/${activityId}`);
  revalidatePath("/stats");
  return { error: null };
}
