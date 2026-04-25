import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import type { AccentColor, Units } from "@/types";

const getCachedProfile = cache(async () => {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data } = await supabase
    .from("profiles")
    .select("units, accent_color")
    .eq("id", user.id)
    .single();
  return data;
});

export async function getUserUnits(): Promise<Units> {
  const profile = await getCachedProfile();
  return (profile?.units as Units) ?? "imperial";
}

export async function getUserAccentColor(): Promise<AccentColor> {
  const profile = await getCachedProfile();
  return (profile?.accent_color as AccentColor) ?? "blue";
}
