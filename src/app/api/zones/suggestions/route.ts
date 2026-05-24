import { NextResponse } from "next/server";
import { DEFAULT_PACE_ZONES, normalizePaceZones } from "@/lib/pace-zones";
import {
  DEFAULT_MAX_HEART_RATE,
  normalizeHRZoneMethod,
  normalizeHRZones,
  normalizeMaxHeartRate,
} from "@/lib/hr-zones";
import { createClient } from "@/lib/supabase/server";
import { getStreams } from "@/lib/strava/client";
import {
  bestRollingDistance,
  suggestHRZones,
  suggestPaceZones,
  zonesEqual,
  type StreamPaceEffort,
  type ZoneActivityInput,
} from "@/lib/zone-suggestions";
import type { BestEffort } from "@/types";

export const runtime = "nodejs";

const LOOKBACK_DAYS = 365;
const MAX_ACTIVITIES = 120;
const MAX_STREAM_ACTIVITIES = 6;
const STREAM_KEYS = ["time", "distance"];

type ActivityRow = Omit<ZoneActivityInput, "best_efforts"> & {
  best_efforts?: BestEffort[] | null;
};

function safeBestEfforts(value: unknown): BestEffort[] | null {
  if (!Array.isArray(value)) return null;
  return value.flatMap((effort) => {
    if (!effort || typeof effort !== "object" || Array.isArray(effort)) return [];
    const source = effort as Partial<BestEffort>;
    if (typeof source.name !== "string") return [];
    if (typeof source.elapsed_time !== "number" || typeof source.distance !== "number") return [];
    return [{
      name: source.name,
      elapsed_time: source.elapsed_time,
      distance: source.distance,
      pr_rank: typeof source.pr_rank === "number" ? source.pr_rank : null,
    }];
  });
}

async function loadStreamPaceEfforts(userId: string, activities: ActivityRow[]): Promise<StreamPaceEffort[]> {
  const candidates = activities
    .filter((activity) =>
      typeof activity.strava_activity_id === "number" &&
      typeof activity.duration === "number" &&
      activity.duration >= 20 * 60 &&
      typeof activity.distance === "number" &&
      activity.distance >= 3000
    )
    .sort((a, b) => (a.avg_pace ?? Number.POSITIVE_INFINITY) - (b.avg_pace ?? Number.POSITIVE_INFINITY))
    .slice(0, MAX_STREAM_ACTIVITIES);

  const effortArrays = await Promise.all(candidates.map(async (activity) => {
    const stravaActivityId = activity.strava_activity_id;
    if (typeof stravaActivityId !== "number") return [];

    try {
      const raw = await getStreams(userId, stravaActivityId, STREAM_KEYS);
      const time = raw.time?.data;
      const distance = raw.distance?.data;
      if (!Array.isArray(time) || !Array.isArray(distance)) return [];

      return [20 * 60, 30 * 60].flatMap((windowSeconds) => {
        if ((activity.duration ?? 0) < windowSeconds) return [];
        const rollingDistance = bestRollingDistance(time, distance, windowSeconds);
        return rollingDistance ? [{ activityId: stravaActivityId, windowSeconds, distanceMeters: rollingDistance }] : [];
      });
    } catch {
      // Best-effort only; stored Strava best efforts still drive suggestions when streams fail.
      return [];
    }
  }));

  return effortArrays.flat();
}

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: profile } = await supabase
    .from("profiles")
    .select("hr_zones, hr_zone_method, max_heart_rate, pace_zones, strava_access_token, strava_hr_zones, ignored_hr_zone_suggestion_hash, ignored_pace_zone_suggestion_hash")
    .eq("id", user.id)
    .maybeSingle();

  const since = new Date(Date.now() - LOOKBACK_DAYS * 24 * 60 * 60 * 1000).toISOString();
  const { data } = await supabase
    .from("activities")
    .select("id, strava_activity_id, start_time, distance, duration, elapsed_time, avg_pace, avg_heartrate, max_heartrate, best_efforts")
    .in("type", ["run", "manual_run"])
    .gte("start_time", since)
    .order("start_time", { ascending: false })
    .limit(MAX_ACTIVITIES);

  const activities: ActivityRow[] = (data ?? []).map((activity) => ({
    ...activity,
    best_efforts: safeBestEfforts(activity.best_efforts),
  }));
  const streamEfforts = profile?.strava_access_token
    ? await loadStreamPaceEfforts(user.id, activities)
    : [];

  const generatedAt = new Date().toISOString();
  const maxHeartRate = normalizeMaxHeartRate(profile?.max_heart_rate) ?? DEFAULT_MAX_HEART_RATE;
  const rawHrSuggestion = suggestHRZones(activities, maxHeartRate);
  const rawPaceSuggestion = suggestPaceZones(activities, streamEfforts);
  const customHrZones = normalizeHRZones(profile?.hr_zones);
  const customPaceZones = normalizePaceZones(profile?.pace_zones);
  const cachedStravaHrZones = normalizeHRZones(profile?.strava_hr_zones);
  const hrMethod = normalizeHRZoneMethod(profile?.hr_zone_method) ?? (customHrZones ? "custom" : cachedStravaHrZones ? "strava" : "max_hr");

  const hrSuggestion =
    rawHrSuggestion &&
    rawHrSuggestion.hash !== profile?.ignored_hr_zone_suggestion_hash &&
    hrMethod === "max_hr" &&
    rawHrSuggestion.maxHeartRate !== maxHeartRate
      ? rawHrSuggestion
      : null;
  const paceSuggestion =
    rawPaceSuggestion &&
    rawPaceSuggestion.hash !== profile?.ignored_pace_zone_suggestion_hash &&
    !zonesEqual(customPaceZones ?? DEFAULT_PACE_ZONES, rawPaceSuggestion.zones)
      ? rawPaceSuggestion
      : null;

  await supabase
    .from("profiles")
    .update({
      last_hr_zone_suggestion_basis: rawHrSuggestion?.basis ?? null,
      last_pace_zone_suggestion_basis: rawPaceSuggestion?.basis ?? null,
      last_zone_suggestions_generated_at: generatedAt,
    })
    .eq("id", user.id);

  return NextResponse.json({
    hr: hrSuggestion,
    pace: paceSuggestion,
    generatedAt,
  });
}
