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
