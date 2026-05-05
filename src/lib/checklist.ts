import type { Activity, DayType, ScheduleOverride, WeeklyScheduleRow } from "@/types";

const WORKOUT_REST_DAY_TYPE: DayType = {
  id: "__workout_rest__",
  name: "Rest",
  category: "strength",
  muscle_focus: null,
};

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

function activityMatchesDayType(activity: Activity, dayType: DayType): boolean {
  if (dayType.name === "Rest") return false;

  if (dayType.category === "run") {
    return ["run", "manual_run"].includes(activity.type);
  }

  return activity.type === "workout";
}

function localDateStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function matchChecklist(
  schedule: WeeklyScheduleRow[],
  activities: Activity[],
  overrides: ScheduleOverride[],
  weekStart: Date,
  dayTypeMap: Map<string, DayType>
): ChecklistDay[] {
  const active = schedule.filter((s) => s.active);
  const sortedActivities = [...activities].sort(
    (a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime()
  );

  const overrideMap = new Map<string, ScheduleOverride>();
  for (const o of overrides) {
    overrideMap.set(`${o.date}:${o.slot}`, o);
  }

  // weekStart is Sunday; ISO dayOfWeek: Mon=0…Sun=6
  // Offset from Sunday: Mon→+1, Tue→+2, …, Sat→+6, Sun→+0
  function slotDate(dayOfWeek: number): string {
    const d = new Date(weekStart);
    d.setDate(d.getDate() + (dayOfWeek + 1) % 7);
    return localDateStr(d);
  }

  type Slot = {
    scheduleId: string;
    dayOfWeek: number;
    date: string;
    planned: DayType;
    effective: DayType | null;
    kind: "workout" | "cardio";
    isOverridden: boolean;
    key: string;
  };

  const allSlots: Slot[] = [];
  for (const s of active) {
    const date = slotDate(s.day_of_week);

    const workoutPlanned = s.day_type ?? WORKOUT_REST_DAY_TYPE;
    const workoutOverride = overrideMap.get(`${date}:workout`);
    const workoutIsOverridden = !!workoutOverride;
    const workoutEffective = workoutIsOverridden
      ? (workoutOverride!.day_type_id ? (dayTypeMap.get(workoutOverride!.day_type_id) ?? null) : null)
      : workoutPlanned;
    allSlots.push({
      scheduleId: s.id, dayOfWeek: s.day_of_week, date,
      planned: workoutPlanned, effective: workoutEffective,
      kind: "workout", isOverridden: workoutIsOverridden,
      key: `workout:${s.id}`,
    });

    if (s.cardio_day_type) {
      const override = overrideMap.get(`${date}:cardio`);
      const isOverridden = !!override;
      const effective = isOverridden
        ? (override!.day_type_id ? (dayTypeMap.get(override!.day_type_id) ?? null) : null)
        : s.cardio_day_type;
      allSlots.push({
        scheduleId: s.id, dayOfWeek: s.day_of_week, date,
        planned: s.cardio_day_type, effective,
        kind: "cardio", isOverridden,
        key: `cardio:${s.id}`,
      });
    }
  }

  const slotToActivity = new Map<string, string>();

  for (const activity of sortedActivities) {
    const eligible = allSlots.filter(
      (sl) => !slotToActivity.has(sl.key) && sl.effective !== null && activityMatchesDayType(activity, sl.effective)
    );
    if (eligible.length === 0) continue;

    const activityIsoDay = (new Date(activity.start_time).getDay() + 6) % 7;
    eligible.sort(
      (a, b) => Math.abs(a.dayOfWeek - activityIsoDay) - Math.abs(b.dayOfWeek - activityIsoDay)
    );

    slotToActivity.set(eligible[0].key, activity.id);
  }

  const activityById = new Map(activities.map((a) => [a.id, a]));

  const dayMap = new Map<number, ChecklistDay>();
  for (const sl of allSlots) {
    if (!dayMap.has(sl.dayOfWeek)) {
      dayMap.set(sl.dayOfWeek, { dayOfWeek: sl.dayOfWeek, date: sl.date, workout: null, cardio: null });
    }
    const day = dayMap.get(sl.dayOfWeek)!;
    const matched = slotToActivity.has(sl.key) ? (activityById.get(slotToActivity.get(sl.key)!) ?? null) : null;
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
