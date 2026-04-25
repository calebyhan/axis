import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { getSupabaseUrl, getSupabaseSecretKey } from "@/lib/env";

export async function POST(request: NextRequest) {
  const { pendingLinkId, activityId } = await request.json();
  if (!pendingLinkId || !activityId) {
    return NextResponse.json({ error: "Missing fields" }, { status: 400 });
  }

  const cookieStore = await cookies();
  const supabase = createServerClient(getSupabaseUrl(), getSupabaseSecretKey(), {
    cookies: {
      getAll() { return cookieStore.getAll(); },
      setAll() {},
    },
  });

  const { data: link } = await supabase
    .from("pending_strava_links")
    .select("strava_data, candidate_ids")
    .eq("id", pendingLinkId)
    .single();

  if (!link) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (!link.candidate_ids.includes(activityId)) {
    return NextResponse.json({ error: "Activity not a candidate" }, { status: 400 });
  }

  const { avg_heartrate, max_heartrate, calories, suffer_score, strava_activity_id } = link.strava_data;

  await supabase
    .from("activities")
    .update({ avg_heartrate, max_heartrate, calories, suffer_score, strava_activity_id })
    .eq("id", activityId);

  await supabase.from("pending_strava_links").delete().eq("id", pendingLinkId);

  revalidatePath("/activity");

  return NextResponse.json({ ok: true });
}
