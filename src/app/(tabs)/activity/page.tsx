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
