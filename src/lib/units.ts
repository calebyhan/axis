import type { Units } from "@/types";

const POUNDS_PER_KG = 2.20462;

export function weightUnit(units: Units): string {
  return units === "imperial" ? "lbs" : "kg";
}

export function distanceUnit(units: Units): string {
  return units === "imperial" ? "mi" : "km";
}

export function formatWeight(kg: number, units: Units): string {
  const value = kgToDisplayWeight(kg, units);
  return value >= 1000 ? `${(value / 1000).toFixed(1)}k` : value % 1 === 0 ? String(Math.round(value)) : value.toFixed(1);
}

export function kgToDisplayWeight(kg: number, units: Units): number {
  return units === "imperial" ? kg * POUNDS_PER_KG : kg;
}

export function displayWeightToKg(weight: number, units: Units): number {
  return units === "imperial" ? weight / POUNDS_PER_KG : weight;
}

export function roundDisplayWeight(weight: number): number {
  return Math.round(weight * 10) / 10;
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
