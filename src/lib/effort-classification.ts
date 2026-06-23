import type { HRZone } from "@/lib/hr-zones";
import type { PaceZone } from "@/lib/pace-zones";
import type { BestEffort } from "@/types";

export type EffortTier = "race" | "hard" | "moderate" | "easy";

export interface EffortClassification {
  tier: EffortTier;
  vdotWeight: number;
  signals: string[];
}

export interface ClassificationInput {
  avg_heartrate?: number | null;
  avg_pace?: number | null;
  suffer_score?: number | null;
  best_efforts?: BestEffort[] | null;
  distance?: number | null;
  duration?: number | null;
}

const TIER_WEIGHTS: Record<EffortTier, number> = {
  race: 1.0,
  hard: 0.8,
  moderate: 0.4,
  easy: 0.0,
};

function getHRZoneIndex(hr: number, zones: HRZone[]): number {
  for (let i = zones.length - 1; i >= 0; i--) {
    if (hr >= zones[i].min) return i + 1;
  }
  return 1;
}

function getPaceZoneIndex(paceSecPerKm: number, zones: PaceZone[]): number {
  // Pace zones: lower pace = faster. Zone ordering: Recovery(slowest) → Anaerobic(fastest)
  // zones[0] = Recovery (highest sec/km), zones[5] = Anaerobic (lowest sec/km)
  for (let i = zones.length - 1; i >= 0; i--) {
    const zone = zones[i];
    if (paceSecPerKm <= zone.min) return i + 1;
    if (zone.max !== -1 && paceSecPerKm <= zone.max) return i + 1;
  }
  return 1;
}

export function classifyEffort(
  activity: ClassificationInput,
  hrZones: HRZone[] | null,
  paceZones: PaceZone[] | null
): EffortClassification {
  const signals: string[] = [];

  // 1. Check for PR — tier A
  const hasPR = (activity.best_efforts ?? []).some((e) => e.pr_rank === 1);
  if (hasPR) {
    const prEffort = activity.best_efforts!.find((e) => e.pr_rank === 1);
    signals.push(`PR on ${prEffort?.name ?? "effort"}`);
    return { tier: "race", vdotWeight: TIER_WEIGHTS.race, signals };
  }

  // 2. Check suffer score
  if (activity.suffer_score != null) {
    if (activity.suffer_score >= 150) {
      signals.push(`Suffer score ${activity.suffer_score} (≥150)`);
      return { tier: "race", vdotWeight: TIER_WEIGHTS.race, signals };
    }
    if (activity.suffer_score >= 100) {
      signals.push(`Suffer score ${activity.suffer_score} (≥100)`);
      return { tier: "hard", vdotWeight: TIER_WEIGHTS.hard, signals };
    }
    if (activity.suffer_score >= 50) {
      signals.push(`Suffer score ${activity.suffer_score} (≥50)`);
      return { tier: "moderate", vdotWeight: TIER_WEIGHTS.moderate, signals };
    }
    signals.push(`Suffer score ${activity.suffer_score} (<50)`);
    return { tier: "easy", vdotWeight: TIER_WEIGHTS.easy, signals };
  }

  // 3. Check HR zone
  if (activity.avg_heartrate != null && hrZones && hrZones.length >= 5) {
    const zone = getHRZoneIndex(activity.avg_heartrate, hrZones);
    signals.push(`HR Zone ${zone}`);

    if (zone >= 4) return { tier: "hard", vdotWeight: TIER_WEIGHTS.hard, signals };
    if (zone === 3) return { tier: "moderate", vdotWeight: TIER_WEIGHTS.moderate, signals };
    return { tier: "easy", vdotWeight: TIER_WEIGHTS.easy, signals };
  }

  // 4. Check pace zone
  if (activity.avg_pace != null && paceZones && paceZones.length >= 6) {
    const zone = getPaceZoneIndex(activity.avg_pace, paceZones);
    signals.push(`Pace Zone ${zone}`);

    if (zone >= 4) return { tier: "hard", vdotWeight: TIER_WEIGHTS.hard, signals };
    if (zone === 3) return { tier: "moderate", vdotWeight: TIER_WEIGHTS.moderate, signals };
    return { tier: "easy", vdotWeight: TIER_WEIGHTS.easy, signals };
  }

  // 5. Fallback: exclude
  signals.push("No effort signals");
  return { tier: "easy", vdotWeight: TIER_WEIGHTS.easy, signals };
}
