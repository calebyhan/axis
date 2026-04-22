export const dynamic = "force-dynamic";

import { getActivitiesFeed, getWorkoutMuscleCoverage } from "@/lib/queries/activity";
import { RunCard } from "@/components/activity/RunCard";
import { WorkoutCard } from "@/components/activity/WorkoutCard";
import type { Activity, MuscleGroup } from "@/types";

export default async function ActivityPage() {
  const activities = await getActivitiesFeed(undefined, 40) as Activity[];

  // Fetch muscle coverage for workouts
  const workoutActivities = activities.filter((a) => a.type === "workout");
  const coverageMap = new Map<string, Partial<Record<MuscleGroup, number>>>();
  await Promise.all(
    workoutActivities.slice(0, 10).map(async (a) => {
      const coverage = await getWorkoutMuscleCoverage(a.id);
      coverageMap.set(a.id, coverage as Partial<Record<MuscleGroup, number>>);
    })
  );

  return (
    <div className="px-4 py-6 max-w-2xl mx-auto">
      <h1 className="text-xl font-semibold mb-6">Activity</h1>

      {activities.length === 0 ? (
        <div className="card p-6 text-center">
          <p className="text-muted text-sm">No activities yet. Connect Strava or log a session.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {activities.map((activity) => {
            if (activity.type === "workout") {
              return (
                <WorkoutCard
                  key={activity.id}
                  activity={activity}
                  coverage={coverageMap.get(activity.id) ?? {}}
                />
              );
            }
            return <RunCard key={activity.id} activity={activity} />;
          })}
        </div>
      )}
    </div>
  );
}
