import type { DayType, ScheduleOverride, WeeklyScheduleRow } from "@/types";

export const WORKOUT_REST_DAY_TYPE: DayType = {
  id: "__workout_rest__",
  name: "Rest",
  category: "strength",
  muscle_focus: null,
};

export type PlannedSlotKind = "workout" | "cardio";

export interface PlannedSlot {
  id: string;
  scheduleId: string;
  dayOfWeek: number;
  date: string;
  kind: PlannedSlotKind;
  planned: DayType;
  effective: DayType | null;
  isOverridden: boolean;
}

export function localDateStr(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

export function startOfWeek(today = new Date()): Date {
  const sunday = new Date(today);
  sunday.setDate(today.getDate() - today.getDay());
  sunday.setHours(0, 0, 0, 0);
  return sunday;
}

export function toISODayOfWeek(date: Date): number {
  return (date.getDay() + 6) % 7;
}

export function dateForISOWeekday(weekStart: Date, dayOfWeek: number): string {
  const d = new Date(weekStart);
  d.setDate(d.getDate() + (dayOfWeek + 1) % 7);
  return localDateStr(d);
}

function overrideKey(date: string, slot: PlannedSlotKind): string {
  return `${date}:${slot}`;
}

function resolveOverride(
  override: ScheduleOverride | undefined,
  fallback: DayType,
  dayTypeMap: Map<string, DayType>
): { effective: DayType | null; isOverridden: boolean } {
  if (!override) return { effective: fallback, isOverridden: false };
  return {
    effective: override.day_type_id ? (dayTypeMap.get(override.day_type_id) ?? null) : null,
    isOverridden: true,
  };
}

export function buildPlannedSlots(
  schedule: WeeklyScheduleRow[],
  overrides: ScheduleOverride[],
  weekStart: Date,
  dayTypeMap: Map<string, DayType>
): PlannedSlot[] {
  const active = schedule.filter((s) => s.active);
  const overridesByKey = new Map(overrides.map((o) => [overrideKey(o.date, o.slot), o]));
  const slots: PlannedSlot[] = [];

  for (const row of active) {
    const date = dateForISOWeekday(weekStart, row.day_of_week);

    const workoutPlanned = row.day_type ?? WORKOUT_REST_DAY_TYPE;
    const workoutOverride = resolveOverride(overridesByKey.get(overrideKey(date, "workout")), workoutPlanned, dayTypeMap);
    slots.push({
      id: `workout:${row.id}`,
      scheduleId: row.id,
      dayOfWeek: row.day_of_week,
      date,
      kind: "workout",
      planned: workoutPlanned,
      effective: workoutOverride.effective,
      isOverridden: workoutOverride.isOverridden,
    });

    if (row.cardio_day_type) {
      const cardioOverride = resolveOverride(overridesByKey.get(overrideKey(date, "cardio")), row.cardio_day_type, dayTypeMap);
      slots.push({
        id: `cardio:${row.id}`,
        scheduleId: row.id,
        dayOfWeek: row.day_of_week,
        date,
        kind: "cardio",
        planned: row.cardio_day_type,
        effective: cardioOverride.effective,
        isOverridden: cardioOverride.isOverridden,
      });
    }
  }

  return slots.sort((a, b) => a.dayOfWeek - b.dayOfWeek || a.kind.localeCompare(b.kind));
}

export function getTodayPlannedSlots(
  schedule: WeeklyScheduleRow[],
  overrides: ScheduleOverride[],
  dayTypeMap: Map<string, DayType>,
  today = new Date()
): PlannedSlot[] {
  const isoDay = toISODayOfWeek(today);
  return buildPlannedSlots(schedule, overrides, startOfWeek(today), dayTypeMap).filter((slot) => slot.dayOfWeek === isoDay);
}
