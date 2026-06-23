import type { EffortClassification } from "./effort-classification";

// ── Daniels' VDOT Formulas ─────────────────────────────────────────────────
// Based on Jack Daniels' Running Formula oxygen cost model.
// VO2 = oxygen cost at a given velocity (m/min) and time (min)
// %VO2max = fraction of VO2max sustainable for a given duration
// VDOT = VO2 / %VO2max

function oxygenCost(velocityMPerMin: number): number {
  return (
    -4.6 +
    0.182258 * velocityMPerMin +
    0.000104 * velocityMPerMin ** 2
  );
}

function vo2maxFraction(timeMinutes: number): number {
  return (
    0.8 +
    0.1894393 * Math.exp(-0.012778 * timeMinutes) +
    0.2989558 * Math.exp(-0.1932605 * timeMinutes)
  );
}

const MIN_VDOT = 10;
const MAX_VDOT = 85;
const MIN_DISTANCE_METERS = 1500;
const MIN_DURATION_SECONDS = 300;

export function estimateVDOT(distanceMeters: number, timeSeconds: number): number | null {
  if (distanceMeters < MIN_DISTANCE_METERS || timeSeconds < MIN_DURATION_SECONDS) return null;

  const timeMinutes = timeSeconds / 60;
  const velocityMPerMin = distanceMeters / timeMinutes;

  const vo2 = oxygenCost(velocityMPerMin);
  const fraction = vo2maxFraction(timeMinutes);

  if (fraction <= 0 || vo2 <= 0) return null;

  const vdot = vo2 / fraction;
  if (vdot < MIN_VDOT || vdot > MAX_VDOT) return null;

  return Math.round(vdot * 10) / 10;
}

// ── Race Time Prediction ────────────────────────────────────────────────────
// Binary search: find the time at targetDistance that yields the given VDOT.

export const RACE_DISTANCES = [
  { label: "1 Mile", meters: 1609.34 },
  { label: "5K", meters: 5000 },
  { label: "10K", meters: 10000 },
  { label: "Half", meters: 21097.5 },
  { label: "Marathon", meters: 42195 },
] as const;

export function predictRaceTime(vdot: number, targetDistanceMeters: number): number | null {
  if (vdot < MIN_VDOT || vdot > MAX_VDOT) return null;

  let lo = 60;
  let hi = 300 * 60;

  for (let i = 0; i < 100; i++) {
    const mid = (lo + hi) / 2;
    const timeMinutes = mid / 60;
    const velocityMPerMin = targetDistanceMeters / timeMinutes;

    const vo2 = oxygenCost(velocityMPerMin);
    const fraction = vo2maxFraction(timeMinutes);

    if (fraction <= 0) {
      hi = mid;
      continue;
    }

    const estimatedVdot = vo2 / fraction;

    if (Math.abs(estimatedVdot - vdot) < 0.01) return Math.round(mid);

    if (estimatedVdot > vdot) {
      lo = mid;
    } else {
      hi = mid;
    }
  }

  return Math.round((lo + hi) / 2);
}

// ── Race Predictions ────────────────────────────────────────────────────────

export interface RacePrediction {
  label: string;
  distanceMeters: number;
  predictedSeconds: number;
  paceSecondsPerKm: number;
  confidence: "high" | "medium" | "low";
}

export function predictAllRaceTimes(
  vdot: number,
  confidence: "high" | "medium" | "low",
  longestQualityEffortMeters: number,
  prFloors?: Map<string, number>
): RacePrediction[] {
  return RACE_DISTANCES.map(({ label, meters }) => {
    let predictedSeconds = predictRaceTime(vdot, meters);
    if (!predictedSeconds) {
      return {
        label,
        distanceMeters: meters,
        predictedSeconds: 0,
        paceSecondsPerKm: 0,
        confidence: "low" as const,
      };
    }

    const prFloor = prFloors?.get(label);
    if (prFloor && prFloor < predictedSeconds) {
      predictedSeconds = prFloor;
    }

    let distanceConfidence = confidence;
    if (meters > longestQualityEffortMeters * 6) {
      distanceConfidence = "low";
    } else if (meters > longestQualityEffortMeters * 3 && distanceConfidence === "high") {
      distanceConfidence = "medium";
    }

    return {
      label,
      distanceMeters: meters,
      predictedSeconds,
      paceSecondsPerKm: predictedSeconds / (meters / 1000),
      confidence: distanceConfidence,
    };
  });
}

// ── Weighted VDOT from Multiple Efforts ─────────────────────────────────────

export interface VDOTEffort {
  vdot: number;
  weight: number;
  date: string;
  activityId: string;
  distanceMeters: number;
  tier: EffortClassification["tier"];
  effortLabel: string;
}

const RECENCY_DECAY_DAYS = 90;

function recencyWeight(daysSinceRun: number): number {
  return Math.exp(-daysSinceRun / RECENCY_DECAY_DAYS);
}

export function computeWeightedVDOT(efforts: VDOTEffort[]): number | null {
  if (efforts.length === 0) return null;

  let totalWeight = 0;
  let weightedSum = 0;
  const now = Date.now();

  for (const effort of efforts) {
    if (effort.weight === 0) continue;
    const daysSince = (now - new Date(effort.date).getTime()) / (1000 * 60 * 60 * 24);
    const w = effort.weight * recencyWeight(daysSince);
    weightedSum += effort.vdot * w;
    totalWeight += w;
  }

  if (totalWeight === 0) return null;
  return Math.round((weightedSum / totalWeight) * 10) / 10;
}

// ── VDOT Trend ──────────────────────────────────────────────────────────────

export interface VDOTDataPoint {
  date: string;
  vdot: number;
  tier: EffortClassification["tier"];
  effortLabel: string;
  activityId: string;
}

export interface VDOTTrend {
  current: number | null;
  points: VDOTDataPoint[];
  smoothed: { date: string; vdot: number }[];
  direction: "improving" | "maintaining" | "declining" | "insufficient";
  predictions: RacePrediction[];
  confidence: "high" | "medium" | "low";
  qualityEffortCount: number;
}

export function computeVDOTTrend(efforts: VDOTEffort[], prFloors?: Map<string, number>): VDOTTrend {
  const sorted = [...efforts].sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
  );

  const qualitySorted = sorted.filter((e) => e.tier !== "easy");

  const points: VDOTDataPoint[] = qualitySorted.map((e) => ({
    date: e.date,
    vdot: e.vdot,
    tier: e.tier,
    effortLabel: e.effortLabel,
    activityId: e.activityId,
  }));

  // Smoothed line: 14-day EWA over quality-effort days only
  const alpha = 1 / 7;
  const smoothed: { date: string; vdot: number }[] = [];
  let ewa: number | null = null;

  for (const point of qualitySorted) {
    if (ewa === null) {
      ewa = point.vdot;
    } else {
      ewa = ewa * (1 - alpha) + point.vdot * alpha;
    }
    smoothed.push({ date: point.date, vdot: Math.round(ewa * 10) / 10 });
  }

  // Direction: compare current vs 28 days ago
  const now = Date.now();
  const day28Ago = now - 28 * 24 * 60 * 60 * 1000;
  const day60Ago = now - 60 * 24 * 60 * 60 * 1000;
  const day90Ago = now - 90 * 24 * 60 * 60 * 1000;

  const recentEfforts = qualitySorted.filter(
    (e) => new Date(e.date).getTime() > day60Ago
  );
  const last90DaysAB = sorted.filter(
    (e) =>
      new Date(e.date).getTime() > day90Ago &&
      (e.tier === "race" || e.tier === "hard")
  );
  const hasLongEffort = last90DaysAB.some((e) => {
    const estimatedDuration = e.distanceMeters / 3; // rough ~5 m/s pace → ~200s/km
    return estimatedDuration > 1200; // > 20 min
  });

  let confidence: "high" | "medium" | "low";
  if (last90DaysAB.length >= 3 && hasLongEffort) {
    confidence = "high";
  } else if (last90DaysAB.length >= 1) {
    confidence = "medium";
  } else {
    confidence = "low";
  }

  let direction: VDOTTrend["direction"];
  if (recentEfforts.length < 3) {
    direction = "insufficient";
  } else {
    const currentSmoothed = smoothed[smoothed.length - 1]?.vdot ?? 0;
    const pastSmoothed =
      smoothed.findLast((s) => new Date(s.date).getTime() <= day28Ago)?.vdot ??
      currentSmoothed;

    const delta = currentSmoothed - pastSmoothed;
    if (delta > 0.5) direction = "improving";
    else if (delta < -0.5) direction = "declining";
    else direction = "maintaining";
  }

  const currentVDOT = computeWeightedVDOT(sorted);

  const longestQualityEffort = sorted.reduce(
    (max, e) => Math.max(max, e.distanceMeters),
    0
  );

  const predictions = currentVDOT
    ? predictAllRaceTimes(currentVDOT, confidence, longestQualityEffort, prFloors)
    : [];

  return {
    current: currentVDOT,
    points,
    smoothed,
    direction,
    predictions,
    confidence,
    qualityEffortCount: sorted.length,
  };
}
