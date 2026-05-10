import { describe, expect, it } from "vitest";
import { hasSplits, resizeSplits, resolveSplitsForUnits } from "@/lib/splits";
import type { Split } from "@/types";

function split(overrides: Partial<Split> = {}): Split {
  return {
    split: 1,
    distance: 1000,
    elapsed_time: 300,
    moving_time: 300,
    elevation_difference: 5,
    average_speed: 1000 / 300,
    average_grade_adjusted_speed: null,
    average_heartrate: 150,
    pace_zone: null,
    ...overrides,
  };
}

describe("run splits", () => {
  it("prefers stored splits that match the selected unit system", () => {
    const metric = [split({ split: 1, distance: 1000 })];
    const standard = [split({ split: 1, distance: 1609, moving_time: 480 })];

    expect(resolveSplitsForUnits({ metric, standard }, "metric")).toBe(metric);
    expect(resolveSplitsForUnits({ metric, standard }, "imperial")).toBe(standard);
  });

  it("resizes legacy metric-only splits for imperial display", () => {
    const imperial = resolveSplitsForUnits(
      [
        split({ split: 1, distance: 1000, moving_time: 300, elapsed_time: 300 }),
        split({ split: 2, distance: 1000, moving_time: 300, elapsed_time: 300 }),
      ],
      "imperial"
    );

    expect(imperial).toHaveLength(2);
    expect(imperial[0]).toMatchObject({
      split: 1,
      distance: 1609,
      moving_time: 483,
      elapsed_time: 483,
    });
    expect(imperial[0].average_speed).toBeCloseTo(1000 / 300, 5);
    expect(imperial[1]).toMatchObject({
      split: 2,
      distance: 391,
      moving_time: 117,
      elapsed_time: 117,
    });
  });

  it("can resize standard splits back to kilometers when metric splits are missing", () => {
    const metric = resizeSplits(
      [split({ split: 1, distance: 1609.344, moving_time: 480, elapsed_time: 480 })],
      1000
    );

    expect(metric).toHaveLength(2);
    expect(metric[0]).toMatchObject({
      split: 1,
      distance: 1000,
      moving_time: 298,
      elapsed_time: 298,
    });
  });

  it("detects legacy and unit-grouped split payloads", () => {
    expect(hasSplits([split()])).toBe(true);
    expect(hasSplits({ metric: [], standard: [split()] })).toBe(true);
    expect(hasSplits({ metric: [], standard: [] })).toBe(false);
    expect(hasSplits(null)).toBe(false);
  });
});
