import type { Activity, DayType, WeeklyScheduleRow } from "@/types";

export interface ChecklistItem {
  planned: DayType;
  dayOfWeek: number;
  matched: Activity | null;
}

function activityMatchesDayType(activity: Activity, dayType: DayType): boolean {
  if (dayType.category === "run") {
    if (!["run", "manual_run"].includes(activity.type)) return false;
    if (dayType.name === "Rest") return false;
    return true;
  }

  if (activity.type !== "workout") return false;
  return true;
}

export function matchChecklist(
  schedule: WeeklyScheduleRow[],
  activities: Activity[]
): ChecklistItem[] {
  const activeSchedule = schedule.filter((s) => s.active && s.day_type);
  const sortedActivities = [...activities].sort(
    (a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime()
  );

  // scheduleId → activityId — single canonical mapping, no aliasing
  const scheduleToActivity = new Map<string, string>();
  const usedActivityIds = new Set<string>();

  for (const activity of sortedActivities) {
    const eligible = activeSchedule.filter(
      (s) =>
        !scheduleToActivity.has(s.id) &&
        s.day_type &&
        activityMatchesDayType(activity, s.day_type!)
    );

    if (eligible.length === 0) continue;

    const activityDate = new Date(activity.start_time);
    const activityIsoDay = (activityDate.getDay() + 6) % 7;

    eligible.sort(
      (a, b) =>
        Math.abs(a.day_of_week - activityIsoDay) -
        Math.abs(b.day_of_week - activityIsoDay)
    );

    const match = eligible[0];
    scheduleToActivity.set(match.id, activity.id);
    usedActivityIds.add(activity.id);
  }

  const activityById = new Map(activities.map((a) => [a.id, a]));

  return activeSchedule
    .filter((s) => s.day_type)
    .map((s) => {
      const matchedActivityId = scheduleToActivity.get(s.id) ?? null;
      return {
        planned: s.day_type!,
        dayOfWeek: s.day_of_week,
        matched: matchedActivityId ? (activityById.get(matchedActivityId) ?? null) : null,
      };
    })
    .sort((a, b) => a.dayOfWeek - b.dayOfWeek);
}
