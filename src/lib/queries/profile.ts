import { createClient } from "@/lib/supabase/server";
import type { AccentColor, Units } from "@/types";

export async function getUserUnits(): Promise<Units> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return "imperial";
  const { data } = await supabase.from("profiles").select("units").eq("id", user.id).single();
  return (data?.units as Units) ?? "imperial";
}

export async function getUserAccentColor(): Promise<AccentColor> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return "blue";
  const { data } = await supabase.from("profiles").select("accent_color").eq("id", user.id).single();
  return (data?.accent_color as AccentColor) ?? "blue";
}
