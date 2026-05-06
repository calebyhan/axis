import { describe, expect, it } from "vitest";
import { matchChecklist } from "@/lib/checklist";
import { decodePolyline, polylineToSvgPath } from "@/lib/polyline";
import {
  buildActivityRow,
  isSupportedCardioSport,
  mapStravaSportType,
} from "@/lib/strava/activity-row";
import type { Activity, DayType, ScheduleOverride, WeeklyScheduleRow } from "@/types";

const pushDay: DayType = {
  id: "push",
  name: "Push",
  category: "strength",
  muscle_focus: ["chest", "triceps"],
};

const legsDay: DayType = {
  id: "legs",
  name: "Legs",
  category: "strength",
  muscle_focus: ["quads", "hamstrings"],
};

const easyRunDay: DayType = {
  id: "easy-run",
  name: "Easy Run",
  category: "run",
  muscle_focus: null,
};

function activity(overrides: Partial<Activity>): Activity {
  return {
    id: "activity",
    user_id: "user-1",
    strava_activity_id: null,
    type: "workout",
    day_type_id: null,
    start_time: "2025-01-06T12:00:00.000Z",
    duration: 1800,
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

describe("matchChecklist", () => {
  it("matches activities to nearest compatible workout and cardio slots", () => {
    const schedule: WeeklyScheduleRow[] = [
      {
        id: "monday",
        day_of_week: 0,
        day_type_id: pushDay.id,
        cardio_day_type_id: easyRunDay.id,
        active: true,
        day_type: pushDay,
        cardio_day_type: easyRunDay,
      },
      {
        id: "tuesday",
        day_of_week: 1,
        day_type_id: legsDay.id,
        cardio_day_type_id: easyRunDay.id,
        active: true,
        day_type: legsDay,
        cardio_day_type: easyRunDay,
      },
    ];
    const overrides: ScheduleOverride[] = [
      {
        id: "override-workout",
        user_id: "user-1",
        date: "2025-01-07",
        slot: "workout",
        day_type_id: pushDay.id,
      },
      {
        id: "override-cardio",
        user_id: "user-1",
        date: "2025-01-07",
        slot: "cardio",
        day_type_id: null,
      },
    ];
    const activities = [
      activity({
        id: "run-1",
        type: "run",
        distance: 5000,
        start_time: "2025-01-06T14:00:00.000Z",
      }),
      activity({
        id: "push-1",
        day_type_id: pushDay.id,
        start_time: "2025-01-07T14:00:00.000Z",
      }),
    ];

    const result = matchChecklist(
      schedule,
      activities,
      overrides,
      new Date("2025-01-05T00:00:00"),
      new Map([
        [pushDay.id, pushDay],
        [legsDay.id, legsDay],
        [easyRunDay.id, easyRunDay],
      ])
    );

    expect(result).toHaveLength(2);
    expect(result[0]).toMatchObject({ dayOfWeek: 0, date: "2025-01-06" });
    expect(result[0].workout).toMatchObject({
      planned: pushDay,
      effective: pushDay,
      matched: null,
      isOverridden: false,
      kind: "workout",
    });
    expect(result[0].cardio).toMatchObject({
      planned: easyRunDay,
      effective: easyRunDay,
      matched: { id: "run-1" },
      isOverridden: false,
      kind: "cardio",
    });
    expect(result[1]).toMatchObject({ dayOfWeek: 1, date: "2025-01-07" });
    expect(result[1].workout).toMatchObject({
      planned: legsDay,
      effective: pushDay,
      matched: { id: "push-1" },
      isOverridden: true,
      kind: "workout",
    });
    expect(result[1].cardio).toMatchObject({
      planned: easyRunDay,
      effective: null,
      matched: null,
      isOverridden: true,
      kind: "cardio",
    });
  });

  it("ignores inactive schedule rows", () => {
    const result = matchChecklist(
      [
        {
          id: "inactive",
          day_of_week: 2,
          day_type_id: pushDay.id,
          cardio_day_type_id: null,
          active: false,
          day_type: pushDay,
        },
      ],
      [activity({ id: "push-1", day_type_id: pushDay.id })],
      [],
      new Date("2025-01-05T00:00:00"),
      new Map([[pushDay.id, pushDay]])
    );

    expect(result).toEqual([]);
  });
});

describe("polyline helpers", () => {
  it("decodes a Google encoded polyline into latitude and longitude pairs", () => {
    expect(decodePolyline("_p~iF~ps|U_ulLnnqC_mqNvxq`@")).toEqual([
      [38.5, -120.2],
      [40.7, -120.95],
      [43.252, -126.453],
    ]);
  });

  it("returns an empty SVG path when there are fewer than two points", () => {
    expect(polylineToSvgPath([], 100, 60)).toBe("");
    expect(polylineToSvgPath([[38.5, -120.2]], 100, 60)).toBe("");
  });

  it("normalizes decoded points into a padded SVG path and inverts latitude", () => {
    expect(
      polylineToSvgPath(
        [
          [0, 0],
          [1, 1],
        ],
        100,
        100,
        10
      )
    ).toBe("M10.0,90.0L90.0,10.0");
  });

  it("centers flat routes when latitude or longitude range is zero", () => {
    expect(
      polylineToSvgPath(
        [
          [1, 2],
          [1, 4],
        ],
        120,
        80,
        10
      )
    ).toBe("M10.0,15.0L110.0,15.0");
  });
});

describe("Strava activity mapping", () => {
  it("maps supported Strava run and ride sport types", () => {
    expect(mapStravaSportType("Run")).toBe("run");
    expect(mapStravaSportType("VirtualRun")).toBe("run");
    expect(mapStravaSportType("Ride")).toBe("ride");
    expect(mapStravaSportType("VirtualRide")).toBe("ride");
    expect(mapStravaSportType("EBikeRide")).toBe("ride");
    expect(mapStravaSportType("EMountainBikeRide")).toBe("ride");
    expect(mapStravaSportType("GravelRide")).toBe("ride");
    expect(mapStravaSportType("MountainBikeRide")).toBe("ride");
  });

  it("rejects unsupported, empty, and missing Strava sport types", () => {
    expect(mapStravaSportType("Walk")).toBeNull();
    expect(mapStravaSportType("Swim")).toBeNull();
    expect(mapStravaSportType("")).toBeNull();
    expect(mapStravaSportType(null)).toBeNull();
    expect(mapStravaSportType(undefined)).toBeNull();
    expect(isSupportedCardioSport("Ride")).toBe(true);
    expect(isSupportedCardioSport("Walk")).toBe(false);
  });

  it("builds an activity row with mapped fields, derived pace, and nested arrays", () => {
    const row = buildActivityRow("user-1", 12345, {
      sport_type: "Run",
      start_date: "2025-02-01T10:15:00Z",
      moving_time: 1500,
      elapsed_time: 1600,
      distance: 5000,
      average_heartrate: 150,
      max_heartrate: 178,
      suffer_score: 42,
      calories: 350,
      total_elevation_gain: 75,
      average_cadence: 82,
      average_watts: 210,
      max_speed: 5.5,
      name: "Morning Run",
      map: { summary_polyline: "abc123" },
      average_temp: 18,
      splits_metric: [
        {
          split: 1,
          distance: 1000,
          elapsed_time: 300,
          moving_time: 295,
          elevation_difference: 4,
          average_speed: 3.39,
        },
      ],
      best_efforts: [
        {
          name: "1k",
          elapsed_time: 295,
          distance: 1000,
        },
      ],
    });

    expect(row).toMatchObject({
      user_id: "user-1",
      strava_activity_id: 12345,
      type: "run",
      start_time: "2025-02-01T10:15:00Z",
      duration: 1500,
      elapsed_time: 1600,
      source: "strava",
      distance: 5000,
      avg_heartrate: 150,
      max_heartrate: 178,
      suffer_score: 42,
      calories: 350,
      elevation_gain: 75,
      avg_pace: 300,
      avg_cadence: 82,
      avg_watts: 210,
      max_speed: 5.5,
      name: "Morning Run",
      summary_polyline: "abc123",
      average_temp: 18,
      splits: [
        {
          split: 1,
          distance: 1000,
          elapsed_time: 300,
          moving_time: 295,
          elevation_difference: 4,
          average_speed: 3.39,
          average_grade_adjusted_speed: null,
          average_heartrate: null,
          pace_zone: null,
        },
      ],
      best_efforts: [
        {
          name: "1k",
          elapsed_time: 295,
          distance: 1000,
          pr_rank: null,
        },
      ],
    });
  });

  it("normalizes nullable Strava fields and rejects unsupported rows", () => {
    expect(
      buildActivityRow("user-1", 987, {
        sport_type: "Ride",
        start_date: "2025-02-02T10:15:00Z",
        moving_time: 1200,
        distance: 0,
      })
    ).toMatchObject({
      type: "ride",
      elapsed_time: null,
      distance: 0,
      avg_pace: null,
      avg_heartrate: null,
      max_heartrate: null,
      suffer_score: null,
      calories: null,
      elevation_gain: null,
      name: null,
      summary_polyline: null,
      splits: null,
      best_efforts: null,
      average_temp: null,
    });

    expect(() =>
      buildActivityRow("user-1", 987, {
        sport_type: "Walk",
        start_date: "2025-02-02T10:15:00Z",
        moving_time: 1200,
      })
    ).toThrow("Unsupported Strava sport type: Walk");
  });
});
