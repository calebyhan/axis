import type { DayType, Exercise, MuscleGroup, MuscleTag, MovementPattern, SessionState } from "@/types";
import { isMuscleTag } from "@/lib/muscle-tags";

export type BalanceAxisId =
  | "push_pull"
  | "horizontal_push_pull"
  | "quad_hinge"
  | "vertical_push_pull"
  | "elbow_flexion_extension"
  | "upper_lower"
  | "front_rear_shoulder";

export type BalanceSeverity = "notice" | "warning";

export interface StrengthBalanceInput {
  exerciseId?: string;
  name?: string;
  movementPattern: MovementPattern;
  primaryMuscles: MuscleGroup[];
  secondaryMuscles: MuscleGroup[];
  muscleTags: MuscleTag[];
  sets: number;
}

export interface StrengthSetDescriptor {
  exerciseId: string;
  name?: string | null;
  movementPattern?: MovementPattern | null;
  primaryMuscles?: MuscleGroup[] | null;
  secondaryMuscles?: MuscleGroup[] | null;
  muscleTags?: readonly string[] | null;
  sets?: number;
}

export interface StrengthPlanProjectionOptions {
  sourceId?: string;
  setsPerPattern?: number;
  isolationSets?: number;
}

export interface BalanceAxisResult {
  id: BalanceAxisId;
  label: string;
  leftLabel: string;
  rightLabel: string;
  left: number;
  right: number;
  total: number;
  score: number | null;
  status: "empty" | "balanced" | "watch" | "gap";
  dominantSide: "left" | "right" | null;
  lowSide: "left" | "right" | null;
}

export interface StrengthBalanceNudge {
  id: string;
  axisId?: BalanceAxisId;
  severity: BalanceSeverity;
  message: string;
  suggestedPatterns: MovementPattern[];
  suggestedMuscles: MuscleGroup[];
  suggestedTags?: MuscleTag[];
  score: number | null;
}

export interface StrengthBalanceSummary {
  score: number | null;
  label: "No Data" | "Balanced" | "Watch" | "Needs Work";
  axes: BalanceAxisResult[];
  nudges: StrengthBalanceNudge[];
  totals: {
    sets: number;
    push: number;
    pull: number;
    upper: number;
    lower: number;
    frontDelt: number;
    rearDelt: number;
    chestTriceps: number;
    back: number;
  };
}

interface BalanceAxisDefinition {
  id: BalanceAxisId;
  label: string;
  leftLabel: string;
  rightLabel: string;
  minTotal: number;
  left: (inputs: StrengthBalanceInput[]) => number;
  right: (inputs: StrengthBalanceInput[]) => number;
  suggestions: Record<"left" | "right", { patterns: MovementPattern[]; muscles: MuscleGroup[] }>;
  message: (dominantSide: "left" | "right", scopeLabel: string) => string;
}

const PRIMARY_MUSCLE_WEIGHT = 1;
const SECONDARY_MUSCLE_WEIGHT = 0.5;

const PUSH_PATTERNS: MovementPattern[] = ["horizontal_push", "vertical_push", "elbow_extension"];
const PULL_PATTERNS: MovementPattern[] = ["horizontal_pull", "vertical_pull", "elbow_flexion"];
const UPPER_PATTERNS: MovementPattern[] = [...PUSH_PATTERNS, ...PULL_PATTERNS];
const LOWER_PATTERNS: MovementPattern[] = ["quad_dominant", "hip_hinge"];

const BACK_MUSCLES: MuscleGroup[] = ["upper_back", "lats", "traps", "rear_delt"];
const CHEST_TRICEPS_MUSCLES: MuscleGroup[] = ["chest", "triceps"];
const DEFAULT_PROJECTED_PATTERN_SETS = 4;
const DEFAULT_PROJECTED_ISOLATION_SETS = 2;

function roundCount(value: number): number {
  return Math.round(value * 10) / 10;
}

function setWord(value: number): string {
  return value === 1 ? "set" : "sets";
}

export function formatBalanceCount(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

function countPatterns(inputs: StrengthBalanceInput[], patterns: MovementPattern[]): number {
  const patternSet = new Set(patterns);
  return roundCount(
    inputs.reduce((sum, input) => (
      patternSet.has(input.movementPattern) ? sum + input.sets : sum
    ), 0)
  );
}

function countMuscleGroup(inputs: StrengthBalanceInput[], muscles: MuscleGroup[]): number {
  const muscleSet = new Set(muscles);
  return roundCount(
    inputs.reduce((sum, input) => {
      const primaryHit = input.primaryMuscles.some((muscle) => muscleSet.has(muscle));
      if (primaryHit) return sum + input.sets * PRIMARY_MUSCLE_WEIGHT;

      const secondaryHit = input.secondaryMuscles.some((muscle) => muscleSet.has(muscle));
      if (secondaryHit) return sum + input.sets * SECONDARY_MUSCLE_WEIGHT;

      return sum;
    }, 0)
  );
}

function normalizeMuscleTags(tags: readonly string[] | null | undefined): MuscleTag[] {
  if (!tags) return [];
  return tags.filter(isMuscleTag);
}

function countMuscleTags(inputs: StrengthBalanceInput[], tags: MuscleTag[]): number {
  const tagSet = new Set(tags);
  return roundCount(
    inputs.reduce((sum, input) => (
      input.muscleTags.some((tag) => tagSet.has(tag)) ? sum + input.sets : sum
    ), 0)
  );
}

function bicepsHeadBiasNudge(inputs: StrengthBalanceInput[], scopeLabel: string): StrengthBalanceNudge | null {
  const longHead = countMuscleTags(inputs, ["biceps_long_head"]);
  const shortHead = countMuscleTags(inputs, ["biceps_short_head"]);
  const total = longHead + shortHead;
  if (total < 4) return null;

  const high = Math.max(longHead, shortHead);
  const low = Math.min(longHead, shortHead);
  if (high === 0 || low >= high * 0.5) return null;

  const lowTag: MuscleTag = longHead < shortHead ? "biceps_long_head" : "biceps_short_head";
  const dominantLabel = longHead > shortHead ? "long-head" : "short-head";
  const suggestion = lowTag === "biceps_long_head"
    ? "incline curls"
    : "preacher or concentration curls";
  const score = Math.round((low / high) * 100);

  return {
    id: `biceps-head-bias:${lowTag}`,
    severity: score < 50 ? "warning" : "notice",
    message: `Biceps work is ${dominantLabel} biased ${scopeLabel}. Add ${suggestion}?`,
    suggestedPatterns: ["elbow_flexion"],
    suggestedMuscles: ["biceps"],
    suggestedTags: [lowTag],
    score,
  };
}

function brachialisBiasNudge(inputs: StrengthBalanceInput[], scopeLabel: string): StrengthBalanceNudge | null {
  const bicepsHeads = countMuscleTags(inputs, ["biceps_long_head", "biceps_short_head"]);
  const brachialis = countMuscleTags(inputs, ["brachialis"]);
  if (bicepsHeads < 5 || brachialis >= 2 || brachialis >= bicepsHeads * 0.35) return null;

  const score = bicepsHeads === 0 ? 0 : Math.round((brachialis / bicepsHeads) * 100);
  return {
    id: "biceps-brachialis-low",
    severity: score < 35 ? "warning" : "notice",
    message: `Curl work is mostly supinated ${scopeLabel}. Add hammer curls for brachialis balance?`,
    suggestedPatterns: ["elbow_flexion"],
    suggestedMuscles: ["biceps", "forearm"],
    suggestedTags: ["brachialis", "brachioradialis"],
    score,
  };
}

const AXIS_DEFINITIONS: BalanceAxisDefinition[] = [
  {
    id: "push_pull",
    label: "Push / Pull",
    leftLabel: "Push",
    rightLabel: "Pull",
    minTotal: 4,
    left: (inputs) => countPatterns(inputs, PUSH_PATTERNS),
    right: (inputs) => countPatterns(inputs, PULL_PATTERNS),
    suggestions: {
      left: { patterns: PUSH_PATTERNS, muscles: ["chest", "front_delt", "lateral_delt", "triceps"] },
      right: { patterns: PULL_PATTERNS, muscles: ["upper_back", "lats", "rear_delt", "biceps"] },
    },
    message: (dominantSide, scopeLabel) =>
      dominantSide === "left"
        ? `Push work is ahead ${scopeLabel}. Add a pull?`
        : `Pull work is ahead ${scopeLabel}. Add a push?`,
  },
  {
    id: "horizontal_push_pull",
    label: "Horizontal Push / Pull",
    leftLabel: "Horizontal push",
    rightLabel: "Horizontal pull",
    minTotal: 3,
    left: (inputs) => countPatterns(inputs, ["horizontal_push"]),
    right: (inputs) => countPatterns(inputs, ["horizontal_pull"]),
    suggestions: {
      left: { patterns: ["horizontal_push"], muscles: ["chest", "front_delt", "triceps"] },
      right: { patterns: ["horizontal_pull"], muscles: ["upper_back", "lats", "rear_delt"] },
    },
    message: (dominantSide, scopeLabel) =>
      dominantSide === "left"
        ? `Heavy horizontal push ${scopeLabel}. Add a horizontal pull?`
        : `Heavy horizontal pull ${scopeLabel}. Add a horizontal push?`,
  },
  {
    id: "quad_hinge",
    label: "Quad / Hinge",
    leftLabel: "Quad",
    rightLabel: "Hinge",
    minTotal: 3,
    left: (inputs) => countPatterns(inputs, ["quad_dominant"]),
    right: (inputs) => countPatterns(inputs, ["hip_hinge"]),
    suggestions: {
      left: { patterns: ["quad_dominant"], muscles: ["quads"] },
      right: { patterns: ["hip_hinge"], muscles: ["hamstrings", "glutes", "lower_back"] },
    },
    message: (dominantSide, scopeLabel) =>
      dominantSide === "left"
        ? `Quad volume is ahead of hinge volume ${scopeLabel}.`
        : `Hinge volume is ahead of quad volume ${scopeLabel}.`,
  },
  {
    id: "vertical_push_pull",
    label: "Vertical Push / Pull",
    leftLabel: "Vertical push",
    rightLabel: "Vertical pull",
    minTotal: 3,
    left: (inputs) => countPatterns(inputs, ["vertical_push"]),
    right: (inputs) => countPatterns(inputs, ["vertical_pull"]),
    suggestions: {
      left: { patterns: ["vertical_push"], muscles: ["front_delt", "lateral_delt", "triceps"] },
      right: { patterns: ["vertical_pull"], muscles: ["lats", "upper_back", "biceps"] },
    },
    message: (dominantSide, scopeLabel) =>
      dominantSide === "left"
        ? `Vertical push is ahead ${scopeLabel}. Add a vertical pull?`
        : `Vertical pull is ahead ${scopeLabel}. Add a vertical push?`,
  },
  {
    id: "elbow_flexion_extension",
    label: "Elbow Flex / Extension",
    leftLabel: "Flexion",
    rightLabel: "Extension",
    minTotal: 3,
    left: (inputs) => countPatterns(inputs, ["elbow_flexion"]),
    right: (inputs) => countPatterns(inputs, ["elbow_extension"]),
    suggestions: {
      left: { patterns: ["elbow_flexion"], muscles: ["biceps", "forearm"] },
      right: { patterns: ["elbow_extension"], muscles: ["triceps"] },
    },
    message: (dominantSide, scopeLabel) =>
      dominantSide === "left"
        ? `Elbow flexion is ahead ${scopeLabel}. Add triceps?`
        : `Elbow extension is ahead ${scopeLabel}. Add biceps?`,
  },
  {
    id: "upper_lower",
    label: "Upper / Lower",
    leftLabel: "Upper",
    rightLabel: "Lower",
    minTotal: 4,
    left: (inputs) => countPatterns(inputs, UPPER_PATTERNS),
    right: (inputs) => countPatterns(inputs, LOWER_PATTERNS),
    suggestions: {
      left: { patterns: UPPER_PATTERNS, muscles: ["chest", "upper_back", "lats", "front_delt", "lateral_delt", "rear_delt"] },
      right: { patterns: LOWER_PATTERNS, muscles: ["quads", "hamstrings", "glutes"] },
    },
    message: (dominantSide, scopeLabel) =>
      dominantSide === "left"
        ? `Upper-body volume is ahead ${scopeLabel}. Lower body is low.`
        : `Lower-body volume is ahead ${scopeLabel}. Upper body is low.`,
  },
  {
    id: "front_rear_shoulder",
    label: "Front / Rear Delts",
    leftLabel: "Front delt",
    rightLabel: "Rear delt",
    minTotal: 3,
    left: (inputs) => countMuscleGroup(inputs, ["front_delt"]),
    right: (inputs) => countMuscleGroup(inputs, ["rear_delt"]),
    suggestions: {
      left: { patterns: ["horizontal_push", "vertical_push"], muscles: ["front_delt"] },
      right: { patterns: ["horizontal_pull"], muscles: ["rear_delt", "upper_back"] },
    },
    message: (dominantSide, scopeLabel) =>
      dominantSide === "left"
        ? `Shoulders are getting a lot of front-delt work; rear delts are low ${scopeLabel}.`
        : `Rear delts are ahead of front-delt work ${scopeLabel}.`,
  },
];

function scoreAxis(definition: BalanceAxisDefinition, inputs: StrengthBalanceInput[]): BalanceAxisResult {
  const left = definition.left(inputs);
  const right = definition.right(inputs);
  const total = roundCount(left + right);

  if (total < definition.minTotal) {
    return {
      id: definition.id,
      label: definition.label,
      leftLabel: definition.leftLabel,
      rightLabel: definition.rightLabel,
      left,
      right,
      total,
      score: null,
      status: "empty",
      dominantSide: null,
      lowSide: null,
    };
  }

  const high = Math.max(left, right);
  const low = Math.min(left, right);
  const score = high === 0 ? null : Math.round((low / high) * 100);
  const dominantSide = left === right ? null : left > right ? "left" : "right";
  const lowSide = dominantSide === "left" ? "right" : dominantSide === "right" ? "left" : null;

  return {
    id: definition.id,
    label: definition.label,
    leftLabel: definition.leftLabel,
    rightLabel: definition.rightLabel,
    left,
    right,
    total,
    score,
    status: score === null ? "empty" : score >= 80 ? "balanced" : score >= 60 ? "watch" : "gap",
    dominantSide,
    lowSide,
  };
}

function labelForScore(score: number | null): StrengthBalanceSummary["label"] {
  if (score === null) return "No Data";
  if (score >= 80) return "Balanced";
  if (score >= 60) return "Watch";
  return "Needs Work";
}

function makeAxisNudge(axis: BalanceAxisResult, scopeLabel: string): StrengthBalanceNudge | null {
  if (!axis.dominantSide || !axis.lowSide || axis.score === null || axis.score >= 75) return null;

  const definition = AXIS_DEFINITIONS.find((candidate) => candidate.id === axis.id);
  if (!definition) return null;

  const suggestion = definition.suggestions[axis.lowSide];

  return {
    id: `${axis.id}:${axis.lowSide}`,
    axisId: axis.id,
    severity: axis.score < 50 ? "warning" : "notice",
    message: definition.message(axis.dominantSide, scopeLabel),
    suggestedPatterns: suggestion.patterns,
    suggestedMuscles: suggestion.muscles,
    score: axis.score,
  };
}

function makeSupplementalNudges(inputs: StrengthBalanceInput[], scopeLabel: string): StrengthBalanceNudge[] {
  const chestTriceps = countMuscleGroup(inputs, CHEST_TRICEPS_MUSCLES);
  const back = countMuscleGroup(inputs, BACK_MUSCLES);
  const nudges: StrengthBalanceNudge[] = [];

  if (chestTriceps >= 5 && back <= 2 && back < chestTriceps * 0.5) {
    nudges.push({
      id: "back-low",
      severity: "warning",
      message: `Chest/triceps are covered. Back has only ${formatBalanceCount(back)} ${setWord(back)} ${scopeLabel}.`,
      suggestedPatterns: ["horizontal_pull", "vertical_pull"],
      suggestedMuscles: ["upper_back", "lats", "rear_delt"],
      score: back === 0 ? 0 : Math.round((back / chestTriceps) * 100),
    });
  }

  const headNudge = bicepsHeadBiasNudge(inputs, scopeLabel);
  if (headNudge) nudges.push(headNudge);

  const brachialisNudge = brachialisBiasNudge(inputs, scopeLabel);
  if (brachialisNudge) nudges.push(brachialisNudge);

  return nudges;
}

export function computeStrengthBalance(
  inputs: StrengthBalanceInput[],
  options: { scopeLabel?: string; nudgeLimit?: number } = {}
): StrengthBalanceSummary {
  const scopeLabel = options.scopeLabel ?? "this week";
  const nudgeLimit = options.nudgeLimit ?? 3;
  const activeInputs = inputs.filter((input) => input.sets > 0);
  const axes = AXIS_DEFINITIONS.map((definition) => scoreAxis(definition, activeInputs));
  const scoredAxes = axes.filter((axis): axis is BalanceAxisResult & { score: number } => axis.score !== null);
  const score = scoredAxes.length > 0
    ? Math.round(scoredAxes.reduce((sum, axis) => sum + axis.score, 0) / scoredAxes.length)
    : null;

  const axisNudges = axes
    .map((axis) => makeAxisNudge(axis, scopeLabel))
    .filter((nudge): nudge is StrengthBalanceNudge => Boolean(nudge));

  const nudges = [...axisNudges, ...makeSupplementalNudges(activeInputs, scopeLabel)]
    .toSorted((a, b) => {
      const severityDiff = Number(b.severity === "warning") - Number(a.severity === "warning");
      if (severityDiff !== 0) return severityDiff;
      const scoreDiff = (a.score ?? 100) - (b.score ?? 100);
      if (scoreDiff !== 0) return scoreDiff;
      return Number(Boolean(b.suggestedTags?.length)) - Number(Boolean(a.suggestedTags?.length));
    })
    .slice(0, nudgeLimit);

  return {
    score,
    label: labelForScore(score),
    axes,
    nudges,
    totals: {
      sets: activeInputs.reduce((sum, input) => sum + input.sets, 0),
      push: countPatterns(activeInputs, PUSH_PATTERNS),
      pull: countPatterns(activeInputs, PULL_PATTERNS),
      upper: countPatterns(activeInputs, UPPER_PATTERNS),
      lower: countPatterns(activeInputs, LOWER_PATTERNS),
      frontDelt: countMuscleGroup(activeInputs, ["front_delt"]),
      rearDelt: countMuscleGroup(activeInputs, ["rear_delt"]),
      chestTriceps: countMuscleGroup(activeInputs, CHEST_TRICEPS_MUSCLES),
      back: countMuscleGroup(activeInputs, BACK_MUSCLES),
    },
  };
}

export function sessionToStrengthInputs(session: SessionState): StrengthBalanceInput[] {
  return session.exercises
    .filter((exercise) => exercise.sets.length > 0)
    .map((exercise) => ({
      exerciseId: exercise.exerciseId,
      name: exercise.name,
      movementPattern: exercise.movementPattern ?? "other",
      primaryMuscles: exercise.primaryMuscles,
      secondaryMuscles: exercise.secondaryMuscles,
      muscleTags: exercise.muscleTags ?? [],
      sets: exercise.sets.length,
    }));
}

export function mergeStrengthInputs(inputs: StrengthBalanceInput[]): StrengthBalanceInput[] {
  const merged = new Map<string, StrengthBalanceInput>();

  for (const input of inputs) {
    const key = [
      input.exerciseId ?? input.name ?? "",
      input.movementPattern,
      input.primaryMuscles.join(","),
      input.secondaryMuscles.join(","),
      input.muscleTags.join(","),
    ].join("|");
    const existing = merged.get(key);
    if (existing) {
      existing.sets += input.sets;
    } else {
      merged.set(key, { ...input });
    }
  }

  return Array.from(merged.values());
}

export function strengthInputsFromExerciseSets(rows: StrengthSetDescriptor[]): StrengthBalanceInput[] {
  const groups = new Map<string, StrengthBalanceInput>();

  for (const row of rows) {
    const key = [
      row.exerciseId,
      row.movementPattern ?? "other",
      (row.primaryMuscles ?? []).join(","),
      (row.secondaryMuscles ?? []).join(","),
      normalizeMuscleTags(row.muscleTags).join(","),
    ].join("|");
    const existing = groups.get(key);
    if (existing) {
      existing.sets += row.sets ?? 1;
      continue;
    }

    groups.set(key, {
      exerciseId: row.exerciseId,
      name: row.name ?? "Unknown exercise",
      movementPattern: row.movementPattern ?? "other",
      primaryMuscles: row.primaryMuscles ?? [],
      secondaryMuscles: row.secondaryMuscles ?? [],
      muscleTags: normalizeMuscleTags(row.muscleTags),
      sets: row.sets ?? 1,
    });
  }

  return Array.from(groups.values());
}

function musclesFromFocus(focus: Set<MuscleGroup>, preferred: MuscleGroup[], fallback: MuscleGroup[]): MuscleGroup[] {
  const focused = preferred.filter((muscle) => focus.has(muscle));
  return focused.length > 0 ? focused : fallback;
}

export function projectDayTypeToStrengthInputs(
  dayType: DayType,
  options: StrengthPlanProjectionOptions = {}
): StrengthBalanceInput[] {
  if (dayType.category !== "strength" || dayType.name === "Rest" || !dayType.muscle_focus?.length) return [];

  const focus = new Set(dayType.muscle_focus);
  const patternSets = options.setsPerPattern ?? DEFAULT_PROJECTED_PATTERN_SETS;
  const isolationSets = options.isolationSets ?? DEFAULT_PROJECTED_ISOLATION_SETS;
  const sourceId = options.sourceId ?? dayType.id;
  const projected: StrengthBalanceInput[] = [];

  function add(
    key: string,
    movementPattern: MovementPattern,
    primaryMuscles: MuscleGroup[],
    secondaryMuscles: MuscleGroup[],
    sets: number
  ) {
    projected.push({
      exerciseId: `planned:${sourceId}:${key}`,
      name: `${dayType.name} plan`,
      movementPattern,
      primaryMuscles,
      secondaryMuscles,
      muscleTags: [],
      sets,
    });
  }

  if (focus.has("chest")) {
    add(
      "horizontal_push",
      "horizontal_push",
      musclesFromFocus(focus, ["chest", "front_delt", "triceps"], ["chest"]),
      ["front_delt", "lateral_delt", "triceps"],
      patternSets
    );
  }

  if ((focus.has("front_delt") || focus.has("lateral_delt")) && focus.has("triceps")) {
    add(
      "vertical_push",
      "vertical_push",
      musclesFromFocus(focus, ["front_delt", "triceps"], ["front_delt", "triceps"]),
      ["lateral_delt", "traps"],
      patternSets
    );
  }

  if (focus.has("upper_back") || focus.has("rear_delt")) {
    add(
      "horizontal_pull",
      "horizontal_pull",
      musclesFromFocus(focus, ["upper_back", "rear_delt", "lats"], ["upper_back"]),
      ["biceps", "traps"],
      patternSets
    );
  }

  if (focus.has("lats")) {
    add(
      "vertical_pull",
      "vertical_pull",
      musclesFromFocus(focus, ["lats", "upper_back", "biceps"], ["lats"]),
      ["rear_delt", "forearm"],
      patternSets
    );
  }

  if (focus.has("quads")) {
    add(
      "quad_dominant",
      "quad_dominant",
      musclesFromFocus(focus, ["quads", "glutes"], ["quads"]),
      ["calves", "adductors"],
      patternSets
    );
  }

  if (focus.has("hamstrings") || focus.has("glutes") || focus.has("lower_back")) {
    add(
      "hip_hinge",
      "hip_hinge",
      musclesFromFocus(focus, ["hamstrings", "glutes", "lower_back"], ["hamstrings", "glutes"]),
      ["adductors"],
      patternSets
    );
  }

  if (focus.has("biceps")) {
    add("elbow_flexion", "elbow_flexion", ["biceps"], ["forearm"], isolationSets);
  }

  if (focus.has("triceps")) {
    add("elbow_extension", "elbow_extension", ["triceps"], [], isolationSets);
  }

  return projected;
}

export function strengthInputsCoverNudge(
  inputs: StrengthBalanceInput[],
  nudge: StrengthBalanceNudge
): boolean {
  if (nudge.suggestedTags?.length) {
    return countMuscleTags(inputs, nudge.suggestedTags) > 0;
  }

  return (
    countPatterns(inputs, nudge.suggestedPatterns) > 0 ||
    countMuscleGroup(inputs, nudge.suggestedMuscles) > 0
  );
}

export function rankExercisesForBalance(
  exercises: Exercise[],
  nudges: StrengthBalanceNudge[]
): string[] {
  if (nudges.length === 0) return [];

  const scored = exercises.map((exercise) => {
    let score = 0;
    nudges.forEach((nudge, index) => {
      const priority = 100 - index * 20;
      if (nudge.suggestedTags?.length) {
        if ((exercise.muscle_tags ?? []).some((tag) => nudge.suggestedTags?.includes(tag))) {
          score += priority * 1.2;
        }
      } else {
        if (nudge.suggestedPatterns.includes(exercise.movement_pattern)) score += priority;
        if (exercise.primary_muscles.some((muscle) => nudge.suggestedMuscles.includes(muscle))) {
          score += priority * 0.8;
        }
        if (exercise.secondary_muscles.some((muscle) => nudge.suggestedMuscles.includes(muscle))) {
          score += priority * 0.35;
        }
      }
    });
    return { id: exercise.id, name: exercise.name, score };
  });

  return scored
    .filter((exercise) => exercise.score > 0)
    .toSorted((a, b) => b.score - a.score || a.name.localeCompare(b.name))
    .map((exercise) => exercise.id);
}
