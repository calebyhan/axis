export type CalendarActivity = { start_time: string; type: string };

export type CalendarDayPlan = {
  dayOfWeek: number;
  hasWorkoutSlot: boolean;
  hasCardioSlot: boolean;
  workoutSatisfiedByRest: boolean;
  cardioSatisfiedByRest: boolean;
};

export type CalendarSkipOverride = { date: string; slot: "workout" | "cardio" };

type ActivityKind = "workout" | "cardio";

export function localDateKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function getActivityKind(type: string): ActivityKind | null {
  if (type === "workout") return "workout";
  if (type === "run" || type === "manual_run" || type === "ride") return "cardio";
  return null;
}

export function buildCalendarActiveDays(
  activities: CalendarActivity[],
  dayPlans: CalendarDayPlan[],
  skipOverrides: CalendarSkipOverride[],
  today = new Date()
): Map<string, number> {
  const dayKinds = new Map<string, Set<ActivityKind>>();

  for (const { start_time, type } of activities) {
    const kind = getActivityKind(type);
    if (!kind) continue;
    const key = localDateKey(new Date(start_time));
    const kinds = dayKinds.get(key) ?? new Set<ActivityKind>();
    kinds.add(kind);
    dayKinds.set(key, kinds);
  }

  for (const override of skipOverrides) {
    const kinds = dayKinds.get(override.date) ?? new Set<ActivityKind>();
    kinds.add(override.slot);
    dayKinds.set(override.date, kinds);
  }

  const map = new Map<string, number>();
  for (const [key, kinds] of dayKinds) {
    map.set(key, kinds.has("workout") && kinds.has("cardio") ? 2 : 1);
  }

  const plansByDay = new Map(dayPlans.map((p) => [p.dayOfWeek, p]));
  const todayKey = localDateKey(today);
  const weekStart = new Date(today);
  weekStart.setDate(today.getDate() - today.getDay());
  weekStart.setHours(0, 0, 0, 0);

  const cursor = new Date(weekStart);
  while (localDateKey(cursor) <= todayKey) {
    const key = localDateKey(cursor);
    const plan = plansByDay.get((cursor.getDay() + 6) % 7);
    if (plan) {
      const kinds = dayKinds.get(key);
      const workoutDone = plan.workoutSatisfiedByRest || !!kinds?.has("workout");
      const cardioDone = plan.cardioSatisfiedByRest || !!kinds?.has("cardio");
      let count = 0;
      if (plan.hasWorkoutSlot && plan.hasCardioSlot) count = Number(workoutDone) + Number(cardioDone);
      else if (plan.hasWorkoutSlot) count = workoutDone ? 1 : 0;
      else if (plan.hasCardioSlot) count = cardioDone ? 1 : 0;
      else count = kinds ? kinds.size : 0;
      if (count > 0) map.set(key, count);
    }
    cursor.setDate(cursor.getDate() + 1);
  }

  return map;
}
