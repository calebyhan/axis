import { createClient } from "@/lib/supabase/server";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";

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
      client_id: process.env.STRAVA_CLIENT_ID,
      client_secret: process.env.STRAVA_CLIENT_SECRET,
      code,
      grant_type: "authorization_code",
    }),
  });

  if (!tokenRes.ok) {
    return NextResponse.redirect(`${origin}/settings?strava_error=token_exchange_failed`);
  }

  const tokens = await tokenRes.json();
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.redirect(`${origin}/login`);
  }

  const { error: updateError } = await supabase
    .from("profiles")
    .update({
      strava_athlete_id: tokens.athlete?.id ?? null,
      strava_access_token: tokens.access_token,
      strava_refresh_token: tokens.refresh_token,
      token_expires_at: new Date(tokens.expires_at * 1000).toISOString(),
    })
    .eq("id", user.id);

  if (updateError) {
    console.error("[callback] Failed to save Strava tokens", updateError.message);
    return NextResponse.redirect(`${origin}/settings?strava_error=save_failed`);
  }

  return NextResponse.redirect(`${origin}/settings?strava_connected=1`);
}
