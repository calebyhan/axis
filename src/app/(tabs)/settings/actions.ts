"use server";

import { revalidatePath } from "next/cache";
import { getSession } from "@/lib/supabase/server";
import type { AccentColor, Units } from "@/types";

interface ProfilePayload {
  units?: Units;
  accent_color?: AccentColor;
  display_name?: string | null;
}

interface NotificationPreferencesPayload {
  enabled?: boolean;
  today_plan_enabled?: boolean;
  today_plan_time?: string;
  pending_strava_enabled?: boolean;
  plan_nudge_enabled?: boolean;
  plan_nudge_time?: string;
  weekly_review_enabled?: boolean;
  weekly_review_day?: number;
  weekly_review_time?: string;
  timezone?: string;
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

async function invalidateCurrentAndFuturePlannedSlots(supabase: Awaited<ReturnType<typeof getSession>>["supabase"], userId: string) {
  const { error } = await supabase
    .from("planned_slots")
    .delete()
    .eq("user_id", userId)
    .gte("week_start", localDateStr(startOfWeek()));
  if (error) console.error("[settings] planned slot invalidation failed", error.message);
}

export async function saveProfile(payload: ProfilePayload): Promise<{ error: string | null }> {
  const { supabase, user } = await getSession();
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
  const { supabase, user } = await getSession();
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

function validTime(value: string | undefined): boolean {
  return value === undefined || /^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/.test(value);
}

export async function saveNotificationPreferences(
  payload: NotificationPreferencesPayload
): Promise<{ error: string | null }> {
  const { supabase, user } = await getSession();
  if (!user) return { error: "Not authenticated" };

  if (
    !validTime(payload.today_plan_time) ||
    !validTime(payload.plan_nudge_time) ||
    !validTime(payload.weekly_review_time)
  ) {
    return { error: "Invalid notification time." };
  }

  if (
    payload.weekly_review_day !== undefined &&
    (!Number.isInteger(payload.weekly_review_day) || payload.weekly_review_day < 0 || payload.weekly_review_day > 6)
  ) {
    return { error: "Invalid weekly review day." };
  }

  const update: NotificationPreferencesPayload & { user_id: string; updated_at: string } = {
    user_id: user.id,
    ...payload,
    updated_at: new Date().toISOString(),
  };
  if (payload.timezone !== undefined) {
    update.timezone = payload.timezone.slice(0, 100);
  }

  const { error } = await supabase
    .from("notification_preferences")
    .upsert(update, { onConflict: "user_id" });

  if (error) return { error: error.message };
  revalidatePath("/settings");
  return { error: null };
}
