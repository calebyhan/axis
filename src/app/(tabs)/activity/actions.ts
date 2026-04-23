"use server";

import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export async function deleteActivity(activityId: string): Promise<{ error: string | null }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  // session_sets cascade deletes via FK, so deleting the activity is sufficient
  const { error } = await supabase
    .from("activities")
    .delete()
    .eq("id", activityId);

  if (error) return { error: error.message };

  redirect("/activity");
}
