import { describe, expect, it } from "vitest";
import {
  DEFAULT_PACE_ZONES,
  formatPaceSeconds,
  normalizePaceZones,
  paceBoundariesToZones,
  paceSecondsPerKmToUnitSeconds,
  paceUnitSecondsToSecondsPerKm,
  paceZonesToBoundaries,
  parsePaceInput,
  normalizePaceZoneBoundaries,
} from "@/lib/pace-zones";

describe("pace zones", () => {
  it("normalizes six slow-to-fast zones", () => {
    expect(normalizePaceZones([
      { min: 420, max: -1 },
      { min: 360, max: 420 },
      { min: 315, max: 360 },
      { min: 285, max: 315 },
      { min: 255, max: 285 },
      { min: 0, max: 255 },
    ])).toEqual([
      { min: 420, max: -1 },
      { min: 360, max: 420 },
      { min: 315, max: 360 },
      { min: 285, max: 315 },
      { min: 255, max: 285 },
      { min: 0, max: 255 },
    ]);
  });

  it("rejects invalid zone shapes", () => {
    expect(normalizePaceZones([{ min: 420, max: -1 }])).toBeNull();
    expect(normalizePaceZones([
      { min: 420, max: -1 },
      { min: 360, max: -1 },
      { min: 315, max: 360 },
      { min: 285, max: 315 },
      { min: 255, max: 285 },
      { min: 0, max: 255 },
    ])).toBeNull();
    expect(normalizePaceZones([
      { min: 420, max: -1 },
      { min: 360, max: 430 },
      { min: 315, max: 360 },
      { min: 285, max: 315 },
      { min: 255, max: 285 },
      { min: 0, max: 255 },
    ])).toBeNull();
  });

  it("parses and formats pace inputs", () => {
    expect(parsePaceInput("7:05")).toBe(425);
    expect(parsePaceInput("7")).toBe(420);
    expect(parsePaceInput("7:99")).toBeNull();
    expect(formatPaceSeconds(425)).toBe("7:05");
  });

  it("converts between canonical km pace and display units", () => {
    const mileSeconds = paceSecondsPerKmToUnitSeconds(300, "imperial");
    expect(Math.round(mileSeconds)).toBe(483);
    expect(Math.round(paceUnitSecondsToSecondsPerKm(mileSeconds, "imperial"))).toBe(300);
  });

  it("keeps a built-in fallback", () => {
    expect(normalizePaceZones(DEFAULT_PACE_ZONES)).toEqual(DEFAULT_PACE_ZONES);
  });

  it("converts ordered divider values to contiguous pace zones", () => {
    expect(normalizePaceZoneBoundaries([420, 360, 315, 285, 255])).toEqual([420, 360, 315, 285, 255]);
    expect(paceBoundariesToZones([420, 360, 315, 285, 255])).toEqual([
      { min: 420, max: -1 },
      { min: 360, max: 420 },
      { min: 315, max: 360 },
      { min: 285, max: 315 },
      { min: 255, max: 285 },
      { min: 0, max: 255 },
    ]);
    expect(paceZonesToBoundaries(DEFAULT_PACE_ZONES)).toEqual([420, 360, 315, 285, 255]);
  });

  it("rejects dividers that cross or collapse neighboring pace zones", () => {
    expect(normalizePaceZoneBoundaries([420, 420, 315, 285, 255])).toBeNull();
    expect(normalizePaceZoneBoundaries([420, 430, 315, 285, 255])).toBeNull();
    expect(paceBoundariesToZones([420, 360, 315, 285, 0])).toBeNull();
  });
});
