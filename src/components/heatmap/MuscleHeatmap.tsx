"use client";

import type { MuscleGroup } from "@/types";

interface Props {
  coverage: Partial<Record<MuscleGroup, number>>;
  accent?: string;
  size?: "thumbnail" | "full";
  showBack?: boolean;
}

// Interpolate from #1F1F1F (untrained) to accent (max intensity)
function muscleColor(count: number, max: number, accent: string): string {
  if (count === 0 || max === 0) return "#1F1F1F";
  const ratio = Math.min(count / max, 1);
  // Parse accent hex
  const r = parseInt(accent.slice(1, 3), 16);
  const g = parseInt(accent.slice(3, 5), 16);
  const b = parseInt(accent.slice(5, 7), 16);
  const br = 0x1f, bg = 0x1f, bb = 0x1f;
  const ir = Math.round(br + (r - br) * ratio);
  const ig = Math.round(bg + (g - bg) * ratio);
  const ib = Math.round(bb + (b - bb) * ratio);
  return `rgb(${ir},${ig},${ib})`;
}

export function MuscleHeatmap({ coverage, accent = "#3B82F6", size = "full", showBack = false }: Props) {
  const max = Math.max(1, ...Object.values(coverage).filter((v): v is number => v !== undefined));
  const c = (muscle: MuscleGroup) => muscleColor(coverage[muscle] ?? 0, max, accent);

  const w = size === "thumbnail" ? 80 : 180;
  const h = size === "thumbnail" ? 80 : 200;

  if (showBack) {
    return (
      <svg viewBox="0 0 100 220" width={w} height={h} xmlns="http://www.w3.org/2000/svg">
        {/* Body outline */}
        <ellipse cx="50" cy="18" rx="14" ry="16" fill="#2A2A2A" />
        <rect x="30" y="34" width="40" height="70" rx="8" fill="#2A2A2A" />
        {/* Arms */}
        <rect x="14" y="36" width="14" height="48" rx="6" fill="#2A2A2A" />
        <rect x="72" y="36" width="14" height="48" rx="6" fill="#2A2A2A" />
        {/* Legs */}
        <rect x="32" y="104" width="16" height="60" rx="6" fill="#2A2A2A" />
        <rect x="52" y="104" width="16" height="60" rx="6" fill="#2A2A2A" />
        {/* Calves */}
        <rect x="32" y="164" width="16" height="42" rx="6" fill="#2A2A2A" />
        <rect x="52" y="164" width="16" height="42" rx="6" fill="#2A2A2A" />

        {/* Muscle groups - back */}
        <path id="traps" d="M36 34 Q50 28 64 34 L58 46 Q50 42 42 46 Z" fill={c("traps")} />
        <rect id="upper_back" x="34" y="46" width="32" height="22" rx="3" fill={c("upper_back")} />
        <rect id="lats" x="30" y="50" width="10" height="24" rx="3" fill={c("lats")} />
        <rect id="lats" x="60" y="50" width="10" height="24" rx="3" fill={c("lats")} />
        <rect id="lower_back" x="36" y="68" width="28" height="16" rx="3" fill={c("lower_back")} />
        <rect id="glutes" x="34" y="84" width="32" height="20" rx="4" fill={c("glutes")} />
        <rect id="hamstrings" x="32" y="104" width="16" height="36" rx="4" fill={c("hamstrings")} />
        <rect id="hamstrings" x="52" y="104" width="16" height="36" rx="4" fill={c("hamstrings")} />
        <rect id="calves" x="33" y="164" width="14" height="28" rx="4" fill={c("calves")} />
        <rect id="calves" x="53" y="164" width="14" height="28" rx="4" fill={c("calves")} />
        <rect id="rear_delt" x="14" y="36" width="14" height="16" rx="5" fill={c("rear_delt")} />
        <rect id="rear_delt" x="72" y="36" width="14" height="16" rx="5" fill={c("rear_delt")} />
        <rect id="triceps" x="15" y="52" width="12" height="26" rx="4" fill={c("triceps")} />
        <rect id="triceps" x="73" y="52" width="12" height="26" rx="4" fill={c("triceps")} />
        <rect id="forearm" x="16" y="60" width="11" height="22" rx="4" fill={c("forearm")} />
        <rect id="forearm" x="73" y="60" width="11" height="22" rx="4" fill={c("forearm")} />
      </svg>
    );
  }

  // Front view
  return (
    <svg viewBox="0 0 100 220" width={w} height={h} xmlns="http://www.w3.org/2000/svg">
      {/* Body outline */}
      <ellipse cx="50" cy="18" rx="14" ry="16" fill="#2A2A2A" />
      <rect x="30" y="34" width="40" height="70" rx="8" fill="#2A2A2A" />
      <rect x="14" y="36" width="14" height="48" rx="6" fill="#2A2A2A" />
      <rect x="72" y="36" width="14" height="48" rx="6" fill="#2A2A2A" />
      <rect x="32" y="104" width="16" height="60" rx="6" fill="#2A2A2A" />
      <rect x="52" y="104" width="16" height="60" rx="6" fill="#2A2A2A" />
      <rect x="32" y="164" width="16" height="42" rx="6" fill="#2A2A2A" />
      <rect x="52" y="164" width="16" height="42" rx="6" fill="#2A2A2A" />

      {/* Muscle groups - front */}
      <rect id="chest" x="34" y="36" width="32" height="22" rx="3" fill={c("chest")} />
      <rect id="front_delt" x="22" y="36" width="12" height="14" rx="5" fill={c("front_delt")} />
      <rect id="front_delt" x="66" y="36" width="12" height="14" rx="5" fill={c("front_delt")} />
      <rect id="abs" x="37" y="58" width="26" height="30" rx="3" fill={c("abs")} />
      <rect id="obliques" x="32" y="58" width="8" height="28" rx="3" fill={c("obliques")} />
      <rect id="obliques" x="60" y="58" width="8" height="28" rx="3" fill={c("obliques")} />
      <rect id="hip_flexors" x="36" y="86" width="12" height="18" rx="3" fill={c("hip_flexors")} />
      <rect id="hip_flexors" x="52" y="86" width="12" height="18" rx="3" fill={c("hip_flexors")} />
      <rect id="quads" x="32" y="104" width="16" height="36" rx="4" fill={c("quads")} />
      <rect id="quads" x="52" y="104" width="16" height="36" rx="4" fill={c("quads")} />
      <rect id="adductors" x="38" y="116" width="10" height="26" rx="3" fill={c("adductors")} />
      <rect id="adductors" x="52" y="116" width="10" height="26" rx="3" fill={c("adductors")} />
      <rect id="calves" x="33" y="164" width="14" height="28" rx="4" fill={c("calves")} />
      <rect id="calves" x="53" y="164" width="14" height="28" rx="4" fill={c("calves")} />
      <rect id="biceps" x="15" y="52" width="12" height="20" rx="4" fill={c("biceps")} />
      <rect id="biceps" x="73" y="52" width="12" height="20" rx="4" fill={c("biceps")} />
      <rect id="forearm" x="16" y="62" width="11" height="20" rx="4" fill={c("forearm")} />
      <rect id="forearm" x="73" y="62" width="11" height="20" rx="4" fill={c("forearm")} />
    </svg>
  );
}
