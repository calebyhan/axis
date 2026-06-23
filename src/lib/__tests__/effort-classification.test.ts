import { describe, expect, it } from "vitest";
import { classifyEffort, type ClassificationInput } from "@/lib/effort-classification";
import type { HRZone } from "@/lib/hr-zones";
import type { PaceZone } from "@/lib/pace-zones";

const HR_ZONES: HRZone[] = [
  { min: 0, max: 114 },
  { min: 114, max: 133 },
  { min: 133, max: 152 },
  { min: 152, max: 171 },
  { min: 171, max: -1 },
];

// sec/km: Recovery(slowest) → Anaerobic(fastest)
const PACE_ZONES: PaceZone[] = [
  { min: 420, max: -1 },   // Recovery: >7:00/km
  { min: 360, max: 420 },  // Endurance: 6:00-7:00
  { min: 315, max: 360 },  // Tempo: 5:15-6:00
  { min: 285, max: 315 },  // Threshold: 4:45-5:15
  { min: 255, max: 285 },  // VO2 Max: 4:15-4:45
  { min: 0, max: 255 },    // Anaerobic: <4:15
];

describe("classifyEffort", () => {
  describe("PR detection (tier A)", () => {
    it("classifies a run with a PR as race tier", () => {
      const activity: ClassificationInput = {
        best_efforts: [{ name: "5k", elapsed_time: 1200, distance: 5000, pr_rank: 1 }],
      };
      const result = classifyEffort(activity, HR_ZONES, PACE_ZONES);
      expect(result.tier).toBe("race");
      expect(result.vdotWeight).toBe(1.0);
      expect(result.signals[0]).toContain("PR");
    });

    it("ignores non-PR best efforts", () => {
      const activity: ClassificationInput = {
        best_efforts: [{ name: "5k", elapsed_time: 1200, distance: 5000, pr_rank: 2 }],
        suffer_score: 40,
      };
      const result = classifyEffort(activity, HR_ZONES, PACE_ZONES);
      expect(result.tier).not.toBe("race");
    });
  });

  describe("suffer score classification", () => {
    it("classifies suffer_score >= 150 as race", () => {
      const result = classifyEffort({ suffer_score: 160 }, HR_ZONES, PACE_ZONES);
      expect(result.tier).toBe("race");
      expect(result.vdotWeight).toBe(1.0);
    });

    it("classifies suffer_score >= 100 as hard", () => {
      const result = classifyEffort({ suffer_score: 120 }, HR_ZONES, PACE_ZONES);
      expect(result.tier).toBe("hard");
      expect(result.vdotWeight).toBe(0.8);
    });

    it("classifies suffer_score >= 50 as moderate", () => {
      const result = classifyEffort({ suffer_score: 65 }, HR_ZONES, PACE_ZONES);
      expect(result.tier).toBe("moderate");
      expect(result.vdotWeight).toBe(0.4);
    });

    it("classifies suffer_score < 50 as easy", () => {
      const result = classifyEffort({ suffer_score: 30 }, HR_ZONES, PACE_ZONES);
      expect(result.tier).toBe("easy");
      expect(result.vdotWeight).toBe(0);
    });
  });

  describe("HR zone classification", () => {
    it("classifies Z4-Z5 HR as hard", () => {
      const result = classifyEffort({ avg_heartrate: 165 }, HR_ZONES, PACE_ZONES);
      expect(result.tier).toBe("hard");
    });

    it("classifies Z5 HR as hard", () => {
      const result = classifyEffort({ avg_heartrate: 180 }, HR_ZONES, PACE_ZONES);
      expect(result.tier).toBe("hard");
    });

    it("classifies Z3 HR as moderate", () => {
      const result = classifyEffort({ avg_heartrate: 145 }, HR_ZONES, PACE_ZONES);
      expect(result.tier).toBe("moderate");
    });

    it("classifies Z1-Z2 HR as easy", () => {
      const result = classifyEffort({ avg_heartrate: 110 }, HR_ZONES, PACE_ZONES);
      expect(result.tier).toBe("easy");
    });

    it("prefers suffer_score over HR zone", () => {
      const result = classifyEffort(
        { avg_heartrate: 180, suffer_score: 30 },
        HR_ZONES,
        PACE_ZONES
      );
      expect(result.tier).toBe("easy");
    });
  });

  describe("pace zone classification", () => {
    it("classifies threshold pace as hard", () => {
      // 300 sec/km = Threshold zone
      const result = classifyEffort({ avg_pace: 300 }, null, PACE_ZONES);
      expect(result.tier).toBe("hard");
    });

    it("classifies tempo pace as moderate", () => {
      // 340 sec/km = Tempo zone
      const result = classifyEffort({ avg_pace: 340 }, null, PACE_ZONES);
      expect(result.tier).toBe("moderate");
    });

    it("classifies recovery pace as easy", () => {
      // 450 sec/km = Recovery zone
      const result = classifyEffort({ avg_pace: 450 }, null, PACE_ZONES);
      expect(result.tier).toBe("easy");
    });
  });

  describe("fallback", () => {
    it("classifies as easy when no signals available", () => {
      const result = classifyEffort({}, null, null);
      expect(result.tier).toBe("easy");
      expect(result.vdotWeight).toBe(0);
      expect(result.signals).toContain("No effort signals");
    });
  });

  describe("key scenario: easy run has minimal weight", () => {
    it("easy run with slow pace and low HR gets tier D with low weight", () => {
      const easyRun: ClassificationInput = {
        avg_pace: 450,       // ~7:30/km, recovery pace
        avg_heartrate: 120,  // Zone 2
        suffer_score: 25,    // Low effort
        distance: 5000,
        duration: 2250,
      };
      const result = classifyEffort(easyRun, HR_ZONES, PACE_ZONES);
      expect(result.tier).toBe("easy");
      expect(result.vdotWeight).toBe(0);
    });
  });
});
