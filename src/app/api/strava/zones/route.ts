import { NextRequest, NextResponse } from "next/server";
import {
  DEFAULT_HR_ZONES,
  DEFAULT_MAX_HEART_RATE,
  maxHeartRateToZones,
  normalizeHRZoneMethod,
  normalizeHRZones,
  normalizeMaxHeartRate,
  type HRZoneMethod,
  type HRZoneSource,
} from "@/lib/hr-zones";
import { DEFAULT_PACE_ZONES, normalizePaceZones, type PaceZoneSource } from "@/lib/pace-zones";
import { createClient } from "@/lib/supabase/server";
import { getAthleteZones, StravaAPIError } from "@/lib/strava/client";
import { zoneHash } from "@/lib/zone-suggestions";

export const runtime = "nodejs";

type StravaZoneDiagnostics = {
  stravaError?: string | null;
  stravaStatus?: number;
  stravaDetail?: string | null;
  stravaSkipped?: "profile_override";
};

function supabaseErrorDetails(error: { code?: string; message?: string; details?: string; hint?: string }) {
  return {
    code: error.code,
    message: error.message,
    details: error.details,
    hint: error.hint,
  };
}

function stravaErrorDetails(error: unknown) {
  if (error instanceof StravaAPIError) {
    return {
      stravaError: error.status === 401
        ? "strava_auth_failed"
        : error.status === 403
          ? "missing_profile_read_all_scope"
          : `strava_api_${error.status}`,
      stravaStatus: error.status,
      stravaDetail: error.body,
    } satisfies StravaZoneDiagnostics;
  }

  return {
    stravaError: error instanceof Error ? error.message : "strava_request_failed",
    stravaDetail: null,
  } satisfies StravaZoneDiagnostics;
}

export async function GET(request: NextRequest) {
  const requestedMethod = normalizeHRZoneMethod(request.nextUrl.searchParams.get("method"));
  const preview = request.nextUrl.searchParams.get("preview") === "1";
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ hr: null }, { status: 401 });

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("hr_zones, pace_zones, strava_access_token")
    .eq("id", user.id)
    .maybeSingle();

  if (profileError) {
    console.error("[strava zones] failed to load profile", {
      userId: user.id,
      error: supabaseErrorDetails(profileError),
    });
    return NextResponse.json({ hr: null, error: "profile_read_failed" }, { status: 500 });
  }

  const { data: cachedProfile, error: cacheReadError } = await supabase
    .from("profiles")
    .select("strava_hr_zones, strava_hr_zones_synced_at, strava_hr_zones_hash")
    .eq("id", user.id)
    .maybeSingle();

  if (cacheReadError) {
    console.warn("[strava zones] cached Strava zone columns unavailable", {
      userId: user.id,
      error: supabaseErrorDetails(cacheReadError),
    });
  }

  const { data: methodProfile, error: methodReadError } = await supabase
    .from("profiles")
    .select("hr_zone_method, max_heart_rate")
    .eq("id", user.id)
    .maybeSingle();

  if (methodReadError) {
    console.warn("[strava zones] HR zone method columns unavailable", {
      userId: user.id,
      error: supabaseErrorDetails(methodReadError),
    });
  }

  const customPaceZones = normalizePaceZones(profile?.pace_zones);
  const paceZones = customPaceZones ?? DEFAULT_PACE_ZONES;
  const paceSource = (customPaceZones ? "profile" : "default") satisfies PaceZoneSource;

  const customZones = normalizeHRZones(profile?.hr_zones);
  const configuredMethod = normalizeHRZoneMethod(methodProfile?.hr_zone_method);
  const method: HRZoneMethod = requestedMethod ?? configuredMethod ?? (customZones ? "custom" : profile?.strava_access_token ? "strava" : "max_hr");
  const maxHeartRate = normalizeMaxHeartRate(methodProfile?.max_heart_rate) ?? DEFAULT_MAX_HEART_RATE;
  const maxHrZones = maxHeartRateToZones(maxHeartRate) ?? DEFAULT_HR_ZONES;
  const baseResponse = {
    method,
    maxHeartRate,
    pace: paceZones,
    paceSource,
  };

  if (method === "custom" && customZones) {
    return NextResponse.json({
      hr: customZones,
      source: "custom" satisfies HRZoneSource,
      ...baseResponse,
      stravaSkipped: undefined,
    });
  }

  if (method === "max_hr" || (method === "custom" && !customZones)) {
    return NextResponse.json({
      hr: maxHrZones,
      source: "max_hr" satisfies HRZoneSource,
      ...baseResponse,
      method: "max_hr" satisfies HRZoneMethod,
    });
  }

  let diagnostics: StravaZoneDiagnostics = {};

  if (method === "strava" && profile?.strava_access_token) {
    try {
      const data = await getAthleteZones(user.id);
      const rawZones = data?.heart_rate?.zones;
      const stravaZones = normalizeHRZones(rawZones);
      if (stravaZones) {
        const hash = zoneHash("hr", stravaZones);
        const syncedAt = new Date().toISOString();
        if (!preview) {
          const { error: cacheUpdateError } = await supabase
            .from("profiles")
            .update({
              strava_hr_zones: stravaZones,
              strava_hr_zones_synced_at: syncedAt,
              strava_hr_zones_hash: hash,
            })
            .eq("id", user.id);

          if (cacheUpdateError) {
            console.warn("[strava zones] failed to cache Strava HR zones", {
              userId: user.id,
              error: supabaseErrorDetails(cacheUpdateError),
            });
          }
        }

        return NextResponse.json({
          hr: stravaZones,
          source: "strava" satisfies HRZoneSource,
          stravaSyncedAt: syncedAt,
          stravaHash: hash,
          ...baseResponse,
        });
      }

      diagnostics = {
        stravaError: "invalid_zone_shape",
        stravaDetail: Array.isArray(rawZones)
          ? `Expected 5 heart-rate zones from Strava, received ${rawZones.length}.`
          : "Strava response did not include heart_rate.zones.",
      };
      console.warn("[strava zones] unexpected Strava HR zone response", {
        userId: user.id,
        zoneCount: Array.isArray(rawZones) ? rawZones.length : null,
        hasHeartRate: Boolean(data?.heart_rate),
      });
    } catch (error) {
      diagnostics = stravaErrorDetails(error);
      console.warn("[strava zones] failed to load Strava HR zones", {
        userId: user.id,
        ...diagnostics,
      });
    }
  }

  const cachedStravaZones = normalizeHRZones(cachedProfile?.strava_hr_zones);
  if (cachedStravaZones) {
    return NextResponse.json({
      hr: cachedStravaZones,
      source: "strava_cached" satisfies HRZoneSource,
      stravaSyncedAt: cachedProfile?.strava_hr_zones_synced_at ?? null,
      stravaHash: cachedProfile?.strava_hr_zones_hash ?? zoneHash("hr", cachedStravaZones),
      ...baseResponse,
      ...diagnostics,
    });
  }

  return NextResponse.json({
    hr: maxHrZones,
    source: "max_hr" satisfies HRZoneSource,
    ...baseResponse,
    ...diagnostics,
  });
}
