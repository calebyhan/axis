import { describe, expect, it } from "vitest";

import { deriveWorkoutPersonalRecords, type WorkoutPrSetRow } from "../workout-prs";

function row(overrides: Partial<WorkoutPrSetRow> & {
  id: string;
  exercise_id: string;
  exerciseName: string;
  activityId: string;
  startTime: string;
  reps: number;
  weight: number;
  set_number: number;
}): WorkoutPrSetRow {
  return {
    id: overrides.id,
    exercise_id: overrides.exercise_id,
    set_number: overrides.set_number,
    reps: overrides.reps,
    weight: overrides.weight,
    created_at: overrides.created_at ?? overrides.startTime,
    activities: {
      id: overrides.activityId,
      start_time: overrides.startTime,
    },
    exercises: {
      name: overrides.exerciseName,
    },
  };
}

describe("deriveWorkoutPersonalRecords", () => {
  it("returns workout e1RM records created inside the selected range", () => {
    const records = deriveWorkoutPersonalRecords(
      [
        row({
          id: "old-bench",
          exercise_id: "bench",
          exerciseName: "Bench Press",
          activityId: "activity-old",
          startTime: "2026-04-01T12:00:00.000Z",
          reps: 5,
          weight: 100,
          set_number: 1,
        }),
        row({
          id: "range-bench-low",
          exercise_id: "bench",
          exerciseName: "Bench Press",
          activityId: "activity-range-1",
          startTime: "2026-05-10T12:00:00.000Z",
          reps: 5,
          weight: 99,
          set_number: 1,
        }),
        row({
          id: "range-bench-pr",
          exercise_id: "bench",
          exerciseName: "Bench Press",
          activityId: "activity-range-2",
          startTime: "2026-05-15T12:00:00.000Z",
          reps: 5,
          weight: 105,
          set_number: 1,
        }),
        row({
          id: "range-squat-pr",
          exercise_id: "squat",
          exerciseName: "Back Squat",
          activityId: "activity-range-3",
          startTime: "2026-05-16T01:00:00.000Z",
          reps: 3,
          weight: 140,
          set_number: 1,
        }),
        row({
          id: "future-bench-pr",
          exercise_id: "bench",
          exerciseName: "Bench Press",
          activityId: "activity-future",
          startTime: "2026-06-01T12:00:00.000Z",
          reps: 5,
          weight: 120,
          set_number: 1,
        }),
      ],
      {
        startInstant: "2026-05-01T04:00:00.000Z",
        endExclusiveInstant: "2026-06-01T04:00:00.000Z",
        timeZone: "America/New_York",
      }
    );

    expect(records.map((record) => record.exerciseName)).toEqual(["Back Squat", "Bench Press"]);
    expect(records[0]).toMatchObject({
      activityId: "activity-range-3",
      date: "2026-05-15",
      e1rm: 154,
    });
    expect(records[1]).toMatchObject({
      activityId: "activity-range-2",
      date: "2026-05-15",
      e1rm: 122.5,
    });
  });

  it("keeps only the best same-exercise PR for a single workout", () => {
    const records = deriveWorkoutPersonalRecords(
      [
        row({
          id: "bench-set-1",
          exercise_id: "bench",
          exerciseName: "Bench Press",
          activityId: "activity-1",
          startTime: "2026-05-10T12:00:00.000Z",
          created_at: "2026-05-10T12:05:00.000Z",
          reps: 5,
          weight: 100,
          set_number: 1,
        }),
        row({
          id: "bench-set-2",
          exercise_id: "bench",
          exerciseName: "Bench Press",
          activityId: "activity-1",
          startTime: "2026-05-10T12:00:00.000Z",
          created_at: "2026-05-10T12:10:00.000Z",
          reps: 5,
          weight: 110,
          set_number: 2,
        }),
      ],
      {
        startInstant: "2026-05-01T00:00:00.000Z",
        endExclusiveInstant: "2026-06-01T00:00:00.000Z",
        timeZone: "UTC",
      }
    );

    expect(records).toHaveLength(1);
    expect(records[0]).toMatchObject({
      setNumber: 2,
      e1rm: 128.3,
    });
  });
});
