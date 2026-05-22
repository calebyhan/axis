import { describe, expect, it } from "vitest";
import {
  DEFAULT_HR_ZONES,
  maxHeartRateToZones,
  hrBoundariesToZones,
  hrZonesToBoundaries,
  normalizeMaxHeartRate,
  normalizeHRZoneBoundaries,
  normalizeHRZones,
} from "@/lib/hr-zones";

describe("heart-rate zones", () => {
  it("normalizes five ascending zones", () => {
    expect(normalizeHRZones([
      { min: 0, max: 120 },
      { min: 120, max: 140 },
      { min: 140, max: 160 },
      { min: 160, max: 180 },
      { min: 180, max: -1 },
    ])).toEqual([
      { min: 0, max: 120 },
      { min: 120, max: 140 },
      { min: 140, max: 160 },
      { min: 160, max: 180 },
      { min: 180, max: -1 },
    ]);
  });

  it("rejects invalid zone shapes", () => {
    expect(normalizeHRZones([{ min: 0, max: 120 }])).toBeNull();
    expect(normalizeHRZones([
      { min: 0, max: 120 },
      { min: 119, max: 140 },
      { min: 140, max: 160 },
      { min: 160, max: 180 },
      { min: 180, max: -1 },
    ])).toBeNull();
    expect(normalizeHRZones([
      { min: 0, max: 120 },
      { min: 120, max: -1 },
      { min: 140, max: 160 },
      { min: 160, max: 180 },
      { min: 180, max: -1 },
    ])).toBeNull();
  });

  it("keeps a built-in fallback", () => {
    expect(normalizeHRZones(DEFAULT_HR_ZONES)).toEqual(DEFAULT_HR_ZONES);
  });

  it("derives simple max-HR zones", () => {
    expect(normalizeMaxHeartRate(190)).toBe(190);
    expect(normalizeMaxHeartRate(99)).toBeNull();
    expect(maxHeartRateToZones(190)).toEqual([
      { min: 0, max: 114 },
      { min: 114, max: 133 },
      { min: 133, max: 152 },
      { min: 152, max: 171 },
      { min: 171, max: -1 },
    ]);
  });

  it("converts ordered divider values to contiguous zones", () => {
    expect(normalizeHRZoneBoundaries([120, 140, 160, 180])).toEqual([120, 140, 160, 180]);
    expect(hrBoundariesToZones([120, 140, 160, 180])).toEqual([
      { min: 0, max: 120 },
      { min: 120, max: 140 },
      { min: 140, max: 160 },
      { min: 160, max: 180 },
      { min: 180, max: -1 },
    ]);
    expect(hrZonesToBoundaries(DEFAULT_HR_ZONES)).toEqual([114, 133, 152, 171]);
  });

  it("rejects dividers that cross or collapse neighboring zones", () => {
    expect(normalizeHRZoneBoundaries([120, 120, 160, 180])).toBeNull();
    expect(normalizeHRZoneBoundaries([120, 119, 160, 180])).toBeNull();
    expect(hrBoundariesToZones([0, 120, 160, 180])).toBeNull();
  });
});
