import type { Activity, DayType, ScheduleOverride, WeeklyScheduleRow } from "@/types";
import { buildPlannedSlots } from "@/lib/planner";
import { activityMatchesPlannedType } from "@/lib/adherence";
import { DEFAULT_TIME_ZONE, isoDayFromDateKey, zonedDateKey } from "@/lib/time-zone";

export interface ChecklistSlot {
  planned: DayType;
  effective: DayType | null; // null = skip override (intentional rest)
  matched: Activity | null;
  isOverridden: boolean;
  date: string; // YYYY-MM-DD for the specific day in current week
  kind: "workout" | "cardio";
}

export interface ChecklistDay {
  dayOfWeek: number;
  date: string;
  workout: ChecklistSlot | null;
  cardio: ChecklistSlot | null;
}

export function matchChecklist(
  schedule: WeeklyScheduleRow[],
  activities: Activity[],
  overrides: ScheduleOverride[],
  weekStart: Date,
  dayTypeMap: Map<string, DayType>,
  timeZone = DEFAULT_TIME_ZONE
): ChecklistDay[] {
  const active = schedule.filter((s) => s.active);
  const sortedActivities = [...activities].sort(
    (a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime()
  );

  const allSlots = buildPlannedSlots(active, overrides, weekStart, dayTypeMap);

  const slotToActivity = new Map<string, string>();

  for (const activity of sortedActivities) {
    const eligible = allSlots.filter(
      (sl) => !slotToActivity.has(sl.id) && sl.effective !== null && activityMatchesPlannedType(activity, sl.effective)
    );
    if (eligible.length === 0) continue;

    const activityIsoDay = isoDayFromDateKey(zonedDateKey(activity.start_time, timeZone));
    eligible.sort(
      (a, b) => Math.abs(a.dayOfWeek - activityIsoDay) - Math.abs(b.dayOfWeek - activityIsoDay)
    );

    slotToActivity.set(eligible[0].id, activity.id);
  }

  const activityById = new Map(activities.map((a) => [a.id, a]));

  const dayMap = new Map<number, ChecklistDay>();
  for (const sl of allSlots) {
    if (!dayMap.has(sl.dayOfWeek)) {
      dayMap.set(sl.dayOfWeek, { dayOfWeek: sl.dayOfWeek, date: sl.date, workout: null, cardio: null });
    }
    const day = dayMap.get(sl.dayOfWeek)!;
    const matched = slotToActivity.has(sl.id) ? (activityById.get(slotToActivity.get(sl.id)!) ?? null) : null;
    day[sl.kind] = {
      planned: sl.planned,
      effective: sl.effective,
      matched,
      isOverridden: sl.isOverridden,
      date: sl.date,
      kind: sl.kind,
    };
  }

  return [...dayMap.values()].sort((a, b) => a.dayOfWeek - b.dayOfWeek);
}
