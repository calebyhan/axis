import { getValidStravaToken } from "./token";

const STRAVA_BASE = "https://www.strava.com/api/v3";

async function stravaFetch(userId: string, path: string, params?: Record<string, string>) {
  const token = await getValidStravaToken(userId);
  const url = new URL(`${STRAVA_BASE}${path}`);
  if (params) {
    Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  }
  const res = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${token}` },
    next: { revalidate: 0 },
  });
  if (!res.ok) {
    throw new Error(`Strava API error ${res.status}: ${path}`);
  }
  return res.json();
}

export async function getActivity(userId: string, activityId: number) {
  return stravaFetch(userId, `/activities/${activityId}`);
}

export async function getActivities(
  userId: string,
  after?: number,
  before?: number,
  page = 1,
  perPage = 30
) {
  const params: Record<string, string> = {
    page: String(page),
    per_page: String(perPage),
  };
  if (after) params.after = String(after);
  if (before) params.before = String(before);
  return stravaFetch(userId, "/athlete/activities", params);
}

export async function getStreams(
  userId: string,
  activityId: number,
  keys: string[]
) {
  return stravaFetch(userId, `/activities/${activityId}/streams`, {
    keys: keys.join(","),
    key_by_type: "true",
  });
}

export async function getAthleteZones(userId: string) {
  return stravaFetch(userId, "/athlete/zones");
}

export async function getAthleteStats(userId: string, athleteId: number) {
  return stravaFetch(userId, `/athletes/${athleteId}/stats`);
}
