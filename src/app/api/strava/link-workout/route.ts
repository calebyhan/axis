import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: NextRequest) {
  const { pendingLinkId, activityId } = await request.json();
  if (!pendingLinkId || !activityId) {
    return NextResponse.json({ error: "Missing fields" }, { status: 400 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: link, error: linkError } = await supabase
    .from("pending_strava_links")
    .select("strava_data, candidate_ids")
    .eq("id", pendingLinkId)
    .eq("user_id", user.id)
    .single();

  if (linkError) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!link) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (!link.candidate_ids.includes(activityId)) {
    return NextResponse.json({ error: "Activity not a candidate" }, { status: 400 });
  }

  const { data: activity, error: activityError } = await supabase
    .from("activities")
    .select("id")
    .eq("id", activityId)
    .eq("user_id", user.id)
    .eq("type", "workout")
    .single();

  if (activityError || !activity) {
    return NextResponse.json({ error: "Activity not found" }, { status: 404 });
  }

  const { avg_heartrate, max_heartrate, calories, suffer_score, strava_activity_id } = link.strava_data;

  const { error: updateError } = await supabase
    .from("activities")
    .update({ avg_heartrate, max_heartrate, calories, suffer_score, strava_activity_id })
    .eq("id", activityId)
    .eq("user_id", user.id)
    .is("strava_activity_id", null)
    .select("id")
    .single();

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  const { error: deleteError } = await supabase
    .from("pending_strava_links")
    .delete()
    .eq("id", pendingLinkId)
    .eq("user_id", user.id);

  if (deleteError) {
    return NextResponse.json({ error: deleteError.message }, { status: 500 });
  }

  revalidatePath("/activity");
  revalidatePath(`/activity/${activityId}`);

  return NextResponse.json({ ok: true });
}
