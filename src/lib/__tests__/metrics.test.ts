import { describe, expect, it } from "vitest";

import { classifyTrend } from "../body-weight-trend";
import { computeE1RM } from "../e1rm";
import {
  displayWeightToKg,
  distanceUnit,
  formatDistance,
  formatPace,
  formatWeight,
  kgToDisplayWeight,
  roundDisplayWeight,
  weightUnit,
} from "../units";
import { computeATLCTLTSB, normalizeStrengthTL } from "../training-load";

describe("computeE1RM", () => {
  it("returns the actual weight for one-rep max attempts", () => {
    expect(computeE1RM(140, 1)).toBe(140);
  });

  it("uses the Epley estimate for multi-rep sets", () => {
    expect(computeE1RM(100, 5)).toBeCloseTo(116.6667, 4);
    expect(computeE1RM(80, 10)).toBeCloseTo(106.6667, 4);
  });

  it("keeps zero-rep edge input at the entered weight", () => {
    expect(computeE1RM(100, 0)).toBe(100);
  });
});

describe("unit labels and formatters", () => {
  it("returns metric and imperial unit labels", () => {
    expect(weightUnit("metric")).toBe("kg");
    expect(weightUnit("imperial")).toBe("lbs");
    expect(distanceUnit("metric")).toBe("km");
    expect(distanceUnit("imperial")).toBe("mi");
  });

  it("formats metric weights with integer, decimal, and compact thousands output", () => {
    expect(formatWeight(82, "metric")).toBe("82");
    expect(formatWeight(82.25, "metric")).toBe("82.3");
    expect(formatWeight(1250, "metric")).toBe("1.3k");
  });

  it("formats imperial weights after converting from kilograms", () => {
    expect(formatWeight(100, "imperial")).toBe("220.5");
    expect(formatWeight(500, "imperial")).toBe("1.1k");
  });

  it("converts editable weight values between storage kg and display units", () => {
    expect(kgToDisplayWeight(10, "metric")).toBe(10);
    expect(displayWeightToKg(10, "metric")).toBe(10);
    expect(kgToDisplayWeight(10, "imperial")).toBeCloseTo(22.0462, 4);
    expect(displayWeightToKg(22.0462, "imperial")).toBeCloseTo(10, 4);
    expect(roundDisplayWeight(22.0462)).toBe(22);
  });

  it("formats metric and imperial distances to two decimals", () => {
    expect(formatDistance(5, "metric")).toBe("5.00");
    expect(formatDistance(5, "imperial")).toBe("3.11");
  });

  it("formats pace for metric, imperial, null, and zero values", () => {
    expect(formatPace(300, "metric")).toBe("5:00/km");
    expect(formatPace(300, "imperial")).toBe("8:03/mi");
    expect(formatPace(null, "metric")).toBe("—");
    expect(formatPace(0, "imperial")).toBe("—");
  });
});

describe("classifyTrend", () => {
  const date = (day: number) => new Date(`2024-01-${String(day).padStart(2, "0")}T00:00:00Z`);

  it("requires at least three readings", () => {
    expect(
      classifyTrend([
        { date: date(1), weight: 80 },
        { date: date(2), weight: 80.5 },
      ])
    ).toBe("maintaining");
  });

  it("returns maintaining when all readings share the same timestamp", () => {
    const sameDate = date(1);

    expect(
      classifyTrend([
        { date: sameDate, weight: 80 },
        { date: sameDate, weight: 81 },
        { date: sameDate, weight: 82 },
      ])
    ).toBe("maintaining");
  });

  it("classifies gains, losses, and near-threshold maintenance", () => {
    expect(
      classifyTrend([
        { date: date(1), weight: 80 },
        { date: date(8), weight: 80.21 },
        { date: date(15), weight: 80.42 },
      ])
    ).toBe("gaining");

    expect(
      classifyTrend([
        { date: date(1), weight: 80.42 },
        { date: date(8), weight: 80.21 },
        { date: date(15), weight: 80 },
      ])
    ).toBe("losing");

    expect(
      classifyTrend([
        { date: date(1), weight: 80 },
        { date: date(8), weight: 80.19 },
        { date: date(15), weight: 80.38 },
      ])
    ).toBe("maintaining");
  });
});

describe("training load metrics", () => {
  it("sorts load days, smooths ATL/CTL from starting values, and rounds displayed points", () => {
    expect(
      computeATLCTLTSB(
        [
          { date: "2024-01-03", runTL: 20, strengthTL: 10 },
          { date: "2024-01-01", runTL: 40, strengthTL: 30 },
          { date: "2024-01-02", runTL: 0, strengthTL: 100 },
        ],
        14,
        42
      )
    ).toEqual([
      { date: "2024-01-01", atl: 22, ctl: 42.7, tsb: 20.7, dailyTL: 70 },
      { date: "2024-01-02", atl: 33.1, ctl: 44, tsb: 10.9, dailyTL: 100 },
      { date: "2024-01-03", atl: 32.7, ctl: 43.7, tsb: 11, dailyTL: 30 },
    ]);
  });

  it("normalizes strength load on a 0-200 scale with a hard cap", () => {
    expect(normalizeStrengthTL(0)).toBe(0);
    expect(normalizeStrengthTL(12345)).toBe(12.345);
    expect(normalizeStrengthTL(250000)).toBe(200);
  });
});
