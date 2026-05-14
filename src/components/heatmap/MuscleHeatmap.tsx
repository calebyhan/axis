"use client";

import { useId, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { FocusEvent, PointerEvent } from "react";
import type { MuscleGroup, MuscleHeatmapDetails } from "@/types";

interface Props {
  coverage: Partial<Record<MuscleGroup, number>>;
  accent?: string;
  size?: "thumbnail" | "full";
  showBack?: boolean;
  details?: MuscleHeatmapDetails;
  tooltipContext?: string;
}

type MuscleLayer = {
  muscle: MuscleGroup;
  paths: string[];
};

type ActiveTooltip = {
  muscle: MuscleGroup;
  x: number;
  y: number;
};

type MuscleHandlers = {
  onPointerDown: (event: PointerEvent<SVGGElement>) => void;
  onPointerEnter: (muscle: MuscleGroup, event: PointerEvent<SVGGElement>) => void;
  onPointerMove: (muscle: MuscleGroup, event: PointerEvent<SVGGElement>) => void;
  onPointerLeave: () => void;
  onFocus: (muscle: MuscleGroup, event: FocusEvent<SVGGElement>) => void;
  onBlur: () => void;
};

const VIEW_BOX = "0 0 100 220";
const EMPTY = "#1f1f1f";
const BODY = "#242424";
const BODY_DARK = "#181818";
const DETAIL = "#101010";
const FALLBACK_ACCENT = "#3B82F6";
const TOOLTIP_LIMIT = 6;
const TOOLTIP_OFFSET = 10;
const TOOLTIP_MARGIN = 8;

const MUSCLE_LABELS: Record<MuscleGroup, string> = {
  chest: "Chest",
  front_delt: "Front delts",
  rear_delt: "Rear delts",
  triceps: "Triceps",
  biceps: "Biceps",
  forearm: "Forearms",
  upper_back: "Upper back",
  lats: "Lats",
  traps: "Traps",
  lower_back: "Lower back",
  glutes: "Glutes",
  quads: "Quads",
  hamstrings: "Hamstrings",
  calves: "Calves",
  hip_flexors: "Hip flexors",
  adductors: "Adductors",
  abs: "Abs",
  obliques: "Obliques",
};

function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const match = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!match) return null;

  const value = match[1];
  return {
    r: parseInt(value.slice(0, 2), 16),
    g: parseInt(value.slice(2, 4), 16),
    b: parseInt(value.slice(4, 6), 16),
  };
}

function muscleColor(count: number, max: number, accent: string): string {
  if (count <= 0 || max <= 0) return EMPTY;

  const ratio = Math.min(count / max, 1);
  const rgb = hexToRgb(accent) ?? hexToRgb(FALLBACK_ACCENT);

  if (!rgb) return accent;

  const ir = Math.round(0x1f + (rgb.r - 0x1f) * ratio);
  const ig = Math.round(0x1f + (rgb.g - 0x1f) * ratio);
  const ib = Math.round(0x1f + (rgb.b - 0x1f) * ratio);

  return `rgb(${ir}, ${ig}, ${ib})`;
}

const bodyBase = [
  "M39.5 24.5 C42.4 28.1 57.6 28.1 60.5 24.5 L58.6 33.2 C55.5 35.2 44.5 35.2 41.4 33.2 Z",
  "M50 1.5 C56.6 1.5 61.2 7 61.2 14.5 C61.2 22.2 56.1 27.1 50 27.1 C43.9 27.1 38.8 22.2 38.8 14.5 C38.8 7 43.4 1.5 50 1.5 Z",
  "M27.8 35 C22.2 41.2 20.5 52.2 21.3 66.2 C22.4 84.5 27.2 100.4 32.4 114.7 C36.4 121.9 43.3 124.8 50 118.3 C56.7 124.8 63.6 121.9 67.6 114.7 C72.8 100.4 77.6 84.5 78.7 66.2 C79.5 52.2 77.8 41.2 72.2 35 C65.2 31.1 57.7 29.2 50 29.2 C42.3 29.2 34.8 31.1 27.8 35 Z",
  "M27.2 37.3 C20.4 39.6 15.7 48.3 14.1 60.9 C12.9 70.7 13.8 79.1 16.7 84.6 C20.5 86.8 24.6 84.4 26.1 78.8 C26.5 67.1 28 53.6 31.7 41.6 Z",
  "M72.8 37.3 C79.6 39.6 84.3 48.3 85.9 60.9 C87.1 70.7 86.2 79.1 83.3 84.6 C79.5 86.8 75.4 84.4 73.9 78.8 C73.5 67.1 72 53.6 68.3 41.6 Z",
  "M16.4 84.2 C12.7 94.1 12.2 104.8 15 113.9 C18.1 117.6 23.3 116.7 25.3 111.7 C26.4 99.5 26.1 90.4 23.8 82.8 Z",
  "M83.6 84.2 C87.3 94.1 87.8 104.8 85 113.9 C81.9 117.6 76.7 116.7 74.7 111.7 C73.6 99.5 73.9 90.4 76.2 82.8 Z",
  "M33.7 118 C30.9 128.7 29.7 146.5 31.1 163 C32 173.9 36.1 180 41 180 C45.3 180 47.9 176.4 48.7 170.4 C49.2 154 48 134.9 45.5 120.2 Z",
  "M66.3 118 C69.1 128.7 70.3 146.5 68.9 163 C68 173.9 63.9 180 59 180 C54.7 180 52.1 176.4 51.3 170.4 C50.8 154 52 134.9 54.5 120.2 Z",
  "M36 178.9 C32.5 189.8 32 203.7 34.8 212.1 C38.3 216.5 44.1 215.6 46.3 210.5 C48.5 198.3 47.2 187.3 44 179.1 Z",
  "M64 178.9 C67.5 189.8 68 203.7 65.2 212.1 C61.7 216.5 55.9 215.6 53.7 210.5 C51.5 198.3 52.8 187.3 56 179.1 Z",
  "M34.8 211.5 C36.8 216.4 42.4 218.1 47.4 215.2 C47.1 218 44.2 219.4 38 219.1 C34.8 218.9 32.8 217.5 32.5 215.4 C32.3 213.7 33.1 212.5 34.8 211.5 Z",
  "M65.2 211.5 C63.2 216.4 57.6 218.1 52.6 215.2 C52.9 218 55.8 219.4 62 219.1 C65.2 218.9 67.2 217.5 67.5 215.4 C67.7 213.7 66.9 212.5 65.2 211.5 Z",
];

const frontMuscles: MuscleLayer[] = [
  {
    muscle: "chest",
    paths: [
      "M49.6 36.7 C44.6 34 37.1 35.6 32.9 41.6 C29.1 47 29.7 55.1 34.7 59.5 C39.3 63.6 45.8 61.8 49.2 56 C50.4 49.9 50.5 42.4 49.6 36.7 Z",
      "M50.4 36.7 C55.4 34 62.9 35.6 67.1 41.6 C70.9 47 70.3 55.1 65.3 59.5 C60.7 63.6 54.2 61.8 50.8 56 C49.6 49.9 49.5 42.4 50.4 36.7 Z",
    ],
  },
  {
    muscle: "front_delt",
    paths: [
      "M27.4 36.5 C20.5 38.6 17 45.1 17.3 51.6 C17.6 56.7 21.2 59.7 26 57.8 C30.7 56 33 51.5 32.1 45.9 C31.4 41.6 30 38.4 27.4 36.5 Z",
      "M72.6 36.5 C79.5 38.6 83 45.1 82.7 51.6 C82.4 56.7 78.8 59.7 74 57.8 C69.3 56 67 51.5 67.9 45.9 C68.6 41.6 70 38.4 72.6 36.5 Z",
    ],
  },
  {
    muscle: "biceps",
    paths: [
      "M17.8 56.5 C15.3 64.1 15.2 73.6 17.4 81.1 C20.2 84 24.6 81.9 25.9 76.9 C26.2 66.2 24.8 58.5 21.9 54.1 C20.2 54.5 18.9 55.3 17.8 56.5 Z",
      "M82.2 56.5 C84.7 64.1 84.8 73.6 82.6 81.1 C79.8 84 75.4 81.9 74.1 76.9 C73.8 66.2 75.2 58.5 78.1 54.1 C79.8 54.5 81.1 55.3 82.2 56.5 Z",
    ],
  },
  {
    muscle: "forearm",
    paths: [
      "M16.5 84.1 C13.5 93.1 13.4 104.4 15.7 112.2 C18.9 115.3 23.2 114.2 24.5 109.8 C25.2 99.9 24.8 90.6 23.2 83.5 C20.6 82.6 18.5 82.7 16.5 84.1 Z",
      "M83.5 84.1 C86.5 93.1 86.6 104.4 84.3 112.2 C81.1 115.3 76.8 114.2 75.5 109.8 C74.8 99.9 75.2 90.6 76.8 83.5 C79.4 82.6 81.5 82.7 83.5 84.1 Z",
    ],
  },
  {
    muscle: "abs",
    paths: [
      "M44 64 C42.2 66.1 41.7 70.8 43 73.2 C44.9 74.4 47.7 73.9 49 72.2 L49 64.7 C47.7 63.6 45.4 63.3 44 64 Z",
      "M56 64 C57.8 66.1 58.3 70.8 57 73.2 C55.1 74.4 52.3 73.9 51 72.2 L51 64.7 C52.3 63.6 54.6 63.3 56 64 Z",
      "M43.4 75.2 C41.9 78.2 42 82.7 43.4 85.3 C45.2 86.5 47.8 86.1 49 84.2 L49 76.2 C47.4 75.1 45.1 74.8 43.4 75.2 Z",
      "M56.6 75.2 C58.1 78.2 58 82.7 56.6 85.3 C54.8 86.5 52.2 86.1 51 84.2 L51 76.2 C52.6 75.1 54.9 74.8 56.6 75.2 Z",
      "M43.8 87.2 C42.5 90.4 43.2 94.9 45.2 97.2 C47.2 98.2 49 96.5 49 93.8 L49 88.1 C47.5 87.2 45.3 86.9 43.8 87.2 Z",
      "M56.2 87.2 C57.5 90.4 56.8 94.9 54.8 97.2 C52.8 98.2 51 96.5 51 93.8 L51 88.1 C52.5 87.2 54.7 86.9 56.2 87.2 Z",
    ],
  },
  {
    muscle: "obliques",
    paths: [
      "M34.4 61.7 C31.4 68.7 30.7 81.1 33.4 90.8 C35.2 96.8 39.4 98.5 42.5 94.2 C40.4 86.3 40.6 74.8 42.5 64.2 C40.3 62.2 36.9 61.4 34.4 61.7 Z",
      "M65.6 61.7 C68.6 68.7 69.3 81.1 66.6 90.8 C64.8 96.8 60.6 98.5 57.5 94.2 C59.6 86.3 59.4 74.8 57.5 64.2 C59.7 62.2 63.1 61.4 65.6 61.7 Z",
    ],
  },
  {
    muscle: "hip_flexors",
    paths: [
      "M38.7 98.6 C34.8 104.5 34.2 113 38.8 118.1 C42.8 116.6 45.7 111.5 46.7 103.8 C44.4 100.8 41.6 99 38.7 98.6 Z",
      "M61.3 98.6 C65.2 104.5 65.8 113 61.2 118.1 C57.2 116.6 54.3 111.5 53.3 103.8 C55.6 100.8 58.4 99 61.3 98.6 Z",
    ],
  },
  {
    muscle: "quads",
    paths: [
      "M33.5 120.3 C30.5 131.6 30 150.8 32.5 165.8 C34.2 174.8 41.6 177.2 45.1 170 C47.2 154.4 47.1 136.4 44.1 121.5 C40.8 119.3 36.5 119 33.5 120.3 Z",
      "M66.5 120.3 C69.5 131.6 70 150.8 67.5 165.8 C65.8 174.8 58.4 177.2 54.9 170 C52.8 154.4 52.9 136.4 55.9 121.5 C59.2 119.3 63.5 119 66.5 120.3 Z",
    ],
  },
  {
    muscle: "adductors",
    paths: [
      "M45.3 121 C42.4 130.4 41.7 144.7 43.4 160.7 C44.2 168.6 47.1 172.8 49.2 169.2 C50 153.4 49.5 136.5 48.1 122.1 C47.2 121.3 46.3 121 45.3 121 Z",
      "M54.7 121 C57.6 130.4 58.3 144.7 56.6 160.7 C55.8 168.6 52.9 172.8 50.8 169.2 C50 153.4 50.5 136.5 51.9 122.1 C52.8 121.3 53.7 121 54.7 121 Z",
    ],
  },
  {
    muscle: "calves",
    paths: [
      "M36.2 179 C32.9 188.6 32.9 202.9 35.7 210.8 C39 214.1 44.4 212.2 45.7 204.7 C45.6 193.6 43.2 184 40.5 179.5 C39.1 178.8 37.5 178.7 36.2 179 Z",
      "M63.8 179 C67.1 188.6 67.1 202.9 64.3 210.8 C61 214.1 55.6 212.2 54.3 204.7 C54.4 193.6 56.8 184 59.5 179.5 C60.9 178.8 62.5 178.7 63.8 179 Z",
    ],
  },
];

const backMuscles: MuscleLayer[] = [
  {
    muscle: "traps",
    paths: [
      "M50 27.2 C44 30.7 38.4 38.2 36 47.6 C39.4 54.8 44.2 61.7 50 69.5 C55.8 61.7 60.6 54.8 64 47.6 C61.6 38.2 56 30.7 50 27.2 Z",
      "M50 56 C46.2 63.7 44.9 72.4 50 82.8 C55.1 72.4 53.8 63.7 50 56 Z",
    ],
  },
  {
    muscle: "rear_delt",
    paths: [
      "M27.2 36.4 C20.4 38.8 17.1 45.2 17.4 51.5 C17.7 56.8 21.5 59.4 26.2 57.5 C30.8 55.7 33 51.4 32 45.7 C31.3 41.3 29.9 38.3 27.2 36.4 Z",
      "M72.8 36.4 C79.6 38.8 82.9 45.2 82.6 51.5 C82.3 56.8 78.5 59.4 73.8 57.5 C69.2 55.7 67 51.4 68 45.7 C68.7 41.3 70.1 38.3 72.8 36.4 Z",
    ],
  },
  {
    muscle: "upper_back",
    paths: [
      "M36.4 50 C31.3 54.7 29.8 63.7 33 70.3 C37.1 75.2 44.2 73.7 48.9 67.1 C45.4 59.2 41.4 53 36.4 50 Z",
      "M63.6 50 C68.7 54.7 70.2 63.7 67 70.3 C62.9 75.2 55.8 73.7 51.1 67.1 C54.6 59.2 58.6 53 63.6 50 Z",
    ],
  },
  {
    muscle: "lats",
    paths: [
      "M30.2 56 C24.1 64.1 21.4 77.5 24 91.8 C25.9 101 31.6 104.4 38.2 99.1 C42.7 88.6 42.2 70.6 37 58 C34.7 56.5 32.3 55.8 30.2 56 Z",
      "M69.8 56 C75.9 64.1 78.6 77.5 76 91.8 C74.1 101 68.4 104.4 61.8 99.1 C57.3 88.6 57.8 70.6 63 58 C65.3 56.5 67.7 55.8 69.8 56 Z",
    ],
  },
  {
    muscle: "lower_back",
    paths: [
      "M43.8 73.4 C40.3 82.7 39.4 95.9 42.1 106.3 C44 112.2 48.1 111.6 49.2 105.2 C49 93.6 48.6 82 47.3 73.6 C46.2 72.8 44.9 72.7 43.8 73.4 Z",
      "M56.2 73.4 C59.7 82.7 60.6 95.9 57.9 106.3 C56 112.2 51.9 111.6 50.8 105.2 C51 93.6 51.4 82 52.7 73.6 C53.8 72.8 55.1 72.7 56.2 73.4 Z",
    ],
  },
  {
    muscle: "triceps",
    paths: [
      "M17.8 56.4 C15.2 64.4 15.3 74.4 17.7 81.6 C20.8 84.5 25 81.9 25.9 76.7 C26 66.3 24.7 58.2 21.8 54 C20 54.4 18.7 55.2 17.8 56.4 Z",
      "M82.2 56.4 C84.8 64.4 84.7 74.4 82.3 81.6 C79.2 84.5 75 81.9 74.1 76.7 C74 66.3 75.3 58.2 78.2 54 C80 54.4 81.3 55.2 82.2 56.4 Z",
    ],
  },
  {
    muscle: "forearm",
    paths: [
      "M16.5 84 C13.5 93.2 13.5 104.7 15.9 112.4 C19.2 115.3 23.4 114 24.6 109.4 C25.3 99.4 24.8 90.6 23.1 83.5 C20.5 82.6 18.4 82.8 16.5 84 Z",
      "M83.5 84 C86.5 93.2 86.5 104.7 84.1 112.4 C80.8 115.3 76.6 114 75.4 109.4 C74.7 99.4 75.2 90.6 76.9 83.5 C79.5 82.6 81.6 82.8 83.5 84 Z",
    ],
  },
  {
    muscle: "glutes",
    paths: [
      "M32.6 106.2 C28.7 114.7 30.8 126.2 38.4 131.3 C43.8 134.9 49.3 128.7 49.1 117.5 C45.5 109.3 39.5 105.2 32.6 106.2 Z",
      "M67.4 106.2 C71.3 114.7 69.2 126.2 61.6 131.3 C56.2 134.9 50.7 128.7 50.9 117.5 C54.5 109.3 60.5 105.2 67.4 106.2 Z",
    ],
  },
  {
    muscle: "hamstrings",
    paths: [
      "M33.8 132 C30.8 143.6 30.8 162.1 35.1 173.4 C38.3 178.4 44.5 176.9 46.7 170.1 C47.7 154.9 46.7 142.2 44.3 132.5 C41.1 130.6 37 130.4 33.8 132 Z",
      "M66.2 132 C69.2 143.6 69.2 162.1 64.9 173.4 C61.7 178.4 55.5 176.9 53.3 170.1 C52.3 154.9 53.3 142.2 55.7 132.5 C58.9 130.6 63 130.4 66.2 132 Z",
    ],
  },
  {
    muscle: "calves",
    paths: [
      "M35.8 178.4 C31.9 187.8 32 203.3 35.7 211.4 C39.4 215.9 45.4 212.7 46.8 203.9 C46.3 192 43.4 181.8 40.5 178.3 C39 177.7 37.3 177.8 35.8 178.4 Z",
      "M64.2 178.4 C68.1 187.8 68 203.3 64.3 211.4 C60.6 215.9 54.6 212.7 53.2 203.9 C53.7 192 56.6 181.8 59.5 178.3 C61 177.7 62.7 177.8 64.2 178.4 Z",
    ],
  },
];

const frontDetails = [
  "M50 36.5 L50 59.8",
  "M50 63.5 L50 97.4",
  "M42.9 75.3 C45.1 76.2 47.2 76.2 49 75.4",
  "M51 75.4 C52.8 76.2 54.9 76.2 57.1 75.3",
  "M43.4 87.2 C45.3 88.2 47.4 88.2 49 87.4",
  "M51 87.4 C52.6 88.2 54.7 88.2 56.6 87.2",
  "M49.2 118.6 C48 135.5 48 153.8 49.2 170",
  "M50.8 118.6 C52 135.5 52 153.8 50.8 170",
];

const backDetails = [
  "M50 27.8 L50 118.4",
  "M36.4 50 C41.8 55.5 45.7 61.5 49 68",
  "M63.6 50 C58.2 55.5 54.3 61.5 51 68",
  "M38 99.1 C41.7 103.8 45.5 106.5 49 107.7",
  "M62 99.1 C58.3 103.8 54.5 106.5 51 107.7",
  "M36.4 132.8 C39.6 145.4 40.6 159.3 39.6 174.2",
  "M63.6 132.8 C60.4 145.4 59.4 159.3 60.4 174.2",
];

function renderBase(paths: string[]) {
  return paths.map((d, index) => (
    <path
      key={`base-${index}`}
      d={d}
      fill={BODY}
      stroke={BODY_DARK}
      strokeLinejoin="round"
      strokeWidth={0.8}
      vectorEffect="non-scaling-stroke"
    />
  ));
}

function renderMuscles(
  layers: MuscleLayer[],
  colorFor: (muscle: MuscleGroup) => string,
  idPrefix: string,
  interactive: boolean,
  activeMuscle: MuscleGroup | null,
  handlers: MuscleHandlers
) {
  return layers.map((layer) => (
    <g
      key={layer.muscle}
      id={`${idPrefix}-${layer.muscle}`}
      data-muscle={layer.muscle}
      fill={colorFor(layer.muscle)}
      tabIndex={interactive ? 0 : undefined}
      aria-label={interactive ? MUSCLE_LABELS[layer.muscle] : undefined}
      onPointerEnter={interactive ? (event) => handlers.onPointerEnter(layer.muscle, event) : undefined}
      onPointerMove={interactive ? (event) => handlers.onPointerMove(layer.muscle, event) : undefined}
      onPointerDown={interactive ? handlers.onPointerDown : undefined}
      onPointerLeave={interactive ? handlers.onPointerLeave : undefined}
      onFocus={interactive ? (event) => handlers.onFocus(layer.muscle, event) : undefined}
      onBlur={interactive ? handlers.onBlur : undefined}
      style={interactive ? { cursor: "help", WebkitTapHighlightColor: "transparent", outline: "none" } : undefined}
    >
      {layer.paths.map((d, index) => (
        <path
          key={`${layer.muscle}-${index}`}
          id={`${idPrefix}-${layer.muscle}-${index + 1}`}
          d={d}
          stroke={activeMuscle === layer.muscle ? "rgba(255,255,255,0.46)" : "rgba(255,255,255,0.13)"}
          strokeLinejoin="round"
          strokeLinecap="round"
          strokeWidth={activeMuscle === layer.muscle ? 1 : 0.72}
          vectorEffect="non-scaling-stroke"
        />
      ))}
    </g>
  ));
}

function renderDetails(paths: string[]) {
  return paths.map((d, index) => (
    <path
      key={`detail-${index}`}
      d={d}
      fill="none"
      stroke={DETAIL}
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={0.72}
      opacity={0.78}
      vectorEffect="non-scaling-stroke"
    />
  ));
}

function getPointerPosition(event: PointerEvent<SVGGElement>): { x: number; y: number } {
  return {
    x: event.clientX,
    y: event.clientY,
  };
}

function getFocusPosition(event: FocusEvent<SVGGElement>): { x: number; y: number } {
  const groupRect = event.currentTarget.getBoundingClientRect();

  return {
    x: groupRect.left + groupRect.width / 2,
    y: groupRect.top + groupRect.height / 2,
  };
}

function getTooltipPosition(
  anchor: ActiveTooltip,
  tooltip: HTMLDivElement
): { left: number; top: number } {
  const rect = tooltip.getBoundingClientRect();
  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;
  const prefersLeft = anchor.x > viewportWidth / 2;
  const minLeft = TOOLTIP_MARGIN;
  const maxLeft = viewportWidth - rect.width - TOOLTIP_MARGIN;
  const minTop = TOOLTIP_MARGIN;
  const maxTop = viewportHeight - rect.height - TOOLTIP_MARGIN;
  const unclampedLeft = prefersLeft ? anchor.x - rect.width - TOOLTIP_OFFSET : anchor.x + TOOLTIP_OFFSET;
  const unclampedTop = anchor.y - rect.height / 2;

  return {
    left: Math.min(Math.max(unclampedLeft, minLeft), Math.max(minLeft, maxLeft)),
    top: Math.min(Math.max(unclampedTop, minTop), Math.max(minTop, maxTop)),
  };
}

function formatSetCount(count: number, context?: string): string {
  const suffix = context ? ` ${context}` : "";
  return `${count} set${count === 1 ? "" : "s"}${suffix}`;
}

function formatEmptyCount(context?: string): string {
  return context ? `No sets ${context}` : "No sets logged";
}

export function MuscleHeatmap({
  coverage,
  accent = FALLBACK_ACCENT,
  size = "full",
  showBack = false,
  details: tooltipDetails,
  tooltipContext,
}: Props) {
  const reactId = useId();
  const tooltipRef = useRef<HTMLDivElement | null>(null);
  const [activeTooltip, setActiveTooltip] = useState<ActiveTooltip | null>(null);
  const idPrefix = `muscle-map-${reactId.replace(/:/g, "")}`;
  const max = Math.max(1, ...Object.values(coverage).filter((v): v is number => typeof v === "number" && Number.isFinite(v)));
  const countFor = (muscle: MuscleGroup) => {
    const count = coverage[muscle] ?? 0;
    return Number.isFinite(count) ? count : 0;
  };
  const c = (muscle: MuscleGroup) => muscleColor(countFor(muscle), max, accent);
  const width = size === "thumbnail" ? 40 : 91;
  const height = size === "thumbnail" ? 88 : 200;
  const muscles = showBack ? backMuscles : frontMuscles;
  const definitionLines = showBack ? backDetails : frontDetails;
  const interactive = Boolean(tooltipDetails || tooltipContext);
  const activeMuscle = activeTooltip?.muscle ?? null;
  const tooltipItems = activeMuscle ? tooltipDetails?.[activeMuscle]?.items ?? [] : [];
  const visibleTooltipItems = tooltipItems.slice(0, TOOLTIP_LIMIT);
  const visibleTooltipText = visibleTooltipItems.join("\n");
  const hiddenTooltipCount = Math.max(0, tooltipItems.length - visibleTooltipItems.length);
  const activeCount = activeMuscle ? countFor(activeMuscle) : 0;

  useLayoutEffect(() => {
    if (!activeTooltip) return;

    const tooltip = tooltipRef.current;
    if (!tooltip) return;

    const nextPosition = getTooltipPosition(activeTooltip, tooltip);
    tooltip.style.left = `${nextPosition.left}px`;
    tooltip.style.top = `${nextPosition.top}px`;
    tooltip.style.visibility = "visible";
  }, [activeTooltip, activeCount, hiddenTooltipCount, tooltipContext, visibleTooltipText]);

  const handlers: MuscleHandlers = {
    onPointerDown: (event) => {
      event.preventDefault();
    },
    onPointerEnter: (muscle, event) => {
      setActiveTooltip({ muscle, ...getPointerPosition(event) });
    },
    onPointerMove: (muscle, event) => {
      setActiveTooltip({ muscle, ...getPointerPosition(event) });
    },
    onPointerLeave: () => {
      setActiveTooltip(null);
    },
    onFocus: (muscle, event) => {
      setActiveTooltip({ muscle, ...getFocusPosition(event) });
    },
    onBlur: () => {
      setActiveTooltip(null);
    },
  };

  return (
    <div className="relative inline-flex shrink-0" style={{ width, height }}>
      <svg
        aria-hidden={interactive ? undefined : true}
        aria-label={interactive ? `${showBack ? "Back" : "Front"} muscle heatmap` : undefined}
        role={interactive ? "img" : undefined}
        viewBox={VIEW_BOX}
        width={width}
        height={height}
        xmlns="http://www.w3.org/2000/svg"
        shapeRendering="geometricPrecision"
      >
        {renderBase(bodyBase)}
        {renderMuscles(muscles, c, idPrefix, interactive, activeMuscle, handlers)}
        {renderDetails(definitionLines)}
      </svg>

      {activeTooltip && typeof document !== "undefined" && createPortal(
        <div
          ref={tooltipRef}
          className="pointer-events-none fixed z-50 w-max rounded-lg border border-white/12 bg-[#080808]/95 px-3 py-2 text-left shadow-xl shadow-black/35 backdrop-blur"
          style={{
            left: 0,
            top: 0,
            maxHeight: "calc(100vh - 16px)",
            maxWidth: "min(16rem, calc(100vw - 16px))",
            visibility: "hidden",
          }}
        >
          <div className="text-xs font-semibold text-white">{MUSCLE_LABELS[activeTooltip.muscle]}</div>
          <div className="mt-0.5 text-[11px] text-white/55">
            {activeCount > 0 ? formatSetCount(activeCount, tooltipContext) : formatEmptyCount(tooltipContext)}
          </div>
          {visibleTooltipItems.length > 0 && (
            <div className="mt-2 flex flex-col gap-1">
              {visibleTooltipItems.map((item) => (
                <div key={item} className="max-w-56 truncate text-[11px] leading-snug text-white/78">
                  {item}
                </div>
              ))}
              {hiddenTooltipCount > 0 && (
                <div className="text-[11px] text-white/45">+{hiddenTooltipCount} more</div>
              )}
            </div>
          )}
        </div>,
        document.body
      )}
    </div>
  );
}
