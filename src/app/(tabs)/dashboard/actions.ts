"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export async function upsertOverride(
  date: string,
  slot: "workout" | "cardio",
  dayTypeId: string | null
): Promise<{ error: string | null }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const { error } = await supabase
    .from("schedule_overrides")
    .upsert(
      { user_id: user.id, date, slot, day_type_id: dayTypeId },
      { onConflict: "user_id,date,slot" }
    );

  if (error) return { error: error.message };
  revalidatePath("/dashboard");
  return { error: null };
}

export async function deleteOverride(
  date: string,
  slot: "workout" | "cardio"
): Promise<{ error: string | null }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const { error } = await supabase
    .from("schedule_overrides")
    .delete()
    .eq("user_id", user.id)
    .eq("date", date)
    .eq("slot", slot);

  if (error) return { error: error.message };
  revalidatePath("/dashboard");
  return { error: null };
}
