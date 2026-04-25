"use client";

import { computeE1RM } from "@/lib/e1rm";
import { formatWeight, weightUnit } from "@/lib/units";
import type { SessionState, Units } from "@/types";

interface Props {
  session: SessionState;
  onClose: () => void;
  units: Units;
}

function getPushPullSplit(session: SessionState): { push: number; pull: number } {
  let push = 0;
  let pull = 0;
  for (const ex of session.exercises) {
    const sets = ex.sets.length;
    if (
      ex.primaryMuscles.some((m) =>
        ["chest", "front_delt", "triceps"].includes(m)
      )
    ) {
      push += sets;
    }
    if (
      ex.primaryMuscles.some((m) =>
        ["upper_back", "lats", "biceps", "rear_delt"].includes(m)
      )
    ) {
      pull += sets;
    }
  }
  return { push, pull };
}

function getDuration(session: SessionState): string {
  const ms = Date.now() - session.startTime.getTime();
  const mins = Math.floor(ms / 60_000);
  const hrs = Math.floor(mins / 60);
  const rem = mins % 60;
  return hrs > 0 ? `${hrs}h ${rem}m` : `${mins}m`;
}

export function SessionSummary({ session, onClose, units }: Props) {
  const totalSets = session.exercises.reduce((sum, ex) => sum + ex.sets.length, 0);
  const totalVolume = session.exercises.reduce(
    (sum, ex) => sum + ex.sets.reduce((s, set) => s + set.weight * set.reps, 0),
    0
  );
  const { push, pull } = getPushPullSplit(session);
  const total = push + pull || 1;
  const pushPct = Math.round((push / total) * 100);
  const pullPct = Math.round((pull / total) * 100);

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

      {/* Push/pull balance */}
      {push + pull > 0 && (
        <div>
          <p className="text-xs text-muted mb-2">Session balance</p>
          <div className="flex gap-2 h-2 rounded-full overflow-hidden">
            <div
              className="bg-accent h-full rounded-l-full transition-all"
              style={{ width: `${pushPct}%` }}
            />
            <div
              className="flex-1 h-full rounded-r-full"
              style={{ background: "#333" }}
            />
          </div>
          <div className="flex justify-between text-xs text-muted mt-1">
            <span>{pushPct}% push</span>
            <span>{pullPct}% pull</span>
          </div>
        </div>
      )}

      {/* Exercise list */}
      <div>
        <p className="text-xs text-muted mb-2 uppercase tracking-wide">Exercises</p>
        <div className="flex flex-col gap-2">
          {session.exercises.map((ex) => {
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
        onClick={onClose}
        className="w-full border border-border py-3 rounded-lg text-sm font-medium text-muted hover:text-white transition-colors"
      >
        Close
      </button>
    </div>
  );
}
