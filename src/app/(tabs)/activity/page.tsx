export const dynamic = "force-dynamic";

import { getActivitiesFeed, getWorkoutsBulkData } from "@/lib/queries/activity";
import { getUserUnits } from "@/lib/queries/profile";
import { ActivityFeed } from "@/components/activity/ActivityFeed";

import { createClient } from "@/lib/supabase/server";
import type { Activity } from "@/types";

export default async function ActivityPage() {
  const supabase = await createClient();
  const [activities, units, { data: dayTypesRaw }] = await Promise.all([
    getActivitiesFeed(undefined, 100) as Promise<Activity[]>,
    getUserUnits(),
    supabase.from("day_types").select("id, name"),
  ]);
  const dayTypeNames: Record<string, string> = Object.fromEntries(
    (dayTypesRaw ?? []).map((d) => [d.id, d.name])
  );

  const workoutIds = activities.filter((a) => a.type === "workout").map((a) => a.id);
  const workoutDataMap = await getWorkoutsBulkData(workoutIds);

  return (
    <div className="page-shell">
      <div className="page-header">
        <div>
          <h1 className="page-title">Activity</h1>
        </div>
      </div>

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
