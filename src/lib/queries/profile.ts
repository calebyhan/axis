import { cache } from "react";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { DEFAULT_TIME_ZONE, TIME_ZONE_COOKIE, normalizeTimeZone } from "@/lib/time-zone";
import type { AccentColor, Units } from "@/types";

const getCachedAuthUser = cache(async () => {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  return user;
});

const getCachedProfile = cache(async () => {
  const user = await getCachedAuthUser();
  if (!user) return null;

  const supabase = await createClient();
  const { data } = await supabase
    .from("profiles")
    .select("units, accent_color, display_name")
    .eq("id", user.id)
    .single();
  return data;
});

const getCachedNotificationPreferences = cache(async () => {
  const user = await getCachedAuthUser();
  if (!user) return null;

  const supabase = await createClient();
  const { data } = await supabase
    .from("notification_preferences")
    .select("timezone")
    .eq("user_id", user.id)
    .maybeSingle();
  return data;
});

async function getCookieTimeZone(): Promise<string | null> {
  const cookieStore = await cookies();
  const raw = cookieStore.get(TIME_ZONE_COOKIE)?.value;
  if (!raw) return null;

  try {
    return normalizeTimeZone(decodeURIComponent(raw));
  } catch {
    return normalizeTimeZone(raw);
  }
}

export async function getUserUnits(): Promise<Units> {
  const profile = await getCachedProfile();
  return (profile?.units as Units) ?? "imperial";
}

export async function getUserAccentColor(): Promise<AccentColor> {
  const profile = await getCachedProfile();
  return (profile?.accent_color as AccentColor) ?? "blue";
}

export async function getUserDisplayName(): Promise<string> {
  const profile = await getCachedProfile();
  if (typeof profile?.display_name === "string" && profile.display_name.trim()) {
    return profile.display_name.trim();
  }

  const user = await getCachedAuthUser();
  if (!user) return "there";

  const metadata = user.user_metadata ?? {};
  const rawName =
    metadata.full_name ??
    metadata.name ??
    metadata.given_name ??
    metadata.preferred_username;

  if (typeof rawName === "string" && rawName.trim()) {
    return rawName.trim().split(" ")[0];
  }

  if (user.email) {
    return user.email.split("@")[0];
  }

  return "there";
}

export async function getUserTimeZone(): Promise<string> {
  const cookieTimeZone = await getCookieTimeZone();
  if (cookieTimeZone) return cookieTimeZone;

  const preferences = await getCachedNotificationPreferences();
  return normalizeTimeZone(preferences?.timezone) ?? DEFAULT_TIME_ZONE;
}
