import type { Units } from "@/types";

export function weightUnit(units: Units): string {
  return units === "imperial" ? "lbs" : "kg";
}

export function distanceUnit(units: Units): string {
  return units === "imperial" ? "mi" : "km";
}

export function formatWeight(kg: number, units: Units): string {
  const value = units === "imperial" ? kg * 2.20462 : kg;
  return value >= 1000 ? `${(value / 1000).toFixed(1)}k` : value % 1 === 0 ? String(Math.round(value)) : value.toFixed(1);
}

export function formatDistance(km: number, units: Units): string {
  return units === "imperial" ? (km * 0.621371).toFixed(2) : km.toFixed(2);
}

export function formatPace(secondsPerKm: number | null, units: Units): string {
  if (!secondsPerKm) return "—";
  const secs = units === "imperial" ? secondsPerKm / 0.621371 : secondsPerKm;
  const m = Math.floor(secs / 60);
  const s = Math.round(secs % 60);
  return `${m}:${String(s).padStart(2, "0")}/${units === "imperial" ? "mi" : "km"}`;
}
