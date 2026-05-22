"use server";

import { revalidatePath } from "next/cache";
import { getSession } from "@/lib/supabase/server";
import { getUserTimeZone } from "@/lib/queries/profile";
import { startOfWeekDateKey, zonedDateKey } from "@/lib/time-zone";
import { normalizeHRZoneMethod, normalizeHRZones, normalizeMaxHeartRate, type HRZone, type HRZoneMethod } from "@/lib/hr-zones";
import { normalizePaceZones, type PaceZone } from "@/lib/pace-zones";
import type { AccentColor, Units } from "@/types";

interface ProfilePayload {
  units?: Units;
  accent_color?: AccentColor;
  display_name?: string | null;
  hr_zones?: HRZone[] | null;
  hr_zone_method?: HRZoneMethod;
  max_heart_rate?: number;
  pace_zones?: PaceZone[] | null;
  ignored_hr_zone_suggestion_hash?: string | null;
  ignored_pace_zone_suggestion_hash?: string | null;
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

async function invalidateCurrentAndFuturePlannedSlots(supabase: Awaited<ReturnType<typeof getSession>>["supabase"], userId: string) {
  const timeZone = await getUserTimeZone();
  const currentWeekStart = startOfWeekDateKey(zonedDateKey(new Date(), timeZone));
  const { error } = await supabase
    .from("planned_slots")
    .delete()
    .eq("user_id", userId)
    .gte("week_start", currentWeekStart);
  if (error) console.error("[settings] planned slot invalidation failed", error.message);
}

export async function saveProfile(payload: ProfilePayload): Promise<{ error: string | null }> {
  const { supabase, user } = await getSession();
  if (!user) return { error: "Not authenticated" };

  const update: ProfilePayload & { id: string } = {
    id: user.id,
    ...payload,
  };

  if (payload.hr_zones !== undefined) {
    if (payload.hr_zones === null) {
      update.hr_zones = null;
    } else {
      const zones = normalizeHRZones(payload.hr_zones);
      if (!zones) return { error: "Invalid heart rate zones." };
      update.hr_zones = zones;
    }
  }

  if (payload.hr_zone_method !== undefined) {
    const method = normalizeHRZoneMethod(payload.hr_zone_method);
    if (!method) return { error: "Invalid heart rate zone method." };
    update.hr_zone_method = method;
  }

  if (payload.max_heart_rate !== undefined) {
    const maxHeartRate = normalizeMaxHeartRate(payload.max_heart_rate);
    if (!maxHeartRate) return { error: "Max heart rate must be between 100 and 240 bpm." };
    update.max_heart_rate = maxHeartRate;
  }

  if (payload.pace_zones !== undefined) {
    if (payload.pace_zones === null) {
      update.pace_zones = null;
    } else {
      const zones = normalizePaceZones(payload.pace_zones);
      if (!zones) return { error: "Invalid pace zones." };
      update.pace_zones = zones;
    }
  }

  if (payload.ignored_hr_zone_suggestion_hash !== undefined) {
    update.ignored_hr_zone_suggestion_hash = payload.ignored_hr_zone_suggestion_hash?.slice(0, 64) ?? null;
  }

  if (payload.ignored_pace_zone_suggestion_hash !== undefined) {
    update.ignored_pace_zone_suggestion_hash = payload.ignored_pace_zone_suggestion_hash?.slice(0, 64) ?? null;
  }

  const { error } = await supabase
    .from("profiles")
    .upsert(update, { onConflict: "id" });

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
