export const dynamic = "force-dynamic";
export const metadata = { title: "Activity — Axis", description: "Chronological feed of runs and workouts" };

import { getActivitiesFeed, getWorkoutsBulkData } from "@/lib/queries/activity";
import { getUserUnits } from "@/lib/queries/profile";
import { ActivityFeed } from "@/components/activity/ActivityFeed";
import { PendingStravaLinks } from "@/components/activity/PendingStravaLinks";

import { createClient } from "@/lib/supabase/server";
import type { Activity } from "@/types";

export default async function ActivityPage() {
  const supabase = await createClient();
  const [activities, units, { data: dayTypesRaw }, { data: pendingRaw }] = await Promise.all([
    getActivitiesFeed(undefined, 100) as Promise<Activity[]>,
    getUserUnits(),
    supabase.from("day_types").select("id, name"),
    supabase.from("pending_strava_links").select("id, strava_data, candidate_ids").order("created_at"),
  ]);
  const dayTypeNames: Record<string, string> = Object.fromEntries(
    (dayTypesRaw ?? []).map((d) => [d.id, d.name])
  );

  const workoutIds = activities.filter((a) => a.type === "workout").map((a) => a.id);
  const workoutDataMap = await getWorkoutsBulkData(workoutIds);

  // Resolve candidate activity details for pending links
  const allCandidateIds = (pendingRaw ?? []).flatMap((p) => p.candidate_ids as string[]);
  const candidateMap: Record<string, { id: string; start_time: string; duration: number | null; name: string | null }> = {};
  if (allCandidateIds.length > 0) {
    const { data: candidateRows } = await supabase
      .from("activities")
      .select("id, start_time, duration, name")
      .in("id", allCandidateIds);
    for (const row of candidateRows ?? []) candidateMap[row.id] = row;
  }

  const pendingLinks = (pendingRaw ?? []).map((p) => ({
    id: p.id,
    strava_data: p.strava_data,
    candidates: (p.candidate_ids as string[]).flatMap((id) => candidateMap[id] ? [candidateMap[id]] : []),
  }));

  return (
    <div className="page-shell">
      <div className="page-header">
        <div>
          <h1 className="page-title">Activity</h1>
        </div>
      </div>

      {pendingLinks.length > 0 && (
        <PendingStravaLinks links={pendingLinks} />
      )}

      {activities.length === 0 ? (
        <div className="card p-6 text-center">
          <p className="text-muted text-sm">No activities yet. Connect Strava or log a session.</p>
        </div>
      ) : (
        <ActivityFeed
          activities={activities}
          workoutDataMap={workoutDataMap}
          dayTypeNames={dayTypeNames}
          units={units}
        />
      )}
    </div>
  );
}
