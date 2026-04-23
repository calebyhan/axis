"use client";

import { useState } from "react";
import { computeE1RM } from "@/lib/e1rm";
import type { SessionSet } from "@/types";

interface Props {
  exerciseName: string;
  sets: SessionSet[];
  weightIncrement: number;
  onAddSet: (set: { reps: number; weight: number; rpe: number }) => void;
}

export function SetLogger({ exerciseName, sets, weightIncrement, onAddSet }: Props) {
  const lastSet = sets[sets.length - 1];
  const [reps, setReps] = useState(lastSet?.reps ?? 8);
  const [weight, setWeight] = useState(lastSet?.weight ?? 0);
  const [rpe, setRpe] = useState(lastSet?.rpe ?? 7);

  const e1rm = computeE1RM(weight, reps);

  function handleAdd() {
    onAddSet({ reps, weight, rpe });
  }

  return (
    <div className="flex flex-col gap-4">
      <h3 className="text-sm font-medium text-muted">
        Set {sets.length + 1} · {exerciseName}
      </h3>

      {/* Previous sets */}
      {sets.length > 0 && (
        <div className="flex flex-col gap-1">
          {sets.map((s, i) => (
            <div key={i} className="flex items-center justify-between text-xs text-muted px-1">
              <span>Set {i + 1}</span>
              <span>{s.weight} kg × {s.reps} @ RPE {s.rpe}</span>
              <span className="text-white">{computeE1RM(s.weight, s.reps).toFixed(1)} e1RM</span>
            </div>
          ))}
        </div>
      )}

      {/* Inputs */}
      <div className="grid grid-cols-3 gap-3">
        <div className="flex flex-col gap-1">
          <label className="text-xs text-muted">Weight (kg)</label>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setWeight((w) => Math.max(0, w - weightIncrement))}
              className="w-7 h-7 flex items-center justify-center rounded bg-border text-muted hover:text-white"
            >−</button>
            <input
              type="number"
              value={weight}
              onChange={(e) => setWeight(parseFloat(e.target.value) || 0)}
              className="flex-1 w-0 min-w-0 bg-surface border border-border rounded px-2 py-1.5 text-sm text-center focus:outline-none focus:border-[var(--accent)]"
            />
            <button
              onClick={() => setWeight((w) => w + weightIncrement)}
              className="w-7 h-7 flex items-center justify-center rounded bg-border text-muted hover:text-white"
            >+</button>
          </div>
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-xs text-muted">Reps</label>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setReps((r) => Math.max(1, r - 1))}
              className="w-7 h-7 flex items-center justify-center rounded bg-border text-muted hover:text-white"
            >−</button>
            <input
              type="number"
              value={reps}
              onChange={(e) => setReps(parseInt(e.target.value) || 1)}
              className="flex-1 w-0 min-w-0 bg-surface border border-border rounded px-2 py-1.5 text-sm text-center focus:outline-none focus:border-[var(--accent)]"
            />
            <button
              onClick={() => setReps((r) => r + 1)}
              className="w-7 h-7 flex items-center justify-center rounded bg-border text-muted hover:text-white"
            >+</button>
          </div>
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-xs text-muted">RPE</label>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setRpe((r) => Math.max(1, r - 0.5))}
              className="w-7 h-7 flex items-center justify-center rounded bg-border text-muted hover:text-white"
            >−</button>
            <input
              type="number"
              step="0.5"
              value={rpe}
              onChange={(e) => setRpe(parseFloat(e.target.value) || 1)}
              className="flex-1 w-0 min-w-0 bg-surface border border-border rounded px-2 py-1.5 text-sm text-center focus:outline-none focus:border-[var(--accent)]"
            />
            <button
              onClick={() => setRpe((r) => Math.min(10, r + 0.5))}
              className="w-7 h-7 flex items-center justify-center rounded bg-border text-muted hover:text-white"
            >+</button>
          </div>
        </div>
      </div>

      {/* e1RM preview */}
      <div className="text-center text-xs text-muted">
        Estimated 1RM: <span className="text-white font-medium">{e1rm.toFixed(1)} kg</span>
      </div>

      <button
        onClick={handleAdd}
        className="w-full bg-accent py-3 rounded-lg text-sm font-medium text-white hover:opacity-90 transition-opacity"
      >
        Log Set
      </button>
    </div>
  );
}
