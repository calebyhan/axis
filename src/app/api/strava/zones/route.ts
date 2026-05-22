import { NextResponse } from "next/server";
import { DEFAULT_HR_ZONES, normalizeHRZones, type HRZoneSource } from "@/lib/hr-zones";
import { DEFAULT_PACE_ZONES, normalizePaceZones, type PaceZoneSource } from "@/lib/pace-zones";
import { createClient } from "@/lib/supabase/server";
import { getAthleteZones } from "@/lib/strava/client";

export const runtime = "nodejs";

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ hr: null }, { status: 401 });

  const { data: profile } = await supabase
    .from("profiles")
    .select("hr_zones, pace_zones, strava_access_token")
    .eq("id", user.id)
    .maybeSingle();

  const customPaceZones = normalizePaceZones(profile?.pace_zones);
  const paceZones = customPaceZones ?? DEFAULT_PACE_ZONES;
  const paceSource = (customPaceZones ? "profile" : "default") satisfies PaceZoneSource;

  const customZones = normalizeHRZones(profile?.hr_zones);
  if (customZones) {
    return NextResponse.json({
      hr: customZones,
      source: "profile" satisfies HRZoneSource,
      pace: paceZones,
      paceSource,
    });
  }

  if (profile?.strava_access_token) {
    try {
      const data = await getAthleteZones(user.id);
      const stravaZones = normalizeHRZones(data?.heart_rate?.zones);
      if (stravaZones) {
        return NextResponse.json({
          hr: stravaZones,
          source: "strava" satisfies HRZoneSource,
          pace: paceZones,
          paceSource,
        });
      }
    } catch {
      // Fall through to the built-in fallback when Strava is unavailable.
    }
  }

  return NextResponse.json({
    hr: DEFAULT_HR_ZONES,
    source: "default" satisfies HRZoneSource,
    pace: paceZones,
    paceSource,
  });
}
