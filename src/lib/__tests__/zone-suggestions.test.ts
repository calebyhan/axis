import { describe, expect, it } from "vitest";
import {
  bestRollingDistance,
  suggestHRZones,
  suggestPaceZones,
} from "@/lib/zone-suggestions";

describe("zone suggestions", () => {
  it("suggests max-HR zones when observed max exceeds the stored value", () => {
    const suggestion = suggestHRZones([
      { duration: 45 * 60, avg_heartrate: 161, max_heartrate: 178 },
      { duration: 50 * 60, avg_heartrate: 154, max_heartrate: 174 },
      { duration: 35 * 60, avg_heartrate: 149, max_heartrate: 170 },
      { duration: 65 * 60, avg_heartrate: 142, max_heartrate: 165 },
    ], 170);

    expect(suggestion?.maxHeartRate).toBe(178);
    expect(suggestion?.zones).toEqual([
      { min: 0, max: 107 },
      { min: 107, max: 125 },
      { min: 125, max: 142 },
      { min: 142, max: 160 },
      { min: 160, max: -1 },
    ]);
  });

  it("suggests pace zones from best efforts", () => {
    const suggestion = suggestPaceZones([
      {
        best_efforts: [
          { name: "5k", elapsed_time: 25 * 60, distance: 5000, pr_rank: 1 },
        ],
      },
    ]);

    expect(suggestion?.basis.bestEffortSamples).toBe(1);
    expect(suggestion?.zones).toHaveLength(6);
  });

  it("finds the best rolling stream distance", () => {
    expect(bestRollingDistance([0, 600, 1200, 1800], [0, 2000, 4000, 6000], 1200)).toBe(4000);
  });
});
