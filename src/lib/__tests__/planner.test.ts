import { describe, expect, it } from "vitest";
import type { DayType, ScheduleOverride, WeeklyScheduleRow } from "@/types";
import {
  WORKOUT_REST_DAY_TYPE,
  buildPlannedSlots,
  dateForISOWeekday,
  getTodayPlannedSlots,
  localDateStr,
  startOfWeek,
  toISODayOfWeek,
} from "../planner";

const push: DayType = {
  id: "push",
  name: "Push",
  category: "strength",
  muscle_focus: ["chest", "triceps"],
};

const pull: DayType = {
  id: "pull",
  name: "Pull",
  category: "strength",
  muscle_focus: ["upper_back", "biceps"],
};

const easyRun: DayType = {
  id: "easy-run",
  name: "Easy Run",
  category: "run",
  muscle_focus: null,
};

function row(overrides: Partial<WeeklyScheduleRow>): WeeklyScheduleRow {
  return {
    id: "row",
    day_of_week: 0,
    day_type_id: null,
    cardio_day_type_id: null,
    active: true,
    ...overrides,
  };
}

function scheduleOverride(overrides: Partial<ScheduleOverride>): ScheduleOverride {
  return {
    id: "override",
    user_id: "user",
    date: "2025-01-13",
    slot: "workout",
    day_type_id: null,
    ...overrides,
  };
}

describe("planner date helpers", () => {
  it("formats local dates and maps between JS days and ISO weekdays", () => {
    const wednesday = new Date(2025, 0, 15, 14, 30);
    const monday = new Date(2025, 0, 13, 8);
    const sunday = new Date(2025, 0, 19, 8);

    expect(localDateStr(wednesday)).toBe("2025-01-15");
    expect(localDateStr(startOfWeek(wednesday))).toBe("2025-01-12");
    expect(toISODayOfWeek(monday)).toBe(0);
    expect(toISODayOfWeek(sunday)).toBe(6);
  });

  it("returns dates for ISO weekdays from the Sunday week anchor", () => {
    const weekStart = startOfWeek(new Date(2025, 0, 15));

    expect(dateForISOWeekday(weekStart, 0)).toBe("2025-01-13");
    expect(dateForISOWeekday(weekStart, 2)).toBe("2025-01-15");
    expect(dateForISOWeekday(weekStart, 6)).toBe("2025-01-12");
  });
});

describe("buildPlannedSlots", () => {
  it("builds workout and cardio slots for active days only", () => {
    const weekStart = startOfWeek(new Date(2025, 0, 15));
    const schedule: WeeklyScheduleRow[] = [
      row({
        id: "mon",
        day_of_week: 0,
        day_type_id: push.id,
        cardio_day_type_id: easyRun.id,
        day_type: push,
        cardio_day_type: easyRun,
      }),
      row({
        id: "tue-inactive",
        day_of_week: 1,
        day_type_id: pull.id,
        active: false,
        day_type: pull,
      }),
      row({
        id: "sun-rest",
        day_of_week: 6,
        day_type_id: null,
        day_type: undefined,
      }),
    ];

    const slots = buildPlannedSlots(schedule, [], weekStart, new Map());

    expect(slots).toHaveLength(3);
    expect(slots.map((slot) => `${slot.kind}:${slot.scheduleId}:${slot.date}`)).toEqual([
      "cardio:mon:2025-01-13",
      "workout:mon:2025-01-13",
      "workout:sun-rest:2025-01-12",
    ]);
    expect(slots.find((slot) => slot.scheduleId === "sun-rest")?.planned).toEqual(WORKOUT_REST_DAY_TYPE);
  });

  it("applies workout and cardio overrides, including skipped slots", () => {
    const weekStart = startOfWeek(new Date(2025, 0, 15));
    const dayTypeMap = new Map([
      [pull.id, pull],
      [easyRun.id, easyRun],
    ]);
    const schedule: WeeklyScheduleRow[] = [
      row({
        id: "mon",
        day_of_week: 0,
        day_type_id: push.id,
        cardio_day_type_id: easyRun.id,
        day_type: push,
        cardio_day_type: easyRun,
      }),
    ];
    const overrides: ScheduleOverride[] = [
      scheduleOverride({ id: "workout-swap", slot: "workout", day_type_id: pull.id }),
      scheduleOverride({ id: "cardio-skip", slot: "cardio", day_type_id: null }),
    ];

    const slots = buildPlannedSlots(schedule, overrides, weekStart, dayTypeMap);
    const cardio = slots.find((slot) => slot.kind === "cardio");
    const workout = slots.find((slot) => slot.kind === "workout");

    expect(workout).toMatchObject({
      planned: push,
      effective: pull,
      isOverridden: true,
    });
    expect(cardio).toMatchObject({
      planned: easyRun,
      effective: null,
      isOverridden: true,
    });
  });

  it("returns only today's planned slots", () => {
    const today = new Date(2025, 0, 15, 9);
    const schedule: WeeklyScheduleRow[] = [
      row({ id: "mon", day_of_week: 0, day_type_id: push.id, day_type: push }),
      row({
        id: "wed",
        day_of_week: 2,
        day_type_id: pull.id,
        cardio_day_type_id: easyRun.id,
        day_type: pull,
        cardio_day_type: easyRun,
      }),
    ];

    const slots = getTodayPlannedSlots(schedule, [], new Map(), today);

    expect(slots.map((slot) => `${slot.kind}:${slot.scheduleId}:${slot.date}`)).toEqual([
      "cardio:wed:2025-01-15",
      "workout:wed:2025-01-15",
    ]);
  });
});
