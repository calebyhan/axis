import type { Activity, DayType, WeeklyScheduleRow } from "@/types";

export interface ChecklistSlot {
  planned: DayType;
  matched: Activity | null;
}

export interface ChecklistDay {
  dayOfWeek: number;
  workout: ChecklistSlot | null;
  cardio: ChecklistSlot | null;
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
): ChecklistDay[] {
  const active = schedule.filter((s) => s.active);
  const sortedActivities = [...activities].sort(
    (a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime()
  );

  type Slot = { scheduleId: string; dayOfWeek: number; type: DayType; kind: "workout" | "cardio"; key: string };

  const allSlots: Slot[] = [];
  for (const s of active) {
    if (s.day_type) allSlots.push({ scheduleId: s.id, dayOfWeek: s.day_of_week, type: s.day_type, kind: "workout", key: `workout:${s.id}` });
    if (s.cardio_day_type) allSlots.push({ scheduleId: s.id, dayOfWeek: s.day_of_week, type: s.cardio_day_type, kind: "cardio", key: `cardio:${s.id}` });
  }

  const slotToActivity = new Map<string, string>();

  for (const activity of sortedActivities) {
    const eligible = allSlots.filter(
      (sl) => !slotToActivity.has(sl.key) && activityMatchesDayType(activity, sl.type)
    );
    if (eligible.length === 0) continue;

    const activityIsoDay = (new Date(activity.start_time).getDay() + 6) % 7;
    eligible.sort(
      (a, b) => Math.abs(a.dayOfWeek - activityIsoDay) - Math.abs(b.dayOfWeek - activityIsoDay)
    );

    slotToActivity.set(eligible[0].key, activity.id);
  }

  const activityById = new Map(activities.map((a) => [a.id, a]));

  // Group by day
  const dayMap = new Map<number, ChecklistDay>();
  for (const sl of allSlots) {
    if (!dayMap.has(sl.dayOfWeek)) {
      dayMap.set(sl.dayOfWeek, { dayOfWeek: sl.dayOfWeek, workout: null, cardio: null });
    }
    const day = dayMap.get(sl.dayOfWeek)!;
    const matched = slotToActivity.has(sl.key) ? (activityById.get(slotToActivity.get(sl.key)!) ?? null) : null;
    day[sl.kind] = { planned: sl.type, matched };
  }

  return [...dayMap.values()].sort((a, b) => a.dayOfWeek - b.dayOfWeek);
}
