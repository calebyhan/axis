export interface HRZone {
  min: number;
  max: number; // -1 means no upper bound.
}

export type HRZoneSource = "profile" | "strava" | "default";

export const DEFAULT_HR_ZONES: HRZone[] = [
  { min: 0, max: 114 },
  { min: 114, max: 133 },
  { min: 133, max: 152 },
  { min: 152, max: 171 },
  { min: 171, max: -1 },
];

const REQUIRED_ZONE_COUNT = 5;

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

