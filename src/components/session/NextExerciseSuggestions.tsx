"use client";

import type { Exercise, MuscleGroup, SessionState } from "@/types";

interface ExerciseScore {
  exercise: Exercise;
  score: number;
}

interface Props {
  exercises: Exercise[];
  session: SessionState;
  dayTypeMuscles: MuscleGroup[];
  lastTrainedDays: Partial<Record<string, number>>; // exercise_id → days since last trained
  onSelect: (exercise: Exercise) => void;
}

export function NextExerciseSuggestions({
  exercises,
  session,
  dayTypeMuscles,
  lastTrainedDays,
  onSelect,
}: Props) {
  const loggedIds = new Set(session.exercises.map((e) => e.exerciseId));

  const scored: ExerciseScore[] = exercises
    .filter((ex) => !loggedIds.has(ex.id))
    .map((ex) => {
      const currentSets = 0; // would be from session state for this exercise
      const targetSets = dayTypeMuscles.some(
        (m) =>
          ex.primary_muscles.includes(m) || ex.secondary_muscles.includes(m)
      )
        ? 3
        : 0;
      const daysSince = lastTrainedDays[ex.id] ?? 7;
      const score = (targetSets - currentSets) * 2 + daysSince;
      return { exercise: ex, score };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, 4);

  if (scored.length === 0) return null;

  return (
    <div>
      <p className="text-xs text-muted mb-2 uppercase tracking-wide">Suggested next</p>
      <div className="flex flex-wrap gap-2">
        {scored.map(({ exercise }) => (
          <button
            key={exercise.id}
            onClick={() => onSelect(exercise)}
            className="px-3 py-1.5 rounded-full border border-border text-sm text-white hover:border-accent hover:text-accent transition-colors"
          >
            {exercise.name}
          </button>
        ))}
      </div>
    </div>
  );
}
