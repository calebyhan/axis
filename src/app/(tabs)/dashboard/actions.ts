"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

function localDateFromString(date: string): Date {
  const [year, month, day] = date.split("-").map(Number);
  return new Date(year, month - 1, day);
}

function localDateStr(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function startOfWeek(today: Date): Date {
  const sunday = new Date(today);
  sunday.setDate(today.getDate() - today.getDay());
  sunday.setHours(0, 0, 0, 0);
  return sunday;
}

async function invalidatePlannedSlotWeek(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  date: string
) {
  const { error } = await supabase
    .from("planned_slots")
    .delete()
    .eq("user_id", userId)
    .eq("week_start", localDateStr(startOfWeek(localDateFromString(date))));
  if (error) console.error("[dashboard] planned slot invalidation failed", error.message);
}

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
  await invalidatePlannedSlotWeek(supabase, user.id, date);
  revalidatePath("/dashboard");
  revalidatePath("/stats");
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
  await invalidatePlannedSlotWeek(supabase, user.id, date);
  revalidatePath("/dashboard");
  revalidatePath("/stats");
  return { error: null };
}
