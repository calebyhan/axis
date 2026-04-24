import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getActivities, getActivity } from "@/lib/strava/client";
import { buildActivityRow } from "@/lib/strava/activity-row";

export const runtime = "nodejs";

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let stravaActivities: Record<string, unknown>[];
  try {
    const after = Math.floor(Date.now() / 1000) - 90 * 24 * 60 * 60;
    stravaActivities = await getActivities(user.id, after, undefined, 1, 50);
  } catch {
    return NextResponse.json({ connected: false, activities: [] });
  }

  const runActivities = stravaActivities.filter((a) =>
    ["Run", "VirtualRun", "Ride", "VirtualRide"].includes(a.sport_type as string)
  );

  const { data: existing } = await supabase
    .from("activities")
    .select("strava_activity_id")
    .eq("user_id", user.id)
    .not("strava_activity_id", "is", null);

  const importedIds = new Set((existing ?? []).map((r) => r.strava_activity_id));
  const unimported = runActivities.filter((a) => !importedIds.has(a.id));

  return NextResponse.json({ connected: true, activities: unimported });
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { activityId } = await request.json();
  if (!activityId) return NextResponse.json({ error: "activityId required" }, { status: 400 });

  let activity: Record<string, unknown>;
  try {
    activity = await getActivity(user.id, activityId);
  } catch {
    return NextResponse.json({ error: "Failed to fetch activity from Strava" }, { status: 502 });
  }

  const { error } = await supabase
    .from("activities")
    .upsert(buildActivityRow(user.id, activityId, activity as Record<string, unknown>), {
      onConflict: "strava_activity_id",
    });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  revalidatePath("/dashboard");
  revalidatePath("/activity");

  return NextResponse.json({ ok: true });
}
