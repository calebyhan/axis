import Fuse from "fuse.js";
import { muscleTagLabel } from "@/lib/muscle-tags";
import { MUSCLE_GROUPS, type Exercise, type MuscleGroup } from "@/types";

const MUSCLE_ALIASES: Record<MuscleGroup, string[]> = {
  chest: ["pec", "pecs", "pectorals"],
  front_delt: ["front delt", "anterior delt", "anterior deltoid", "front shoulder", "shoulders"],
  lateral_delt: ["side delt", "medial delt", "lateral deltoid", "side shoulder", "shoulders"],
  rear_delt: ["rear delt", "posterior delt", "posterior deltoid", "rear shoulder", "shoulders"],
  triceps: ["tricep", "arms"],
  biceps: ["bicep", "arms"],
  forearm: ["forearms", "grip"],
  upper_back: ["upper back", "mid back", "rhomboids", "back"],
  lats: ["lat", "latissimus", "back"],
  traps: ["trap", "trapezius", "upper traps", "back"],
  lower_back: ["erectors", "spinal erectors", "back"],
  glutes: ["glute", "gluteals", "hips", "legs"],
  quads: ["quad", "quadriceps", "legs"],
  hamstrings: ["hamstring", "posterior chain", "legs"],
  calves: ["calf", "legs"],
  hip_flexors: ["hip flexor", "hips", "legs"],
  adductors: ["adductor", "inner thigh", "groin", "legs"],
  abs: ["ab", "abdominals", "core"],
  obliques: ["oblique", "side abs", "core"],
};

interface ExerciseSearchDocument {
  exercise: Exercise;
  name: string;
  category: string;
  equipment: string;
  movementPatternTerms: string[];
  primaryMuscleTerms: string[];
  secondaryMuscleTerms: string[];
  muscleTagTerms: string[];
}

export function muscleGroupLabel(muscle: MuscleGroup): string {
  return muscle.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function normalizeSearchText(value: string): string {
  return value
    .toLowerCase()
    .replace(/[_-]/g, " ")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function uniqueTerms(terms: string[]): string[] {
  return Array.from(new Set(terms.map(normalizeSearchText).filter(Boolean)));
}

function movementPatternTerms(pattern: Exercise["movement_pattern"]): string[] {
  const spaced = pattern.replace(/_/g, " ");
  return uniqueTerms([pattern, spaced, ...spaced.split(" ")]);
}

function muscleSearchTerms(muscle: MuscleGroup): string[] {
  return uniqueTerms([muscle, muscleGroupLabel(muscle), ...MUSCLE_ALIASES[muscle]]);
}

function queryMuscles(query: string): MuscleGroup[] {
  const normalizedQuery = normalizeSearchText(query);
  if (!normalizedQuery) return [];

  return MUSCLE_GROUPS.filter((muscle) =>
    muscleSearchTerms(muscle).some((term) => term === normalizedQuery)
  );
}

function buildExerciseSearchDocument(exercise: Exercise): ExerciseSearchDocument {
  return {
    exercise,
    name: exercise.name,
    category: exercise.category,
    equipment: exercise.equipment,
    movementPatternTerms: movementPatternTerms(exercise.movement_pattern),
    primaryMuscleTerms: exercise.primary_muscles.flatMap(muscleSearchTerms),
    secondaryMuscleTerms: exercise.secondary_muscles.flatMap(muscleSearchTerms),
    muscleTagTerms: (exercise.muscle_tags ?? []).flatMap((tag) => uniqueTerms([tag, muscleTagLabel(tag)])),
  };
}

function muscleMatchRank(exercise: Exercise, muscles: MuscleGroup[]): number {
  if (muscles.length === 0) return 0;
  if (exercise.primary_muscles.some((muscle) => muscles.includes(muscle))) return 0;
  if (exercise.secondary_muscles.some((muscle) => muscles.includes(muscle))) return 1;
  return 2;
}

export function searchExercises(exercises: Exercise[], query: string, limit = 20): Exercise[] {
  const normalizedQuery = normalizeSearchText(query);
  if (!normalizedQuery) return exercises.slice(0, limit);

  const exactMuscles = queryMuscles(normalizedQuery);
  const documents = exercises.map(buildExerciseSearchDocument);

  return new Fuse(documents, {
    keys: [
      { name: "name", weight: 0.45 },
      { name: "primaryMuscleTerms", weight: 0.35 },
      { name: "secondaryMuscleTerms", weight: 0.25 },
      { name: "muscleTagTerms", weight: 0.18 },
      { name: "movementPatternTerms", weight: 0.16 },
      { name: "category", weight: 0.12 },
      { name: "equipment", weight: 0.08 },
    ],
    threshold: 0.34,
    distance: 80,
    ignoreLocation: true,
    includeScore: true,
  })
    .search(normalizedQuery)
    .sort((a, b) => {
      const rankDelta = muscleMatchRank(a.item.exercise, exactMuscles) - muscleMatchRank(b.item.exercise, exactMuscles);
      if (rankDelta !== 0) return rankDelta;
      return (a.score ?? 0) - (b.score ?? 0);
    })
    .map((result) => result.item.exercise)
    .slice(0, limit);
}
