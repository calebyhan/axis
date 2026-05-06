// Shared mapping from a Strava activity API response to our activities table shape.
// Used by both the webhook handler and the manual sync endpoint.

type ActivityType = "run" | "ride";

const RUN_SPORTS = new Set(["Run", "VirtualRun"]);
const RIDE_SPORTS = new Set([
  "Ride",
  "VirtualRide",
  "EBikeRide",
  "EMountainBikeRide",
  "GravelRide",
  "MountainBikeRide",
]);

export function mapStravaSportType(sportType: string | null | undefined): ActivityType | null {
  if (!sportType) return null;
  if (RUN_SPORTS.has(sportType)) return "run";
  if (RIDE_SPORTS.has(sportType)) return "ride";
  return null;
}

export function isSupportedCardioSport(sportType: string | null | undefined): boolean {
  return mapStravaSportType(sportType) !== null;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function buildActivityRow(userId: string, stravaId: number, a: Record<string, any>) {
  const type = mapStravaSportType(a.sport_type);
  if (!type) {
    throw new Error(`Unsupported Strava sport type: ${String(a.sport_type)}`);
  }
  const distance: number = a.distance ?? 0;

  const bestEfforts = Array.isArray(a.best_efforts)
    ? a.best_efforts.map((e: Record<string, unknown>) => ({
        name: e.name,
        elapsed_time: e.elapsed_time,
        distance: e.distance,
        pr_rank: e.pr_rank ?? null,
      }))
    : null;

  const splits = Array.isArray(a.splits_metric)
    ? a.splits_metric.map((s: Record<string, unknown>) => ({
        split: s.split,
        distance: s.distance,
        elapsed_time: s.elapsed_time,
        moving_time: s.moving_time,
        elevation_difference: s.elevation_difference,
        average_speed: s.average_speed,
        average_grade_adjusted_speed: s.average_grade_adjusted_speed ?? null,
        average_heartrate: s.average_heartrate ?? null,
        pace_zone: s.pace_zone ?? null,
      }))
    : null;

  return {
    user_id: userId,
    strava_activity_id: stravaId,
    type,
    start_time: a.start_date,
    duration: a.moving_time,
    elapsed_time: a.elapsed_time ?? null,
    source: "strava",
    distance,
    avg_heartrate: a.average_heartrate ?? null,
    max_heartrate: a.max_heartrate ?? null,
    suffer_score: a.suffer_score ?? null,
    calories: a.calories ?? null,
    elevation_gain: a.total_elevation_gain ?? null,
    avg_pace: distance > 0 ? (a.moving_time as number) / (distance / 1000) : null,
    avg_cadence: a.average_cadence ?? null,
    avg_watts: a.average_watts ?? null,
    max_speed: a.max_speed ?? null,
    name: a.name ?? null,
    summary_polyline: a.map?.summary_polyline ?? null,
    splits,
    best_efforts: bestEfforts,
    average_temp: a.average_temp ?? null,
  };
}
