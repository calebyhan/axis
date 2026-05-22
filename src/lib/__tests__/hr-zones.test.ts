import { describe, expect, it } from "vitest";
import { DEFAULT_HR_ZONES, normalizeHRZones } from "@/lib/hr-zones";

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
});

