"use client";

import type { MuscleGroup } from "@/types";

interface Props {
  coverage: Partial<Record<MuscleGroup, number>>;
  accent?: string;
  size?: "thumbnail" | "full";
  showBack?: boolean;
}

function muscleColor(count: number, max: number, accent: string): string {
  if (count === 0 || max === 0) return "#1a1a1a";
  const ratio = Math.min(count / max, 1);
  const r = parseInt(accent.slice(1, 3), 16);
  const g = parseInt(accent.slice(3, 5), 16);
  const b = parseInt(accent.slice(5, 7), 16);
  const ir = Math.round(0x1a + (r - 0x1a) * ratio);
  const ig = Math.round(0x1a + (g - 0x1a) * ratio);
  const ib = Math.round(0x1a + (b - 0x1a) * ratio);
  return `rgb(${ir},${ig},${ib})`;
}

const BASE = "#242424";
const BASE2 = "#1e1e1e";

export function MuscleHeatmap({ coverage, accent = "#3B82F6", size = "full", showBack = false }: Props) {
  const max = Math.max(1, ...Object.values(coverage).filter((v): v is number => v !== undefined));
  const c = (muscle: MuscleGroup) => muscleColor(coverage[muscle] ?? 0, max, accent);

  const w = size === "thumbnail" ? 40 : 91;
  const h = size === "thumbnail" ? 88 : 200;

  if (showBack) {
    return (
      <svg viewBox="0 0 100 220" width={w} height={h} xmlns="http://www.w3.org/2000/svg">
        {/* ── body base ── */}
        <ellipse cx="50" cy="12" rx="11" ry="12" fill={BASE} />
        <path d="M47,23 Q50,25 53,23 L53,31 Q50,33 47,31 Z" fill={BASE} />
        {/* torso */}
        <path d="M28,33 Q22,36 21,46 Q20,58 22,74 Q24,88 28,96 Q31,104 33,112 L33,116 L47,116 Q49,112 50,110 Q51,112 53,116 L67,116 L67,112 Q69,104 72,96 Q76,88 78,74 Q80,58 79,46 Q78,36 72,33 Q63,29 50,29 Q37,29 28,33 Z" fill={BASE} />
        {/* left upper arm */}
        <path d="M17,37 Q13,55 14,79 L25,79 Q26,55 26,37 Z" fill={BASE} />
        {/* right upper arm */}
        <path d="M83,37 Q87,55 86,79 L75,79 Q74,55 74,37 Z" fill={BASE} />
        {/* left forearm */}
        <path d="M14,81 Q12,95 13,109 L24,109 Q25,95 25,81 Z" fill={BASE} />
        {/* right forearm */}
        <path d="M86,81 Q88,95 87,109 L76,109 Q75,95 75,81 Z" fill={BASE} />
        {/* left thigh */}
        <path d="M33,118 Q30,134 30,150 Q30,163 34,168 L46,168 Q48,162 48,150 Q48,134 47,118 Z" fill={BASE} />
        {/* right thigh */}
        <path d="M53,118 Q53,134 52,150 Q52,163 54,168 L66,168 Q70,163 70,150 Q70,134 67,118 Z" fill={BASE} />
        {/* left lower leg */}
        <path d="M33,170 Q31,183 31,194 Q31,205 35,209 L45,209 Q47,204 47,194 Q47,183 46,170 Z" fill={BASE} />
        {/* right lower leg */}
        <path d="M54,170 Q54,183 53,194 Q53,205 55,209 L65,209 Q69,204 69,194 Q69,183 67,170 Z" fill={BASE} />

        {/* ── back muscles ── */}

        {/* TRAPS — large diamond from neck to mid-upper back */}
        <path d="M50,27 Q43,30 36,34 Q29,38 29,45 Q29,51 37,54 Q44,57 50,55 Q56,57 63,54 Q71,51 71,45 Q71,38 64,34 Q57,30 50,27 Z" fill={c("traps")} />

        {/* REAR DELT — left */}
        <path d="M27,34 Q20,36 17,44 Q16,52 21,56 Q26,58 31,53 Q34,47 31,40 Z" fill={c("rear_delt")} />
        {/* REAR DELT — right */}
        <path d="M73,34 Q80,36 83,44 Q84,52 79,56 Q74,58 69,53 Q66,47 69,40 Z" fill={c("rear_delt")} />

        {/* UPPER BACK (rhomboids / mid traps) */}
        <path d="M42,55 Q35,58 33,65 Q32,72 36,75 Q42,78 50,76 Q58,78 64,75 Q68,72 67,65 Q65,58 58,55 Z" fill={c("upper_back")} />

        {/* LATS — left */}
        <path d="M29,56 Q23,64 22,74 Q21,84 25,89 Q30,93 37,90 Q42,85 41,73 Q40,62 35,57 Z" fill={c("lats")} />
        {/* LATS — right */}
        <path d="M71,56 Q77,64 78,74 Q79,84 75,89 Q70,93 63,90 Q58,85 59,73 Q60,62 65,57 Z" fill={c("lats")} />

        {/* LOWER BACK (erector spinae) */}
        <path d="M41,76 Q38,84 39,92 Q40,100 44,103 Q47,105 50,104 Q53,105 56,103 Q60,100 61,92 Q62,84 59,76 Q56,71 50,70 Q44,71 41,76 Z" fill={c("lower_back")} />

        {/* TRICEPS — left (back of upper arm) */}
        <path d="M17,41 Q13,53 13,64 Q13,74 16,79 Q19,82 23,81 Q27,78 27,67 Q27,55 24,44 Z" fill={c("triceps")} />
        {/* TRICEPS — right */}
        <path d="M83,41 Q87,53 87,64 Q87,74 84,79 Q81,82 77,81 Q73,78 73,67 Q73,55 76,44 Z" fill={c("triceps")} />

        {/* FOREARM — left (extensor side) */}
        <path d="M14,83 Q11,95 12,107 Q13,112 19,113 Q23,112 25,107 Q26,95 25,83 Z" fill={c("forearm")} />
        {/* FOREARM — right */}
        <path d="M86,83 Q89,95 88,107 Q87,112 81,113 Q77,112 75,107 Q74,95 75,83 Z" fill={c("forearm")} />

        {/* GLUTES — left */}
        <path d="M33,103 Q30,110 30,118 Q30,126 35,130 Q39,132 44,129 Q48,124 47,116 Q47,108 45,103 Z" fill={c("glutes")} />
        {/* GLUTES — right */}
        <path d="M53,103 Q53,108 53,116 Q52,124 56,129 Q61,132 65,130 Q70,126 70,118 Q70,110 67,103 Z" fill={c("glutes")} />

        {/* HAMSTRINGS — left */}
        <path d="M33,130 Q30,142 30,155 Q30,164 34,168 L45,168 Q47,163 47,155 Q47,141 45,130 Z" fill={c("hamstrings")} />
        {/* HAMSTRINGS — right */}
        <path d="M55,130 Q55,141 53,155 Q53,164 55,168 L66,168 Q70,164 70,155 Q70,142 67,130 Z" fill={c("hamstrings")} />

        {/* CALVES — left (gastrocnemius) */}
        <path d="M33,172 Q30,184 31,196 Q32,206 37,209 Q43,210 47,206 Q49,197 48,185 Q47,173 46,172 Z" fill={c("calves")} />
        {/* CALVES — right */}
        <path d="M54,172 Q54,173 53,185 Q52,197 54,206 Q58,210 63,209 Q68,206 69,196 Q70,184 67,172 Z" fill={c("calves")} />
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 100 220" width={w} height={h} xmlns="http://www.w3.org/2000/svg">
      {/* ── body base ── */}
      <ellipse cx="50" cy="12" rx="11" ry="12" fill={BASE} />
      <path d="M47,23 Q50,25 53,23 L53,31 Q50,33 47,31 Z" fill={BASE} />
      {/* torso */}
      <path d="M28,33 Q22,36 21,46 Q20,58 22,74 Q24,88 28,96 Q31,104 33,112 L33,116 L47,116 Q49,112 50,110 Q51,112 53,116 L67,116 L67,112 Q69,104 72,96 Q76,88 78,74 Q80,58 79,46 Q78,36 72,33 Q63,29 50,29 Q37,29 28,33 Z" fill={BASE} />
      {/* left upper arm */}
      <path d="M17,37 Q13,55 14,79 L25,79 Q26,55 26,37 Z" fill={BASE} />
      {/* right upper arm */}
      <path d="M83,37 Q87,55 86,79 L75,79 Q74,55 74,37 Z" fill={BASE} />
      {/* left forearm */}
      <path d="M14,81 Q12,95 13,109 L24,109 Q25,95 25,81 Z" fill={BASE} />
      {/* right forearm */}
      <path d="M86,81 Q88,95 87,109 L76,109 Q75,95 75,81 Z" fill={BASE} />
      {/* left thigh */}
      <path d="M33,118 Q30,134 30,150 Q30,163 34,168 L46,168 Q48,162 48,150 Q48,134 47,118 Z" fill={BASE} />
      {/* right thigh */}
      <path d="M53,118 Q53,134 52,150 Q52,163 54,168 L66,168 Q70,163 70,150 Q70,134 67,118 Z" fill={BASE} />
      {/* left lower leg */}
      <path d="M33,170 Q31,183 31,194 Q31,205 35,209 L45,209 Q47,204 47,194 Q47,183 46,170 Z" fill={BASE} />
      {/* right lower leg */}
      <path d="M54,170 Q54,183 53,194 Q53,205 55,209 L65,209 Q69,204 69,194 Q69,183 67,170 Z" fill={BASE} />

      {/* ── front muscles ── */}

      {/* CHEST — left pec (D-shape fanning from sternum) */}
      <path d="M50,35 Q43,33 37,37 Q31,41 30,50 Q30,58 36,61 Q42,63 47,59 Q51,56 50,49 Z" fill={c("chest")} />
      {/* CHEST — right pec */}
      <path d="M50,35 Q57,33 63,37 Q69,41 70,50 Q70,58 64,61 Q58,63 53,59 Q49,56 50,49 Z" fill={c("chest")} />

      {/* FRONT DELT — left */}
      <path d="M27,34 Q19,36 16,44 Q15,52 21,56 Q26,58 31,53 Q34,47 31,40 Z" fill={c("front_delt")} />
      {/* FRONT DELT — right */}
      <path d="M73,34 Q81,36 84,44 Q85,52 79,56 Q74,58 69,53 Q66,47 69,40 Z" fill={c("front_delt")} />

      {/* BICEPS — left (front of upper arm) */}
      <path d="M17,41 Q13,53 13,64 Q13,74 16,79 Q19,82 23,81 Q27,78 27,67 Q27,55 24,44 Z" fill={c("biceps")} />
      {/* BICEPS — right */}
      <path d="M83,41 Q87,53 87,64 Q87,74 84,79 Q81,82 77,81 Q73,78 73,67 Q73,55 76,44 Z" fill={c("biceps")} />

      {/* FOREARM — left (flexor side) */}
      <path d="M14,83 Q11,95 12,107 Q13,112 19,113 Q23,112 25,107 Q26,95 25,83 Z" fill={c("forearm")} />
      {/* FOREARM — right */}
      <path d="M86,83 Q89,95 88,107 Q87,112 81,113 Q77,112 75,107 Q74,95 75,83 Z" fill={c("forearm")} />

      {/* ABS — 6-pack grid */}
      <rect x="44" y="63" width="5" height="7" rx="1.5" fill={c("abs")} />
      <rect x="51" y="63" width="5" height="7" rx="1.5" fill={c("abs")} />
      <rect x="44" y="72" width="5" height="7" rx="1.5" fill={c("abs")} />
      <rect x="51" y="72" width="5" height="7" rx="1.5" fill={c("abs")} />
      <rect x="44" y="81" width="5" height="6" rx="1.5" fill={c("abs")} />
      <rect x="51" y="81" width="5" height="6" rx="1.5" fill={c("abs")} />

      {/* OBLIQUES — left */}
      <path d="M35,64 Q32,72 32,80 Q32,87 35,91 Q38,93 41,91 Q43,87 43,79 Q43,69 40,64 Z" fill={c("obliques")} />
      {/* OBLIQUES — right */}
      <path d="M65,64 Q68,72 68,80 Q68,87 65,91 Q62,93 59,91 Q57,87 57,79 Q57,69 60,64 Z" fill={c("obliques")} />

      {/* HIP FLEXORS — left */}
      <path d="M43,90 Q40,96 40,103 Q40,109 43,112 Q46,114 48,112 Q50,109 50,103 Q50,96 48,90 Z" fill={c("hip_flexors")} />
      {/* HIP FLEXORS — right */}
      <path d="M57,90 Q60,96 60,103 Q60,109 57,112 Q54,114 52,112 Q50,109 50,103 Q50,96 52,90 Z" fill={c("hip_flexors")} />

      {/* QUADS — left (outer sweep of thigh) */}
      <path d="M33,120 Q30,134 30,150 Q30,163 34,168 L44,168 Q46,162 46,150 Q46,134 44,120 Z" fill={c("quads")} />
      {/* QUADS — right */}
      <path d="M56,120 Q56,134 54,150 Q54,163 56,168 L66,168 Q70,163 70,150 Q70,134 67,120 Z" fill={c("quads")} />

      {/* ADDUCTORS — inner thigh (bridges left and right) */}
      <path d="M44,120 Q42,134 42,148 Q42,161 46,167 Q48,168 50,167 Q52,168 54,167 Q58,161 58,148 Q58,134 56,120 Z" fill={c("adductors")} />

      {/* CALVES — left (front shin / tibialis) */}
      <path d="M33,172 Q30,184 31,196 Q32,206 37,209 Q43,210 47,206 Q49,197 48,185 Q47,173 46,172 Z" fill={c("calves")} />
      {/* CALVES — right */}
      <path d="M54,172 Q54,173 53,185 Q52,197 54,206 Q58,210 63,209 Q68,206 69,196 Q70,184 67,172 Z" fill={c("calves")} />

      {/* Sternum line (subtle definition between pecs) */}
      <line x1="50" y1="35" x2="50" y2="61" stroke={BASE2} strokeWidth="1" />
      {/* Linea alba (center ab line) */}
      <line x1="50" y1="63" x2="50" y2="87" stroke={BASE2} strokeWidth="0.8" />
    </svg>
  );
}
