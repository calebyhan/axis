import { createHmac, timingSafeEqual } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { refreshStravaToken } from "@/lib/strava/token";
import { buildActivityRow } from "@/lib/strava/activity-row";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const mode = searchParams.get("hub.mode");
  const token = searchParams.get("hub.verify_token");
  const challenge = searchParams.get("hub.challenge");

  if (
    mode === "subscribe" &&
    token === process.env.STRAVA_WEBHOOK_VERIFY_TOKEN
  ) {
    return NextResponse.json({ "hub.challenge": challenge });
  }

  return new NextResponse("Forbidden", { status: 403 });
}

export async function POST(request: NextRequest) {
  const secret = process.env.STRAVA_CLIENT_SECRET;
  if (!secret) {
    console.error("[webhook] STRAVA_CLIENT_SECRET not set");
    return new NextResponse("Server misconfiguration", { status: 500 });
  }

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

  // Respond immediately; process in background
  processWebhookEvent(payload).catch((err) =>
    console.error("[webhook] processWebhookEvent failed", String(err))
  );

  return NextResponse.json({ status: "ok" });
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

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SECRET_KEY;
  if (!supabaseUrl || !supabaseKey) {
    console.error("[webhook] Supabase env vars not set");
    return;
  }

  const cookieStore = await cookies();
  const supabase = createServerClient(supabaseUrl, supabaseKey, {
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
