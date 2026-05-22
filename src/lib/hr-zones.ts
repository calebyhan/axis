export interface HRZone {
  min: number;
  max: number; // -1 means no upper bound.
}

export type HRZoneMethod = "custom" | "strava" | "max_hr";
export type HRZoneSource = "custom" | "profile" | "strava" | "strava_cached" | "max_hr" | "default";

export const DEFAULT_HR_ZONES: HRZone[] = [
  { min: 0, max: 114 },
  { min: 114, max: 133 },
  { min: 133, max: 152 },
  { min: 152, max: 171 },
  { min: 171, max: -1 },
];

export const DEFAULT_MAX_HEART_RATE = 190;

const REQUIRED_ZONE_COUNT = 5;
const REQUIRED_BOUNDARY_COUNT = REQUIRED_ZONE_COUNT - 1;
const MIN_MAX_HEART_RATE = 100;
const MAX_MAX_HEART_RATE = 240;

function finiteNumber(value: unknown): number | null {
  const numberValue = typeof value === "number" ? value : Number(value);
  return Number.isFinite(numberValue) ? numberValue : null;
}

export function normalizeHRZones(value: unknown): HRZone[] | null {
  if (!Array.isArray(value) || value.length !== REQUIRED_ZONE_COUNT) return null;

  const zones: HRZone[] = [];
  let previousMax: number | null = null;

  for (let index = 0; index < value.length; index += 1) {
    const source = value[index];
    if (!source || typeof source !== "object" || Array.isArray(source)) return null;

    const min = finiteNumber((source as { min?: unknown }).min);
    const max = finiteNumber((source as { max?: unknown }).max);
    if (min == null || max == null) return null;

    const normalizedMin = Math.round(min);
    const normalizedMax = max === -1 ? -1 : Math.round(max);
    const isLast = index === value.length - 1;

    if (normalizedMin < 0) return null;
    if (!isLast && normalizedMax === -1) return null;
    if (normalizedMax !== -1 && normalizedMax <= normalizedMin) return null;
    if (previousMax != null && normalizedMin < previousMax) return null;

    zones.push({ min: normalizedMin, max: normalizedMax });
    previousMax = normalizedMax === -1 ? normalizedMin : normalizedMax;
  }

  return zones;
}

export function normalizeHRZoneMethod(value: unknown): HRZoneMethod | null {
  return value === "custom" || value === "strava" || value === "max_hr" ? value : null;
}

export function normalizeMaxHeartRate(value: unknown): number | null {
  const maxHeartRate = finiteNumber(value);
  if (maxHeartRate == null) return null;

  const rounded = Math.round(maxHeartRate);
  if (rounded < MIN_MAX_HEART_RATE || rounded > MAX_MAX_HEART_RATE) return null;
  return rounded;
}

export function maxHeartRateToZones(value: unknown): HRZone[] | null {
  const maxHeartRate = normalizeMaxHeartRate(value);
  if (!maxHeartRate) return null;

  return normalizeHRZones([
    { min: 0, max: Math.round(maxHeartRate * 0.6) },
    { min: Math.round(maxHeartRate * 0.6), max: Math.round(maxHeartRate * 0.7) },
    { min: Math.round(maxHeartRate * 0.7), max: Math.round(maxHeartRate * 0.8) },
    { min: Math.round(maxHeartRate * 0.8), max: Math.round(maxHeartRate * 0.9) },
    { min: Math.round(maxHeartRate * 0.9), max: -1 },
  ]);
}

export function normalizeHRZoneBoundaries(value: unknown): number[] | null {
  if (!Array.isArray(value) || value.length !== REQUIRED_BOUNDARY_COUNT) return null;

  const boundaries: number[] = [];
  let previous = 0;

  for (const source of value) {
    const boundary = finiteNumber(source);
    if (boundary == null) return null;

    const normalizedBoundary = Math.round(boundary);
    if (normalizedBoundary <= previous) return null;

    boundaries.push(normalizedBoundary);
    previous = normalizedBoundary;
  }

  return boundaries;
}

export function hrZonesToBoundaries(value: unknown): number[] | null {
  const zones = normalizeHRZones(value);
  if (!zones) return null;

  return zones.slice(0, -1).map((zone) => zone.max);
}

export function hrBoundariesToZones(value: unknown): HRZone[] | null {
  const boundaries = normalizeHRZoneBoundaries(value);
  if (!boundaries) return null;

  const zones: HRZone[] = boundaries.map((boundary, index) => ({
    min: index === 0 ? 0 : boundaries[index - 1],
    max: boundary,
  }));
  zones.push({ min: boundaries[boundaries.length - 1], max: -1 });

  return normalizeHRZones(zones);
}
