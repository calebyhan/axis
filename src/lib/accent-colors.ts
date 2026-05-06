import type { AccentColor } from "@/types";

export const ACCENT_COLORS: { value: AccentColor; label: string; hex: string }[] = [
  { value: "blue", label: "Blue", hex: "#3B82F6" },
  { value: "green", label: "Green", hex: "#22C55E" },
  { value: "orange", label: "Orange", hex: "#F97316" },
  { value: "purple", label: "Purple", hex: "#A855F7" },
];

export function isAccentColor(value: string): value is AccentColor {
  return ACCENT_COLORS.some((color) => color.value === value);
}
