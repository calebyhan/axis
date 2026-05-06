"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { AccentColor, Units } from "@/types";

interface ProfilePayload {
  units?: Units;
  accent_color?: AccentColor;
  display_name?: string | null;
}

function localDateStr(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function startOfWeek(today = new Date()): Date {
  const sunday = new Date(today);
  sunday.setDate(today.getDate() - today.getDay());
  sunday.setHours(0, 0, 0, 0);
  return sunday;
}

async function invalidateCurrentAndFuturePlannedSlots(supabase: Awaited<ReturnType<typeof createClient>>, userId: string) {
  const { error } = await supabase
    .from("planned_slots")
    .delete()
    .eq("user_id", userId)
    .gte("week_start", localDateStr(startOfWeek()));
  if (error) console.error("[settings] planned slot invalidation failed", error.message);
}

export async function saveProfile(payload: ProfilePayload): Promise<{ error: string | null }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const { error } = await supabase
    .from("profiles")
    .upsert(
      {
        id: user.id,
        ...payload,
      },
      { onConflict: "id" }
    );

  if (error) return { error: error.message };
  return { error: null };
}

export async function saveWeeklyScheduleDay(payload: {
  day_of_week: number;
  day_type_id: string | null;
  cardio_day_type_id: string | null;
}): Promise<{ error: string | null }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  if (!payload.day_type_id && !payload.cardio_day_type_id) {
    const { error } = await supabase
      .from("weekly_schedule")
      .delete()
      .eq("user_id", user.id)
      .eq("day_of_week", payload.day_of_week);

    if (error) return { error: error.message };
    await invalidateCurrentAndFuturePlannedSlots(supabase, user.id);
    revalidatePath("/dashboard");
    revalidatePath("/stats");
    return { error: null };
  }

  const { error } = await supabase
    .from("weekly_schedule")
    .upsert(
      {
        user_id: user.id,
        day_of_week: payload.day_of_week,
        day_type_id: payload.day_type_id,
        cardio_day_type_id: payload.cardio_day_type_id,
      },
      { onConflict: "user_id,day_of_week" }
    );

  if (error) return { error: error.message };
  await invalidateCurrentAndFuturePlannedSlots(supabase, user.id);
  revalidatePath("/dashboard");
  revalidatePath("/stats");
  return { error: null };
}
