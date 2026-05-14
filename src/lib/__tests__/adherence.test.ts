import { describe, expect, it } from "vitest";
import type { Activity, DayType } from "@/types";
import type { PlannedSlot } from "../planner";
import { activityMatchesPlannedType, deriveAdherence } from "../adherence";
import { WORKOUT_REST_DAY_TYPE } from "../planner";

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

function activity(overrides: Partial<Activity>): Activity {
  return {
    id: "activity",
    user_id: "user",
    strava_activity_id: null,
    type: "workout",
    day_type_id: null,
    start_time: "2025-01-13T10:00:00.000Z",
    duration: 3600,
    source: "manual",
    distance: null,
    avg_heartrate: null,
    max_heartrate: null,
    suffer_score: null,
    calories: null,
    elevation_gain: null,
    avg_pace: null,
    tags: null,
    notes: null,
    name: null,
    summary_polyline: null,
    splits: null,
    best_efforts: null,
    avg_cadence: null,
    avg_watts: null,
    elapsed_time: null,
    max_speed: null,
    average_temp: null,
    ...overrides,
  };
}

function slot(overrides: Partial<PlannedSlot>): PlannedSlot {
  const effective = overrides.effective === undefined ? push : overrides.effective;

  return {
    id: "workout:mon",
    scheduleId: "mon",
    dayOfWeek: 0,
    date: "2025-01-13",
    kind: "workout",
    planned: push,
    effective,
    isOverridden: false,
    ...overrides,
  };
}

describe("activityMatchesPlannedType", () => {
  it("matches explicit day type ids before activity type fallbacks", () => {
    expect(activityMatchesPlannedType({ type: "ride", day_type_id: push.id }, push)).toBe(true);
    expect(activityMatchesPlannedType({ type: "workout", day_type_id: pull.id }, push)).toBe(false);
  });

  it("matches runs and strength workouts by category when no day type id exists", () => {
    expect(activityMatchesPlannedType({ type: "run", day_type_id: null }, easyRun)).toBe(true);
    expect(activityMatchesPlannedType({ type: "manual_run", day_type_id: null }, easyRun)).toBe(true);
    expect(activityMatchesPlannedType({ type: "ride", day_type_id: null }, easyRun)).toBe(false);
    expect(activityMatchesPlannedType({ type: "workout", day_type_id: null }, push)).toBe(true);
    expect(activityMatchesPlannedType({ type: "manual_run", day_type_id: null }, push)).toBe(false);
  });

  it("never matches rest day types", () => {
    expect(activityMatchesPlannedType({ type: "workout", day_type_id: WORKOUT_REST_DAY_TYPE.id }, WORKOUT_REST_DAY_TYPE)).toBe(false);
  });
});

describe("deriveAdherence", () => {
  it("derives completed, swapped, missed, pending, and skipped statuses while ignoring rest slots", () => {
    const slots: PlannedSlot[] = [
      slot({ id: "workout:mon", scheduleId: "mon", dayOfWeek: 0, date: "2025-01-13", planned: push, effective: push }),
      slot({ id: "workout:tue", scheduleId: "tue", dayOfWeek: 1, date: "2025-01-14", planned: pull, effective: pull }),
      slot({ id: "cardio:wed", scheduleId: "wed", dayOfWeek: 2, date: "2025-01-15", kind: "cardio", planned: easyRun, effective: easyRun }),
      slot({ id: "workout:thu", scheduleId: "thu", dayOfWeek: 3, date: "2025-01-16", planned: push, effective: null, isOverridden: true }),
      slot({ id: "cardio:fri", scheduleId: "fri", dayOfWeek: 4, date: "2025-01-17", kind: "cardio", planned: easyRun, effective: easyRun }),
      slot({ id: "workout:sun", scheduleId: "sun", dayOfWeek: 6, date: "2025-01-12", planned: WORKOUT_REST_DAY_TYPE, effective: WORKOUT_REST_DAY_TYPE }),
    ];
    const activities: Activity[] = [
      activity({ id: "push-done", day_type_id: push.id, start_time: "2025-01-13T12:00:00.000Z" }),
      activity({ id: "pull-done-late", day_type_id: pull.id, start_time: "2025-01-16T12:00:00.000Z" }),
    ];

    const adherence = deriveAdherence(slots, activities, new Date(2025, 0, 17, 9));

    expect(adherence.slots.map(({ slot: item, matched, status }) => [item.id, matched?.id ?? null, status])).toEqual([
      ["workout:mon", "push-done", "completed"],
      ["workout:tue", "pull-done-late", "swapped"],
      ["cardio:wed", null, "missed"],
      ["workout:thu", null, "skipped"],
      ["cardio:fri", null, "pending"],
    ]);
    expect(adherence.summary).toEqual({
      planned: 4,
      completed: 1,
      swapped: 1,
      missed: 1,
      skipped: 1,
      pending: 1,
      completionRate: 50,
    });
  });

  it("uses the configured timezone when deciding if an activity completed a planned day", () => {
    const slots: PlannedSlot[] = [
      slot({
        id: "cardio:wed",
        scheduleId: "wed",
        dayOfWeek: 2,
        date: "2026-05-13",
        kind: "cardio",
        planned: easyRun,
        effective: easyRun,
      }),
    ];
    const activities: Activity[] = [
      activity({
        id: "evening-run",
        type: "manual_run",
        start_time: "2026-05-14T01:00:00.000Z",
      }),
    ];

    const adherence = deriveAdherence(slots, activities, new Date("2026-05-14T12:00:00.000Z"), "America/New_York");

    expect(adherence.slots[0]).toMatchObject({
      matched: { id: "evening-run" },
      status: "completed",
    });
  });
});
