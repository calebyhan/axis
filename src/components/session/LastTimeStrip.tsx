"use client";

import { useExerciseHistory } from "@/hooks/useExerciseHistory";
import { kgToDisplayWeight, roundDisplayWeight, weightUnit } from "@/lib/units";
import type { Exercise, Units } from "@/types";

interface Props {
  exercise: Exercise;
  currentSetIndex: number; // 0-based index of the set about to be logged
  units: Units;
  onViewHistory: () => void;
}

export function LastTimeStrip({ exercise, currentSetIndex, units, onViewHistory }: Props) {
  const { sessions, loading } = useExerciseHistory(exercise.id);
  const unit = weightUnit(units);

  function d(kg: number) {
    return roundDisplayWeight(kgToDisplayWeight(kg, units));
  }

  if (loading) return null;

  const lastSession = sessions[0];
  if (!lastSession || lastSession.length === 0) return null;

  const matchingSet = lastSession[currentSetIndex] ?? lastSession[lastSession.length - 1];
  const allTimeMax = sessions.flat().reduce((best, s) => (s.e1rm > best.e1rm ? s : best), lastSession[0]);

  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-xs">
      <div className="min-w-0 flex-1">
        <span className="text-muted">Last time, set {matchingSet.set_number}: </span>
        <span className="text-white">
          {d(matchingSet.weight)} {unit} × {matchingSet.reps} @ RPE {matchingSet.rpe}
        </span>
        <span className="text-muted"> · e1RM {d(allTimeMax.e1rm).toFixed(0)} best</span>
      </div>
      <button
        type="button"
        onClick={onViewHistory}
        className="shrink-0 text-accent hover:underline"
      >
        History
      </button>
    </div>
  );
}
