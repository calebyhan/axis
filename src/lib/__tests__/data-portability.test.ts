import { describe, expect, it } from "vitest";
import {
  coercePortableData,
  countPortableRows,
  createPortableData,
  parsePortableJson,
  portableDataFromCsv,
  portableDataToCsv,
  preparePortableImport,
} from "@/lib/data-portability";

const TEST_HR_ZONES = [
  { min: 0, max: 120 },
  { min: 120, max: 140 },
  { min: 140, max: 160 },
  { min: 160, max: 180 },
  { min: 180, max: -1 },
];

const TEST_PACE_ZONES = [
  { min: 420, max: -1 },
  { min: 360, max: 420 },
  { min: 315, max: 360 },
  { min: 285, max: 315 },
  { min: 255, max: 285 },
  { min: 0, max: 255 },
];

describe("data portability", () => {
  it("round-trips portable data through CSV", () => {
    const data = createPortableData({
      profile: {
        id: "user-1",
        units: "imperial",
        accent_color: "blue",
        display_name: "Caleb",
        hr_zones: TEST_HR_ZONES,
        pace_zones: TEST_PACE_ZONES,
        strava_access_token: "secret",
      },
      day_types: [
        {
          id: "day-type-1",
          name: "Push",
          category: "strength",
          muscle_focus: ["chest", "triceps"],
        },
      ],
      activities: [
        {
          id: "activity-1",
          user_id: "user-1",
          type: "manual_run",
          source: "manual",
          start_time: "2026-05-13T12:00:00.000Z",
          distance: 5000,
          tags: ["easy", "outside"],
          splits: [{ split: 1, elapsed_time: 300 }],
        },
      ],
      session_sets: [
        {
          id: "set-1",
          activity_id: "activity-1",
          exercise_id: "exercise-1",
          set_number: 1,
          reps: 5,
          weight: 100,
          rpe: 8,
        },
      ],
    });

    const csv = portableDataToCsv(data);
    const parsed = portableDataFromCsv(csv);

    expect(parsed.profile).toEqual({
      id: "user-1",
      units: "imperial",
      accent_color: "blue",
      display_name: "Caleb",
      hr_zones: TEST_HR_ZONES,
      pace_zones: TEST_PACE_ZONES,
    });
    expect(parsed.day_types).toEqual(data.day_types);
    expect(parsed.activities).toEqual(data.activities);
    expect(parsed.session_sets).toEqual(data.session_sets);
  });

  it("coerces legacy JSON exports that used sets and checkins keys", () => {
    const data = parsePortableJson(JSON.stringify({
      activities: [{ id: "activity-1" }],
      sets: [{ id: "set-1", activity_id: "activity-1" }],
      checkins: [{ id: "checkin-1", date: "2026-05-13" }],
    }));

    expect(data.session_sets).toEqual([{ id: "set-1", activity_id: "activity-1" }]);
    expect(data.daily_checkins).toEqual([{ id: "checkin-1", date: "2026-05-13" }]);
    expect(countPortableRows(data)).toBe(3);
  });

  it("rewrites ownership and strips non-portable import columns", () => {
    const data = coercePortableData({
      profile: {
        id: "old-user",
        units: "metric",
        hr_zones: TEST_HR_ZONES,
        pace_zones: TEST_PACE_ZONES,
        strava_access_token: "secret",
        created_at: "2026-05-13T00:00:00.000Z",
      },
      weekly_schedule: [{ id: "schedule-1", user_id: "old-user", day_of_week: 0, active: true }],
      daily_checkins: [{ id: "checkin-1", user_id: "old-user", date: "2026-05-13", body_weight: 82 }],
      session_sets: [{ id: "set-1", activity_id: "activity-1", reps: 5 }],
    });

    const prepared = preparePortableImport(data, "new-user");

    expect(prepared.profile).toEqual({
      id: "new-user",
      units: "metric",
      hr_zones: TEST_HR_ZONES,
      pace_zones: TEST_PACE_ZONES,
    });
    expect(prepared.weekly_schedule).toEqual([{ user_id: "new-user", day_of_week: 0, active: true }]);
    expect(prepared.daily_checkins).toEqual([{ user_id: "new-user", date: "2026-05-13", body_weight: 82 }]);
    expect(prepared.session_sets).toEqual([{ activity_id: "activity-1", reps: 5 }]);
  });
});
