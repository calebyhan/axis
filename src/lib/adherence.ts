import type { Activity, DayType } from "@/types";
import type { PlannedSlot } from "@/lib/planner";
import { DEFAULT_TIME_ZONE, zonedDateKey, zonedDateTimeToUtc } from "@/lib/time-zone";

export type AdherenceStatus = "completed" | "swapped" | "missed" | "skipped" | "pending";

export interface AdherenceSlot {
  slot: PlannedSlot;
  matched: Activity | null;
  status: AdherenceStatus;
}

export interface AdherenceSummary {
  planned: number;
  completed: number;
  swapped: number;
  missed: number;
  skipped: number;
  pending: number;
  completionRate: number | null;
}

export interface AdherenceWeek {
  weekStart: string;
  slots: AdherenceSlot[];
  summary: AdherenceSummary;
}

export function activityMatchesPlannedType(activity: Pick<Activity, "type" | "day_type_id">, dayType: DayType): boolean {
  if (dayType.name === "Rest") return false;

  if (activity.day_type_id) {
    return activity.day_type_id === dayType.id;
  }

  if (dayType.category === "run") {
    return ["run", "manual_run"].includes(activity.type);
  }

  return activity.type === "workout";
}

function isRestSlot(slot: PlannedSlot): boolean {
  return slot.effective?.name === "Rest";
}

function summarize(slots: AdherenceSlot[]): AdherenceSummary {
  const counts = slots.reduce(
    (acc, item) => {
      acc[item.status] += 1;
      return acc;
    },
    { completed: 0, swapped: 0, missed: 0, skipped: 0, pending: 0 }
  );
  const planned = counts.completed + counts.swapped + counts.missed + counts.pending;
  const done = counts.completed + counts.swapped;

  return {
    planned,
    completed: counts.completed,
    swapped: counts.swapped,
    missed: counts.missed,
    skipped: counts.skipped,
    pending: counts.pending,
    completionRate: planned > 0 ? Math.round((done / planned) * 100) : null,
  };
}

export function deriveAdherence(
  slots: PlannedSlot[],
  activities: Activity[],
  today = new Date(),
  timeZone = DEFAULT_TIME_ZONE
): AdherenceWeek {
  const sortedActivities = activities.toSorted(
    (a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime()
  );
  const actionableSlots = slots.filter((slot) => !isRestSlot(slot));
  const slotToActivity = new Map<string, Activity>();
  const todayStr = zonedDateKey(today, timeZone);

  for (const activity of sortedActivities) {
    const eligible = actionableSlots.filter(
      (slot) =>
        !slotToActivity.has(slot.id) &&
        slot.effective !== null &&
        activityMatchesPlannedType(activity, slot.effective)
    );
    if (eligible.length === 0) continue;

    const activityTime = new Date(activity.start_time).getTime();
    eligible.sort((a, b) => {
      const aTime = zonedDateTimeToUtc(a.date, timeZone, 12).getTime();
      const bTime = zonedDateTimeToUtc(b.date, timeZone, 12).getTime();
      return Math.abs(aTime - activityTime) - Math.abs(bTime - activityTime);
    });

    slotToActivity.set(eligible[0].id, activity);
  }

  const adherenceSlots = actionableSlots.map((slot) => {
    const matched = slotToActivity.get(slot.id) ?? null;
    const matchedDate = matched ? zonedDateKey(matched.start_time, timeZone) : null;
    let status: AdherenceStatus;

    if (slot.effective === null) status = "skipped";
    else if (matched && matchedDate === slot.date) status = "completed";
    else if (matched) status = "swapped";
    else if (slot.date < todayStr) status = "missed";
    else status = "pending";

    return { slot, matched, status };
  });

  return {
    weekStart: slots[0]?.date ?? "",
    slots: adherenceSlots,
    summary: summarize(adherenceSlots),
  };
}
