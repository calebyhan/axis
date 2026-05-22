import { createHash } from "crypto";
import { DEFAULT_MAX_HEART_RATE, maxHeartRateToZones, normalizeMaxHeartRate, type HRZone } from "@/lib/hr-zones";
import { normalizePaceZones, type PaceZone } from "@/lib/pace-zones";
import type { BestEffort } from "@/types";

export type ZoneSuggestionConfidence = "medium" | "high";

export interface ZoneActivityInput {
  id?: string;
  strava_activity_id?: number | null;
  start_time?: string | null;
  distance?: number | null;
  duration?: number | null;
  elapsed_time?: number | null;
  avg_pace?: number | null;
  avg_heartrate?: number | null;
  max_heartrate?: number | null;
  best_efforts?: BestEffort[] | null;
}

export interface StreamPaceEffort {
  activityId: number;
  windowSeconds: number;
  distanceMeters: number;
}

export interface HRZoneSuggestion {
  kind: "max_hr";
  zones: HRZone[];
  hash: string;
  maxHeartRate: number;
  previousMaxHeartRate: number;
  observedMaxHeartRate: number;
  confidence: ZoneSuggestionConfidence;
  summary: string;
  basis: {
    type: "max_hr";
    observedMaxHeartRate: number;
    previousMaxHeartRate: number;
    sampleSize: number;
  };
}

export interface PaceZoneSuggestion {
  kind: "pace";
  zones: PaceZone[];
  hash: string;
  confidence: ZoneSuggestionConfidence;
  summary: string;
  basis: {
    type: "threshold_pace";
    thresholdPaceSecondsPerKm: number;
    bestEffortSamples: number;
    streamSamples: number;
  };
}

export interface ZoneSuggestions {
  hr: HRZoneSuggestion | null;
  pace: PaceZoneSuggestion | null;
}

type PaceCandidate = {
  thresholdPaceSecondsPerKm: number;
  source: "best_effort" | "stream";
  confidence: ZoneSuggestionConfidence | "low";
};

function finitePositive(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value > 0;
}

export function zonesEqual<T extends { min: number; max: number }>(a: T[] | null | undefined, b: T[] | null | undefined): boolean {
  if (!a || !b || a.length !== b.length) return false;
  return a.every((zone, index) => zone.min === b[index].min && zone.max === b[index].max);
}

export function zoneHash(kind: "hr" | "pace", zones: HRZone[] | PaceZone[], basis?: unknown): string {
  return createHash("sha256")
    .update(JSON.stringify({ kind, zones, basis }))
    .digest("hex")
    .slice(0, 16);
}

export function suggestHRZones(
  activities: ZoneActivityInput[],
  currentMaxHeartRate: number = DEFAULT_MAX_HEART_RATE
): HRZoneSuggestion | null {
  const maxHeartRate = normalizeMaxHeartRate(currentMaxHeartRate) ?? DEFAULT_MAX_HEART_RATE;
  const observedMaxValues = activities
    .map((activity) => activity.max_heartrate)
    .filter(finitePositive)
    .map((value) => Math.round(value))
    .filter((value) => normalizeMaxHeartRate(value) != null);

  if (observedMaxValues.length < 2) return null;

  const observedMaxHeartRate = Math.max(...observedMaxValues);
  if (observedMaxHeartRate <= maxHeartRate + 2) return null;

  const suggestedMaxHeartRate = observedMaxHeartRate;
  const zones = maxHeartRateToZones(suggestedMaxHeartRate);
  if (!zones) return null;

  const confirmationCount = observedMaxValues.filter((value) => value >= suggestedMaxHeartRate - 3).length;
  const confidence: ZoneSuggestionConfidence = confirmationCount >= 2 ? "high" : "medium";
  const basis: HRZoneSuggestion["basis"] = {
    type: "max_hr",
    observedMaxHeartRate,
    previousMaxHeartRate: maxHeartRate,
    sampleSize: observedMaxValues.length,
  };

  return {
    kind: "max_hr",
    zones,
    hash: zoneHash("hr", zones, basis),
    maxHeartRate: suggestedMaxHeartRate,
    previousMaxHeartRate: maxHeartRate,
    observedMaxHeartRate,
    confidence,
    summary: `Observed recent max HR of ${observedMaxHeartRate} bpm; current max HR is ${maxHeartRate} bpm.`,
    basis,
  };
}

function estimateThresholdPaceFromBestEffort(effort: BestEffort): PaceCandidate | null {
  if (!finitePositive(effort.distance) || !finitePositive(effort.elapsed_time)) return null;
  if (effort.distance < 1500 || effort.elapsed_time < 5 * 60) return null;

  const targetSeconds = 60 * 60;
  const riegelExponent = 1.06;
  const estimatedOneHourMeters = effort.distance * Math.pow(targetSeconds / effort.elapsed_time, 1 / riegelExponent);
  const thresholdPaceSecondsPerKm = targetSeconds / (estimatedOneHourMeters / 1000);
  if (!Number.isFinite(thresholdPaceSecondsPerKm) || thresholdPaceSecondsPerKm < 150 || thresholdPaceSecondsPerKm > 600) {
    return null;
  }

  const confidence: PaceCandidate["confidence"] =
    effort.elapsed_time >= 20 * 60 && effort.elapsed_time <= 75 * 60 ? "high" : "medium";

  return {
    thresholdPaceSecondsPerKm,
    source: "best_effort",
    confidence,
  };
}

function estimateThresholdPaceFromStreamEffort(effort: StreamPaceEffort): PaceCandidate | null {
  if (!finitePositive(effort.windowSeconds) || !finitePositive(effort.distanceMeters)) return null;
  const pace = effort.windowSeconds / (effort.distanceMeters / 1000);
  if (!Number.isFinite(pace) || pace < 150 || pace > 600) return null;

  return {
    thresholdPaceSecondsPerKm: pace * (effort.windowSeconds >= 30 * 60 ? 1.03 : 1.05),
    source: "stream",
    confidence: effort.windowSeconds >= 30 * 60 ? "high" : "medium",
  };
}

function thresholdPaceZones(thresholdPaceSecondsPerKm: number): PaceZone[] | null {
  const recovery = Math.round(thresholdPaceSecondsPerKm * 1.25);
  const endurance = Math.round(thresholdPaceSecondsPerKm * 1.12);
  const tempo = Math.round(thresholdPaceSecondsPerKm * 1.04);
  const threshold = Math.round(thresholdPaceSecondsPerKm * 0.97);
  const vo2 = Math.round(thresholdPaceSecondsPerKm * 0.9);

  return normalizePaceZones([
    { min: recovery, max: -1 },
    { min: endurance, max: recovery },
    { min: tempo, max: endurance },
    { min: threshold, max: tempo },
    { min: vo2, max: threshold },
    { min: 0, max: vo2 },
  ]);
}

export function suggestPaceZones(
  activities: ZoneActivityInput[],
  streamEfforts: StreamPaceEffort[] = []
): PaceZoneSuggestion | null {
  const bestEffortCandidates = activities.flatMap((activity) =>
    (activity.best_efforts ?? []).flatMap((effort) => {
      const candidate = estimateThresholdPaceFromBestEffort(effort);
      return candidate ? [candidate] : [];
    })
  );
  const streamCandidates = streamEfforts.flatMap((effort) => {
    const candidate = estimateThresholdPaceFromStreamEffort(effort);
    return candidate ? [candidate] : [];
  });
  const credibleCandidates = [...bestEffortCandidates, ...streamCandidates]
    .filter((candidate) => candidate.confidence !== "low")
    .sort((a, b) => a.thresholdPaceSecondsPerKm - b.thresholdPaceSecondsPerKm);

  if (credibleCandidates.length === 0) return null;

  const topCandidates = credibleCandidates.slice(0, 3);
  const selected = topCandidates[Math.floor((topCandidates.length - 1) / 2)];
  const thresholdPaceSecondsPerKm = Math.round(selected.thresholdPaceSecondsPerKm);
  const zones = thresholdPaceZones(thresholdPaceSecondsPerKm);
  if (!zones) return null;

  const highConfidenceCount = credibleCandidates.filter((candidate) => candidate.confidence === "high").length;
  const confidence: ZoneSuggestionConfidence = highConfidenceCount >= 2 || streamCandidates.some((candidate) => candidate.confidence === "high")
    ? "high"
    : "medium";
  const basis: PaceZoneSuggestion["basis"] = {
    type: "threshold_pace",
    thresholdPaceSecondsPerKm,
    bestEffortSamples: bestEffortCandidates.length,
    streamSamples: streamCandidates.length,
  };

  return {
    kind: "pace",
    zones,
    hash: zoneHash("pace", zones, basis),
    confidence,
    summary: `Based on ${bestEffortCandidates.length} best-effort sample${bestEffortCandidates.length === 1 ? "" : "s"}${streamCandidates.length ? ` and ${streamCandidates.length} stream sample${streamCandidates.length === 1 ? "" : "s"}` : ""}.`,
    basis,
  };
}

export function bestRollingDistance(
  time: number[],
  distance: number[],
  windowSeconds: number
): number | null {
  if (time.length !== distance.length || time.length < 2 || windowSeconds <= 0) return null;

  let best = 0;
  let start = 0;

  for (let end = 1; end < time.length; end += 1) {
    while (start < end - 1 && time[end] - time[start + 1] >= windowSeconds) {
      start += 1;
    }

    const elapsed = time[end] - time[start];
    const covered = distance[end] - distance[start];
    if (elapsed < windowSeconds * 0.9 || covered <= 0) continue;

    const normalizedDistance = covered * (windowSeconds / elapsed);
    if (normalizedDistance > best) best = normalizedDistance;
  }

  return best > 0 ? best : null;
}
