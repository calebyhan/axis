"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { isAccentColor } from "@/lib/accent-colors";
import type { AccentColor } from "@/types";

interface CompleteOnboardingPayload {
  display_name: string;
  accent_color: AccentColor;
}

export async function completeOnboarding(payload: CompleteOnboardingPayload): Promise<{ error: string | null }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const displayName = payload.display_name.trim();
  if (displayName.length > 80) {
    return { error: "Name must be 80 characters or fewer." };
  }

  if (!isAccentColor(payload.accent_color)) {
    return { error: "Choose a valid accent color." };
  }

  const { error } = await supabase
    .from("profiles")
    .upsert(
      {
        id: user.id,
        display_name: displayName || null,
        accent_color: payload.accent_color,
        onboarding_completed_at: new Date().toISOString(),
      },
      { onConflict: "id" }
    );

  if (error) return { error: error.message };

  revalidatePath("/dashboard");
  revalidatePath("/settings");
  return { error: null };
}
