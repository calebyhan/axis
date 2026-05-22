import type { Units } from "@/types";

export interface PaceZone {
  min: number; // Fastest bound in seconds per km. 0 means open-ended fast.
  max: number; // Slowest bound in seconds per km. -1 means open-ended slow.
}

export type PaceZoneSource = "profile" | "default";

export const PACE_ZONE_NAMES = ["Recovery", "Endurance", "Tempo", "Threshold", "VO2 Max", "Anaerobic"];

export const DEFAULT_PACE_ZONES: PaceZone[] = [
  { min: 420, max: -1 },
  { min: 360, max: 420 },
  { min: 315, max: 360 },
  { min: 285, max: 315 },
  { min: 255, max: 285 },
  { min: 0, max: 255 },
];

const REQUIRED_ZONE_COUNT = 6;
const METERS_PER_MILE = 1609.34;

function finiteNumber(value: unknown): number | null {
  const numberValue = typeof value === "number" ? value : Number(value);
  return Number.isFinite(numberValue) ? numberValue : null;
}

export function normalizePaceZones(value: unknown): PaceZone[] | null {
  if (!Array.isArray(value) || value.length !== REQUIRED_ZONE_COUNT) return null;

  const zones: PaceZone[] = [];
  let previousMin: number | null = null;

  for (let index = 0; index < value.length; index += 1) {
    const source = value[index];
    if (!source || typeof source !== "object" || Array.isArray(source)) return null;

    const min = finiteNumber((source as { min?: unknown }).min);
    const max = finiteNumber((source as { max?: unknown }).max);
    if (min == null || max == null) return null;

    const normalizedMin = Math.round(min);
    const normalizedMax = max === -1 ? -1 : Math.round(max);
    const isFirst = index === 0;
    const isLast = index === value.length - 1;

    if (normalizedMin < 0) return null;
    if (isFirst && normalizedMax !== -1) return null;
    if (!isFirst && normalizedMax === -1) return null;
    if (!isLast && normalizedMin <= 0) return null;
    if (isLast && normalizedMin !== 0) return null;
    if (normalizedMax !== -1 && normalizedMax <= normalizedMin) return null;
    if (previousMin != null && normalizedMax !== -1 && normalizedMax > previousMin) return null;

    zones.push({ min: normalizedMin, max: normalizedMax });
    previousMin = normalizedMin;
  }

  return zones;
}

export function paceSecondsPerKmToUnitSeconds(secondsPerKm: number, units: Units): number {
  return units === "imperial" ? secondsPerKm * (METERS_PER_MILE / 1000) : secondsPerKm;
}

export function paceUnitSecondsToSecondsPerKm(secondsPerUnit: number, units: Units): number {
  return units === "imperial" ? secondsPerUnit / (METERS_PER_MILE / 1000) : secondsPerUnit;
}

export function formatPaceSeconds(seconds: number): string {
  const totalSeconds = Math.max(0, Math.round(seconds));
  const minutes = Math.floor(totalSeconds / 60);
  const remainderSeconds = totalSeconds % 60;
  return `${minutes}:${String(remainderSeconds).padStart(2, "0")}`;
}

export function parsePaceInput(value: string): number | null {
  const trimmed = value.trim();
  if (!trimmed) return null;

  const parts = trimmed.split(":");
  if (parts.length > 2) return null;

  const minutes = Number(parts[0]);
  const seconds = parts.length === 2 ? Number(parts[1]) : 0;
  if (!Number.isInteger(minutes) || minutes < 0) return null;
  if (!Number.isInteger(seconds) || seconds < 0 || seconds > 59) return null;

  return minutes * 60 + seconds;
}
