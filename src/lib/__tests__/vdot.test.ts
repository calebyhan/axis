import { describe, expect, it } from "vitest";
import {
  estimateVDOT,
  predictRaceTime,
  predictAllRaceTimes,
  computeWeightedVDOT,
  computeVDOTTrend,
  type VDOTEffort,
} from "@/lib/vdot";

describe("estimateVDOT", () => {
  it("returns ~48-49 for a 20:00 5K", () => {
    const vdot = estimateVDOT(5000, 20 * 60);
    expect(vdot).not.toBeNull();
    expect(vdot!).toBeGreaterThanOrEqual(47);
    expect(vdot!).toBeLessThanOrEqual(50);
  });

  it("returns ~40-42 for a 24:00 5K", () => {
    const vdot = estimateVDOT(5000, 24 * 60);
    expect(vdot).not.toBeNull();
    expect(vdot!).toBeGreaterThanOrEqual(39);
    expect(vdot!).toBeLessThanOrEqual(43);
  });

  it("returns ~55-57 for a 18:00 5K (strong runner)", () => {
    const vdot = estimateVDOT(5000, 18 * 60);
    expect(vdot).not.toBeNull();
    expect(vdot!).toBeGreaterThanOrEqual(54);
    expect(vdot!).toBeLessThanOrEqual(58);
  });

  it("returns ~50-53 for a 42:00 10K", () => {
    const vdot = estimateVDOT(10000, 42 * 60);
    expect(vdot).not.toBeNull();
    expect(vdot!).toBeGreaterThanOrEqual(49);
    expect(vdot!).toBeLessThanOrEqual(54);
  });

  it("returns null for short distances (<1500m)", () => {
    expect(estimateVDOT(400, 60)).toBeNull();
    expect(estimateVDOT(1000, 4 * 60)).toBeNull();
  });

  it("returns null for short durations (<5 min)", () => {
    expect(estimateVDOT(1500, 4 * 60)).toBeNull();
  });

  it("returns a low VDOT for very slow paces", () => {
    const vdot = estimateVDOT(5000, 60 * 60);
    expect(vdot).not.toBeNull();
    expect(vdot!).toBeLessThan(20);
  });
});

describe("predictRaceTime", () => {
  it("predicts ~20:00 5K for VDOT ~48", () => {
    const seconds = predictRaceTime(48, 5000);
    expect(seconds).not.toBeNull();
    // Should be close to 20:00 (1200s) ± 30s
    expect(seconds!).toBeGreaterThan(1170);
    expect(seconds!).toBeLessThan(1260);
  });

  it("predicts longer times for longer distances", () => {
    const fiveK = predictRaceTime(50, 5000)!;
    const tenK = predictRaceTime(50, 10000)!;
    const half = predictRaceTime(50, 21097.5)!;
    const full = predictRaceTime(50, 42195)!;

    expect(tenK).toBeGreaterThan(fiveK * 1.9);
    expect(half).toBeGreaterThan(tenK * 1.9);
    expect(full).toBeGreaterThan(half * 1.9);
  });

  it("predicts faster times for higher VDOT", () => {
    const slow = predictRaceTime(40, 5000)!;
    const fast = predictRaceTime(55, 5000)!;
    expect(fast).toBeLessThan(slow);
  });

  it("returns null for out-of-range VDOT", () => {
    expect(predictRaceTime(5, 5000)).toBeNull();
    expect(predictRaceTime(90, 5000)).toBeNull();
  });
});

describe("predictAllRaceTimes", () => {
  it("clamps prediction to PR floor when PR is faster", () => {
    const prFloors = new Map([["1 Mile", 330]]); // 5:30 mile PR
    const predictions = predictAllRaceTimes(40, "medium", 5000, prFloors);
    const mile = predictions.find((p) => p.label === "1 Mile")!;
    expect(mile.predictedSeconds).toBe(330);
    expect(mile.paceSecondsPerKm).toBeCloseTo(330 / 1.60934, 0);
  });

  it("keeps VDOT prediction when it is faster than PR", () => {
    const prFloors = new Map([["5K", 2400]]); // 40:00 5K (very slow PR)
    const predictions = predictAllRaceTimes(55, "high", 10000, prFloors);
    const fiveK = predictions.find((p) => p.label === "5K")!;
    expect(fiveK.predictedSeconds).toBeLessThan(2400);
  });

  it("works without prFloors parameter", () => {
    const predictions = predictAllRaceTimes(48, "medium", 5000);
    expect(predictions).toHaveLength(5);
    expect(predictions[0].predictedSeconds).toBeGreaterThan(0);
  });
});

describe("computeWeightedVDOT", () => {
  const baseEffort: Omit<VDOTEffort, "vdot" | "weight" | "date"> = {
    activityId: "1",
    distanceMeters: 5000,
    tier: "hard",
    effortLabel: "5K",
  };

  it("returns null for empty efforts", () => {
    expect(computeWeightedVDOT([])).toBeNull();
  });

  it("returns single effort VDOT for one effort", () => {
    const result = computeWeightedVDOT([
      { ...baseEffort, vdot: 48, weight: 1.0, date: new Date().toISOString() },
    ]);
    expect(result).toBe(48);
  });

  it("weights recent efforts more heavily", () => {
    const recent = new Date().toISOString();
    const old = new Date(Date.now() - 180 * 24 * 60 * 60 * 1000).toISOString();

    const result = computeWeightedVDOT([
      { ...baseEffort, vdot: 50, weight: 1.0, date: recent },
      { ...baseEffort, activityId: "2", vdot: 40, weight: 1.0, date: old },
    ]);

    expect(result).not.toBeNull();
    // Should be closer to 50 (recent) than 40 (old)
    expect(result!).toBeGreaterThan(46);
  });

  it("ignores zero-weight efforts", () => {
    const result = computeWeightedVDOT([
      { ...baseEffort, vdot: 48, weight: 1.0, date: new Date().toISOString() },
      { ...baseEffort, activityId: "2", vdot: 30, weight: 0, date: new Date().toISOString() },
    ]);
    expect(result).toBe(48);
  });
});

describe("computeVDOTTrend", () => {
  it("returns insufficient direction with fewer than 3 efforts", () => {
    const trend = computeVDOTTrend([
      {
        vdot: 48,
        weight: 1.0,
        date: new Date().toISOString(),
        activityId: "1",
        distanceMeters: 5000,
        tier: "hard",
        effortLabel: "5K",
      },
    ]);
    expect(trend.direction).toBe("insufficient");
    expect(trend.current).not.toBeNull();
  });

  it("produces smoothed data points", () => {
    const efforts: VDOTEffort[] = Array.from({ length: 5 }, (_, i) => ({
      vdot: 45 + i,
      weight: 0.8,
      date: new Date(Date.now() - (30 - i * 7) * 24 * 60 * 60 * 1000).toISOString(),
      activityId: String(i),
      distanceMeters: 5000,
      tier: "hard" as const,
      effortLabel: `Run ${i}`,
    }));

    const trend = computeVDOTTrend(efforts);
    expect(trend.smoothed).toHaveLength(5);
    expect(trend.points).toHaveLength(5);
    expect(trend.predictions.length).toBeGreaterThan(0);
  });
});
