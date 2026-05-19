import { describe, expect, it } from "vitest";
import { buildActivityStreak, buildCalendarActiveDays } from "../calendar";

describe("buildCalendarActiveDays", () => {
  it("uses server-provided activity date keys instead of recalculating from runtime local time", () => {
    const activeDays = buildCalendarActiveDays(
      [
        {
          start_time: "2026-05-14T01:00:00.000Z",
          type: "manual_run",
          date: "2026-05-13",
        },
      ],
      [],
      [],
      new Date(2026, 4, 14)
    );

    expect(activeDays.get("2026-05-13")).toBe(1);
    expect(activeDays.has("2026-05-14")).toBe(false);
  });

  it("applies planned rest slots across the visible calendar range", () => {
    const activeDays = buildCalendarActiveDays(
      [
        {
          start_time: "2026-05-13T12:00:00.000Z",
          type: "manual_run",
          date: "2026-05-13",
        },
      ],
      [
        {
          dayOfWeek: 2,
          hasWorkoutSlot: true,
          hasCardioSlot: true,
          workoutSatisfiedByRest: true,
          cardioSatisfiedByRest: false,
        },
      ],
      [],
      new Date(2026, 4, 18),
      new Date(2026, 4, 1)
    );

    expect(activeDays.get("2026-05-13")).toBe(2);
  });

  it("keeps streaks alive through planned rest days in previous weeks", () => {
    const streak = buildActivityStreak(
      [
        { start_time: "2026-05-19T12:00:00.000Z", type: "workout", date: "2026-05-19" },
        { start_time: "2026-05-18T12:00:00.000Z", type: "workout", date: "2026-05-18" },
        { start_time: "2026-05-17T12:00:00.000Z", type: "workout", date: "2026-05-17" },
        { start_time: "2026-05-15T12:00:00.000Z", type: "workout", date: "2026-05-15" },
      ],
      [
        {
          dayOfWeek: 5,
          hasWorkoutSlot: true,
          hasCardioSlot: false,
          workoutSatisfiedByRest: true,
          cardioSatisfiedByRest: false,
        },
      ],
      [],
      new Date(2026, 4, 19)
    );

    expect(streak).toBe(5);
  });

  it("keeps streaks alive through skip overrides in previous weeks", () => {
    const streak = buildActivityStreak(
      [
        { start_time: "2026-05-19T12:00:00.000Z", type: "workout", date: "2026-05-19" },
        { start_time: "2026-05-18T12:00:00.000Z", type: "workout", date: "2026-05-18" },
        { start_time: "2026-05-17T12:00:00.000Z", type: "workout", date: "2026-05-17" },
      ],
      [
        {
          dayOfWeek: 5,
          hasWorkoutSlot: true,
          hasCardioSlot: false,
          workoutSatisfiedByRest: false,
          cardioSatisfiedByRest: false,
        },
      ],
      [{ date: "2026-05-16", slot: "workout" }],
      new Date(2026, 4, 19)
    );

    expect(streak).toBe(4);
  });
});
