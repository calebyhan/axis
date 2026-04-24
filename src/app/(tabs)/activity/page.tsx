export const dynamic = "force-dynamic";

import { getActivitiesFeed, getWorkoutCoverageAndStats } from "@/lib/queries/activity";
import { getUserUnits } from "@/lib/queries/profile";
import { ActivityFeed } from "@/components/activity/ActivityFeed";

import { createClient } from "@/lib/supabase/server";
import type { Activity, MuscleGroup } from "@/types";

type WorkoutData = { coverage: Partial<Record<MuscleGroup, number>>; exerciseCount: number; totalVolume: number };

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

  const workoutActivities = activities.filter((a) => a.type === "workout");
  const workoutDataMap: Record<string, WorkoutData> = {};
  await Promise.all(
    workoutActivities.slice(0, 20).map(async (a) => {
      const data = await getWorkoutCoverageAndStats(a.id);
      workoutDataMap[a.id] = data;
    })
  );

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
