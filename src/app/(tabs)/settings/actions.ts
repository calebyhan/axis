"use server";

import { createClient } from "@/lib/supabase/server";
import type { AccentColor, Units } from "@/types";

interface ProfilePayload {
  units: Units;
  accent_color: AccentColor;
  weight_increment_upper: number;
  weight_increment_lower: number;
  ohp_bench_ratio: number;
  dl_squat_ratio: number;
  volume_ceiling: number;
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
  return { error: null };
}
