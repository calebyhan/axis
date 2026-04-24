export const dynamic = "force-dynamic";

import { getActivitiesFeed, getWorkoutCoverageAndStats } from "@/lib/queries/activity";
import { getUserUnits } from "@/lib/queries/profile";
import { RunCard } from "@/components/activity/RunCard";
import { WorkoutCard } from "@/components/activity/WorkoutCard";
import { createClient } from "@/lib/supabase/server";
import type { Activity, MuscleGroup } from "@/types";

type WorkoutData = { coverage: Partial<Record<MuscleGroup, number>>; exerciseCount: number; totalVolume: number };

export default async function ActivityPage() {
  const supabase = await createClient();
  const [activities, units, { data: dayTypesRaw }] = await Promise.all([
    getActivitiesFeed(undefined, 40) as Promise<Activity[]>,
    getUserUnits(),
    supabase.from("day_types").select("id, name"),
  ]);
  const dayTypeNames = new Map((dayTypesRaw ?? []).map((d) => [d.id, d.name]));

  const workoutActivities = activities.filter((a) => a.type === "workout");
  const workoutDataMap = new Map<string, WorkoutData>();
  await Promise.all(
    workoutActivities.slice(0, 10).map(async (a) => {
      const data = await getWorkoutCoverageAndStats(a.id);
      workoutDataMap.set(a.id, data);
    })
  );

  return (
    <div className="page-shell">
      <div className="page-header">
        <div>
          <div className="page-kicker">Feed</div>
          <h1 className="page-title">Activity</h1>
          <p className="page-subtitle">Every run and session, arranged in a cleaner timeline that stays comfortable on mobile.</p>
        </div>
      </div>

      {activities.length === 0 ? (
        <div className="card p-6 text-center">
          <p className="text-muted text-sm">No activities yet. Connect Strava or log a session.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {activities.map((activity) => {
            if (activity.type === "workout") {
              const wd = workoutDataMap.get(activity.id) ?? { coverage: {}, exerciseCount: 0, totalVolume: 0 };
              return (
                <WorkoutCard
                  key={activity.id}
                  activity={activity}
                  coverage={wd.coverage}
                  exerciseCount={wd.exerciseCount}
                  totalVolume={wd.totalVolume}
                  dayTypeName={activity.day_type_id ? dayTypeNames.get(activity.day_type_id) : undefined}
                  units={units}
                />
              );
            }
            return <RunCard key={activity.id} activity={activity} units={units} />;
          })}
        </div>
      )}
    </div>
  );
}
