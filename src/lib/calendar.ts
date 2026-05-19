export type CalendarActivity = { start_time: string; type: string; date?: string };

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

function buildDayKinds(
  activities: CalendarActivity[],
  skipOverrides: CalendarSkipOverride[]
): Map<string, Set<ActivityKind>> {
  const dayKinds = new Map<string, Set<ActivityKind>>();

  for (const { start_time, type, date } of activities) {
    const kind = getActivityKind(type);
    if (!kind) continue;
    const key = date ?? localDateKey(new Date(start_time));
    const kinds = dayKinds.get(key) ?? new Set<ActivityKind>();
    kinds.add(kind);
    dayKinds.set(key, kinds);
  }

  for (const override of skipOverrides) {
    const kinds = dayKinds.get(override.date) ?? new Set<ActivityKind>();
    kinds.add(override.slot);
    dayKinds.set(override.date, kinds);
  }

  return dayKinds;
}

function getDayCompletionCount(
  kinds: Set<ActivityKind> | undefined,
  plan?: CalendarDayPlan
): number {
  const workoutDone = !!plan?.workoutSatisfiedByRest || !!kinds?.has("workout");
  const cardioDone = !!plan?.cardioSatisfiedByRest || !!kinds?.has("cardio");

  if (plan?.hasWorkoutSlot && plan?.hasCardioSlot) return Number(workoutDone) + Number(cardioDone);
  if (plan?.hasWorkoutSlot) return workoutDone ? 1 : 0;
  if (plan?.hasCardioSlot) return cardioDone ? 1 : 0;
  return kinds ? kinds.size : 0;
}

function getRequiredCompletionCount(plan?: CalendarDayPlan): number {
  return plan?.hasWorkoutSlot && plan?.hasCardioSlot ? 2 : 1;
}

export function buildCalendarActiveDays(
  activities: CalendarActivity[],
  dayPlans: CalendarDayPlan[],
  skipOverrides: CalendarSkipOverride[],
  today = new Date(),
  visibleStart?: Date
): Map<string, number> {
  const dayKinds = buildDayKinds(activities, skipOverrides);
  const map = new Map<string, number>();
  for (const [key, kinds] of dayKinds) {
    map.set(key, kinds.has("workout") && kinds.has("cardio") ? 2 : 1);
  }

  const plansByDay = new Map(dayPlans.map((p) => [p.dayOfWeek, p]));
  const todayKey = localDateKey(today);
  const plannedRangeStart = visibleStart ? new Date(visibleStart) : new Date(today);
  if (!visibleStart) plannedRangeStart.setDate(today.getDate() - today.getDay());
  plannedRangeStart.setHours(0, 0, 0, 0);

  const cursor = new Date(plannedRangeStart);
  while (localDateKey(cursor) <= todayKey) {
    const key = localDateKey(cursor);
    const plan = plansByDay.get((cursor.getDay() + 6) % 7);
    if (plan) {
      const kinds = dayKinds.get(key);
      const count = getDayCompletionCount(kinds, plan);
      if (count > 0) map.set(key, count);
    }
    cursor.setDate(cursor.getDate() + 1);
  }

  return map;
}

export function buildActivityStreak(
  activities: CalendarActivity[],
  dayPlans: CalendarDayPlan[],
  skipOverrides: CalendarSkipOverride[],
  today = new Date(),
  maxDays = 120
): number {
  const dayKinds = buildDayKinds(activities, skipOverrides);
  const plansByDay = new Map(dayPlans.map((p) => [p.dayOfWeek, p]));
  const cursor = new Date(today);
  cursor.setHours(0, 0, 0, 0);
  let streak = 0;

  for (let i = 0; i < maxDays; i++) {
    const key = localDateKey(cursor);
    const plan = plansByDay.get((cursor.getDay() + 6) % 7);
    const completionCount = getDayCompletionCount(dayKinds.get(key), plan);
    const requiredCount = getRequiredCompletionCount(plan);

    if (completionCount >= requiredCount && requiredCount > 0) {
      streak++;
    } else if (i > 0) {
      break;
    }

    cursor.setDate(cursor.getDate() - 1);
  }

  return streak;
}
