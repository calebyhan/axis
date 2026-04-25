import { after } from "next/server";
import { createHmac, timingSafeEqual } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { refreshStravaToken } from "@/lib/strava/token";
import { buildActivityRow } from "@/lib/strava/activity-row";
import {
  getStravaClientSecret,
  getStravaWebhookVerifyToken,
  getSupabaseSecretKey,
  getSupabaseUrl,
} from "@/lib/env";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const mode = searchParams.get("hub.mode");
  const token = searchParams.get("hub.verify_token");
  const challenge = searchParams.get("hub.challenge");

  if (
    mode === "subscribe" &&
    token === getStravaWebhookVerifyToken()
  ) {
    return NextResponse.json({ "hub.challenge": challenge });
  }

  return new NextResponse("Forbidden", { status: 403 });
}

export async function POST(request: NextRequest) {
  const secret = getStravaClientSecret();

  const rawBody = await request.text();
  const signature = request.headers.get("x-hub-signature") ?? "";

  if (!verifyHmac(rawBody, signature, secret)) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  let payload: { object_type: string; aspect_type: string; object_id: number; owner_id: number };
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return new NextResponse("Bad Request", { status: 400 });
  }

  after(async () => {
    try {
      await processWebhookEvent(payload);
    } catch (err) {
      console.error("[webhook] processWebhookEvent failed", String(err));
    }
  });

  return NextResponse.json({ status: "ok" });
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function mergeWorkoutBiometrics(userId: string, stravaId: number, a: Record<string, any>, supabase: ReturnType<typeof createServerClient>) {
  const stravaStart = new Date(a.start_date).getTime();
  const windowMs = 90 * 60 * 1000; // 90-minute tolerance on either side

  const { data: candidates } = await supabase
    .from("activities")
    .select("id")
    .eq("user_id", userId)
    .eq("type", "workout")
    .gte("start_time", new Date(stravaStart - windowMs).toISOString())
    .lte("start_time", new Date(stravaStart + windowMs).toISOString());

  if (!candidates || candidates.length === 0) return;

  const biometrics = {
    avg_heartrate: a.average_heartrate ?? null,
    max_heartrate: a.max_heartrate ?? null,
    calories: a.calories ?? null,
    suffer_score: a.suffer_score ?? null,
    strava_activity_id: stravaId,
  };

  if (candidates.length === 1) {
    await supabase.from("activities").update(biometrics).eq("id", candidates[0].id);
    return;
  }

  // Multiple candidates — store for user to resolve
  await supabase.from("pending_strava_links").insert({
    user_id: userId,
    strava_activity_id: stravaId,
    strava_data: {
      ...biometrics,
      name: a.name ?? null,
      start_time: a.start_date,
      duration: a.moving_time,
    },
    candidate_ids: candidates.map((c: { id: string }) => c.id),
  });
}

function verifyHmac(body: string, signature: string, secret: string): boolean {
  const expected = "sha256=" + createHmac("sha256", secret).update(body).digest("hex");
  if (signature.length !== expected.length) return false;
  try {
    return timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
  } catch {
    return false;
  }
}

async function processWebhookEvent(payload: {
  object_type: string;
  aspect_type: string;
  object_id: number;
  owner_id: number;
}) {
  if (payload.object_type !== "activity" || payload.aspect_type !== "create") {
    return;
  }

  const cookieStore = await cookies();
  const supabase = createServerClient(getSupabaseUrl(), getSupabaseSecretKey(), {
    cookies: {
      getAll() { return cookieStore.getAll(); },
      setAll() {},
    },
  });

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, strava_access_token, strava_refresh_token, token_expires_at")
    .eq("strava_athlete_id", payload.owner_id)
    .single();

  if (!profile?.strava_access_token) return;

  // Refresh token if expired or expiring within 5 minutes
  let accessToken = profile.strava_access_token;
  const expiresAt = profile.token_expires_at ? new Date(profile.token_expires_at) : new Date(0);
  if (expiresAt.getTime() - Date.now() <= 5 * 60 * 1000) {
    try {
      accessToken = await refreshStravaToken(profile.id, supabase);
    } catch (err) {
      console.error("[webhook] Token refresh failed", String(err));
      return;
    }
  }

  const activityRes = await fetch(
    `https://www.strava.com/api/v3/activities/${payload.object_id}`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );
  if (!activityRes.ok) {
    console.error("[webhook] Strava activity fetch failed", {
      status: activityRes.status,
      activityId: payload.object_id,
    });
    return;
  }

  const activity = await activityRes.json();

  // Workout sport types are merged into an existing Axis session rather than
  // stored as new records. Anything that isn't a run or ride is treated as a
  // gym/fitness workout.
  const sport = activity.sport_type as string;
  const isRun = sport === "Run" || sport === "VirtualRun";
  const isRide = ["Ride", "VirtualRide", "EBikeRide", "EMountainBikeRide", "GravelRide", "MountainBikeRide"].includes(sport);

  if (!isRun && !isRide) {
    await mergeWorkoutBiometrics(profile.id, payload.object_id, activity, supabase);
    revalidatePath("/activity");
    return;
  }

  const { error: upsertError } = await supabase
    .from("activities")
    .upsert(buildActivityRow(profile.id, payload.object_id, activity), {
      onConflict: "strava_activity_id",
    });

  if (upsertError) {
    console.error("[webhook] Activity upsert failed", {
      activityId: payload.object_id,
      error: upsertError.message,
    });
    return;
  }

  revalidatePath("/dashboard");
  revalidatePath("/activity");
}
