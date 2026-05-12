import { createAdminClient, createClient } from "@/lib/supabase/server";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { getStravaClientId, getStravaClientSecret } from "@/lib/env";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const error = searchParams.get("error");
  const state = searchParams.get("state");

  const cookieStore = await cookies();
  const expectedState = cookieStore.get("strava_oauth_state")?.value;
  cookieStore.delete("strava_oauth_state");

  if (!expectedState || state !== expectedState) {
    return NextResponse.redirect(`${origin}/settings?strava_error=invalid_state`);
  }

  if (error || !code) {
    return NextResponse.redirect(`${origin}/settings?strava_error=access_denied`);
  }

  const tokenRes = await fetch("https://www.strava.com/oauth/token", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      client_id: getStravaClientId(),
      client_secret: getStravaClientSecret(),
      code,
      grant_type: "authorization_code",
    }),
  });

  if (!tokenRes.ok) {
    return NextResponse.redirect(`${origin}/settings?strava_error=token_exchange_failed`);
  }

  const tokens = await tokenRes.json();
  const stravaAthleteId = tokens.athlete?.id;
  if (!stravaAthleteId || !tokens.access_token || !tokens.refresh_token || !tokens.expires_at) {
    return NextResponse.redirect(`${origin}/settings?strava_error=token_exchange_failed`);
  }

  const supabase = await createClient();

  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (!user) {
    console.error("[callback] No authenticated user", authError?.message);
    return NextResponse.redirect(`${origin}/settings?strava_error=not_authenticated`);
  }

  const profileData = {
    id: user.id,
    strava_athlete_id: stravaAthleteId,
    strava_access_token: tokens.access_token,
    strava_refresh_token: tokens.refresh_token,
    token_expires_at: new Date(tokens.expires_at * 1000).toISOString(),
  };

  const adminSupabase = createAdminClient();
  const { error: unlinkError } = await adminSupabase
    .from("profiles")
    .update({
      strava_athlete_id: null,
      strava_access_token: null,
      strava_refresh_token: null,
      token_expires_at: null,
    })
    .eq("strava_athlete_id", stravaAthleteId)
    .neq("id", user.id);

  if (unlinkError) {
    console.error("[callback] Failed to clear previous Strava connection", unlinkError.code, unlinkError.message);
    const detail = encodeURIComponent(unlinkError.code ?? unlinkError.message);
    return NextResponse.redirect(`${origin}/settings?strava_error=save_failed&detail=${detail}`);
  }

  const { error: upsertError } = await adminSupabase
    .from("profiles")
    .upsert(profileData, { onConflict: "id" });

  if (upsertError) {
    console.error("[callback] Failed to save Strava tokens", upsertError.code, upsertError.message);
    const detail = encodeURIComponent(upsertError.code ?? upsertError.message);
    return NextResponse.redirect(`${origin}/settings?strava_error=save_failed&detail=${detail}`);
  }

  return NextResponse.redirect(`${origin}/settings?strava_connected=1`);
}
