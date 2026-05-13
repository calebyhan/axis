"use client";

import { computeE1RM } from "@/lib/e1rm";
import { BalanceScoreCard } from "@/components/strength/BalanceScoreCard";
import { computeStrengthBalance, mergeStrengthInputs, sessionToStrengthInputs, type StrengthBalanceInput } from "@/lib/strength-balance";
import { formatWeight, weightUnit } from "@/lib/units";
import type { SessionState, Units } from "@/types";

interface Props {
  session: SessionState;
  onClose: () => void;
  units: Units;
  weeklyStrengthInputs?: StrengthBalanceInput[];
}

function getDuration(session: SessionState): string {
  const ms = Date.now() - session.startTime.getTime();
  const mins = Math.floor(ms / 60_000);
  const hrs = Math.floor(mins / 60);
  const rem = mins % 60;
  return hrs > 0 ? `${hrs}h ${rem}m` : `${mins}m`;
}

export function SessionSummary({ session, onClose, units, weeklyStrengthInputs = [] }: Props) {
  const loggedExercises = session.exercises.filter((ex) => ex.sets.length > 0);
  const totalSets = loggedExercises.reduce((sum, ex) => sum + ex.sets.length, 0);
  const totalVolume = loggedExercises.reduce(
    (sum, ex) => sum + ex.sets.reduce((s, set) => s + set.weight * set.reps, 0),
    0
  );
  const sessionStrengthInputs = sessionToStrengthInputs(session);
  const weeklyBalance = computeStrengthBalance(
    mergeStrengthInputs([...weeklyStrengthInputs, ...sessionStrengthInputs]),
    { scopeLabel: "this week", nudgeLimit: 1 }
  );

  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-3 gap-3 text-center">
        <div className="card p-3">
          <div className="text-lg font-semibold">{getDuration(session)}</div>
          <div className="text-xs text-muted mt-0.5">Duration</div>
        </div>
        <div className="card p-3">
          <div className="text-lg font-semibold">{totalSets}</div>
          <div className="text-xs text-muted mt-0.5">Sets</div>
        </div>
        <div className="card p-3">
          <div className="text-lg font-semibold">{formatWeight(totalVolume, units)}</div>
          <div className="text-xs text-muted mt-0.5">Volume ({weightUnit(units)})</div>
        </div>
      </div>

      <BalanceScoreCard balance={weeklyBalance} contextLabel="this week after this session" compact />

      {/* Exercise list */}
      <div>
        <p className="text-xs text-muted mb-2 uppercase tracking-wide">Exercises</p>
        <div className="flex flex-col gap-2">
          {loggedExercises.map((ex) => {
            const bestE1RM = ex.sets.length > 0
              ? Math.max(...ex.sets.map((s) => computeE1RM(s.weight, s.reps)))
              : 0;
            return (
              <div key={ex.exerciseId} className="flex justify-between text-sm">
                <span>{ex.name}</span>
                <span className="text-muted">
                  {ex.sets.length} sets · {bestE1RM > 0 ? `${formatWeight(bestE1RM, units)} e1RM` : "BW"}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      <button
        type="button"
        onClick={onClose}
        className="w-full border border-border py-3 rounded-lg text-sm font-medium text-muted hover:text-white transition-colors"
      >
        Close
      </button>
    </div>
  );
}
