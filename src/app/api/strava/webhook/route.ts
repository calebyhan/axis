import { after } from "next/server";
import { createHmac, timingSafeEqual } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { refreshStravaToken } from "@/lib/strava/token";
import { buildActivityRow, mapStravaSportType } from "@/lib/strava/activity-row";
import {
  getStravaWebhookSigningSecret,
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
  const secret = getStravaWebhookSigningSecret();

  const rawBody = await request.text();
  const signature = request.headers.get("x-strava-signature") ?? "";

  if (!verifyStravaSignature(rawBody, signature, secret)) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  let payload: StravaWebhookPayload;
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
  if (Number.isNaN(stravaStart)) return;
  const windowMs = 90 * 60 * 1000; // 90-minute tolerance on either side

  const { data: candidates } = await supabase
    .from("activities")
    .select("id, start_time, duration, strava_activity_id")
    .eq("user_id", userId)
    .eq("type", "workout")
    .gte("start_time", new Date(stravaStart - windowMs).toISOString())
    .lte("start_time", new Date(stravaStart + windowMs).toISOString());

  if (!candidates || candidates.length === 0) return;
  if (candidates.some((candidate) => candidate.strava_activity_id === stravaId)) return;

  const stravaDuration = typeof a.moving_time === "number" ? a.moving_time : null;
  const stravaEnd = stravaDuration ? stravaStart + stravaDuration * 1000 : null;
  const overlappingCandidates = candidates.filter((candidate) => {
    if (!stravaEnd || !candidate.duration) return true;
    const candidateStart = new Date(candidate.start_time).getTime();
    if (Number.isNaN(candidateStart)) return false;
    const candidateEnd = candidateStart + candidate.duration * 1000;
    const overlapMs = Math.max(0, Math.min(stravaEnd, candidateEnd) - Math.max(stravaStart, candidateStart));
    const shorterMs = Math.min(stravaEnd - stravaStart, candidateEnd - candidateStart);
    return overlapMs >= 10 * 60 * 1000 || overlapMs / shorterMs >= 0.4;
  });

  if (overlappingCandidates.length === 0) return;

  const biometrics = {
    avg_heartrate: a.average_heartrate ?? null,
    max_heartrate: a.max_heartrate ?? null,
    calories: a.calories ?? null,
    suffer_score: a.suffer_score ?? null,
    strava_activity_id: stravaId,
  };

  if (overlappingCandidates.length === 1) {
    const { error } = await supabase
      .from("activities")
      .update(biometrics)
      .eq("id", overlappingCandidates[0].id)
      .is("strava_activity_id", null);
    if (error) {
      console.error("[webhook] Workout biometric merge failed", {
        activityId: overlappingCandidates[0].id,
        stravaId,
        error: error.message,
      });
    }
    return;
  }

  // Multiple candidates — store for user to resolve
  const { data: existingPending } = await supabase
    .from("pending_strava_links")
    .select("id")
    .eq("user_id", userId)
    .eq("strava_activity_id", stravaId)
    .maybeSingle();

  if (existingPending) return;

  const { error } = await supabase.from("pending_strava_links").insert({
    user_id: userId,
    strava_activity_id: stravaId,
    strava_data: {
      ...biometrics,
      name: a.name ?? null,
      start_time: a.start_date,
      duration: a.moving_time,
    },
    candidate_ids: overlappingCandidates.map((c: { id: string }) => c.id),
  });
  if (error) {
    console.error("[webhook] Pending workout link insert failed", {
      stravaId,
      error: error.message,
    });
  }
}

function verifyStravaSignature(body: string, header: string, secret: string): boolean {
  if (!header) return false;
  const parts = Object.fromEntries(
    header.split(",").map((part) => {
      const [key, value] = part.split("=", 2);
      return [key, value];
    })
  );
  const timestamp = parts.t;
  const signature = parts.v1;
  if (!timestamp || !signature) return false;

  const signedAt = Number(timestamp);
  if (!Number.isFinite(signedAt)) return false;
  if (Math.abs(Date.now() / 1000 - signedAt) > 300) return false;

  const expected = createHmac("sha256", secret).update(`${timestamp}.${body}`).digest("hex");
  if (signature.length !== expected.length) return false;
  try {
    return timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
  } catch {
    return false;
  }
}

type StravaWebhookPayload = {
  object_type: string;
  aspect_type: string;
  object_id: number;
  owner_id: number;
  updates?: Record<string, string>;
};

async function processWebhookEvent(payload: StravaWebhookPayload) {
  const cookieStore = await cookies();
  const supabase = createServerClient(getSupabaseUrl(), getSupabaseSecretKey(), {
    cookies: {
      getAll() { return cookieStore.getAll(); },
      setAll() {},
    },
  });

  const athleteId = payload.object_type === "athlete" ? payload.object_id : payload.owner_id;
  const { data: profile } = await supabase
    .from("profiles")
    .select("id, strava_access_token, strava_refresh_token, token_expires_at")
    .eq("strava_athlete_id", athleteId)
    .single();

  if (!profile) return;

  if (payload.object_type === "athlete" && payload.updates?.authorized === "false") {
    await supabase
      .from("profiles")
      .update({
        strava_access_token: null,
        strava_refresh_token: null,
        token_expires_at: null,
      })
      .eq("id", profile.id);
    return;
  }

  if (payload.object_type !== "activity") return;

  if (payload.aspect_type === "delete") {
    await Promise.all([
      supabase
        .from("activities")
        .delete()
        .eq("user_id", profile.id)
        .eq("strava_activity_id", payload.object_id),
      supabase
        .from("pending_strava_links")
        .delete()
        .eq("user_id", profile.id)
        .eq("strava_activity_id", payload.object_id),
    ]);
    revalidatePath("/dashboard");
    revalidatePath("/activity");
    return;
  }

  if (payload.aspect_type !== "create" && payload.aspect_type !== "update") return;

  if (!profile.strava_access_token) return;

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
    if (activityRes.status === 403 || activityRes.status === 404) {
      await supabase
        .from("activities")
        .delete()
        .eq("user_id", profile.id)
        .eq("strava_activity_id", payload.object_id);
      revalidatePath("/dashboard");
      revalidatePath("/activity");
    }
    console.error("[webhook] Strava activity fetch failed", {
      status: activityRes.status,
      activityId: payload.object_id,
    });
    return;
  }

  const activity = await activityRes.json();

  const sport = activity.sport_type as string;
  const cardioType = mapStravaSportType(sport);

  if (!cardioType) {
    await supabase
      .from("activities")
      .delete()
      .eq("user_id", profile.id)
      .eq("strava_activity_id", payload.object_id)
      .neq("type", "workout");
    await mergeWorkoutBiometrics(profile.id, payload.object_id, activity, supabase);
    revalidatePath("/activity");
    return;
  }

  const { data: linkedWorkout } = await supabase
    .from("activities")
    .select("id")
    .eq("user_id", profile.id)
    .eq("type", "workout")
    .eq("strava_activity_id", payload.object_id)
    .maybeSingle();

  if (linkedWorkout) return;

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
