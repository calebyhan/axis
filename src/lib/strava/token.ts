import { createClient } from "@/lib/supabase/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getStravaClientId, getStravaClientSecret } from "@/lib/env";

export async function getValidStravaToken(userId: string): Promise<string> {
  const supabase = await createClient();

  const { data: profile, error } = await supabase
    .from("profiles")
    .select("strava_access_token, strava_refresh_token, token_expires_at")
    .eq("id", userId)
    .single();

  if (error || !profile?.strava_access_token) {
    throw new Error("No Strava token found. Connect Strava in Settings.");
  }

  const expiresAt = profile.token_expires_at
    ? new Date(profile.token_expires_at)
    : new Date(0);

  if (isNaN(expiresAt.getTime())) {
    console.error("[token] Invalid token_expires_at for user", userId);
  }

  // Refresh if token expires within 5 minutes
  if (!isNaN(expiresAt.getTime()) && expiresAt.getTime() - Date.now() > 5 * 60 * 1000) {
    return profile.strava_access_token;
  }

  return refreshStravaToken(userId, supabase);
}

// Accepts an external supabase client so the webhook handler can reuse this without creating a new server client.
export async function refreshStravaToken(userId: string, supabase: SupabaseClient): Promise<string> {
  const { data: profile, error } = await supabase
    .from("profiles")
    .select("strava_refresh_token")
    .eq("id", userId)
    .single();

  if (error || !profile?.strava_refresh_token) {
    throw new Error("No refresh token available.");
  }

  const res = await fetch("https://www.strava.com/oauth/token", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      client_id: getStravaClientId(),
      client_secret: getStravaClientSecret(),
      grant_type: "refresh_token",
      refresh_token: profile.strava_refresh_token,
    }),
  });

  if (!res.ok) {
    throw new Error(`Strava token refresh failed: ${res.status}`);
  }

  const tokens = await res.json();

  const { error: updateError } = await supabase
    .from("profiles")
    .update({
      strava_access_token: tokens.access_token,
      strava_refresh_token: tokens.refresh_token,
      token_expires_at: new Date(tokens.expires_at * 1000).toISOString(),
    })
    .eq("id", userId);

  if (updateError) {
    console.error("[token] Failed to persist refreshed Strava token", {
      userId,
      error: updateError.message,
    });
  }

  return tokens.access_token;
}
