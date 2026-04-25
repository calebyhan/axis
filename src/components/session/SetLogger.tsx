"use client";

import { useState } from "react";
import { computeE1RM } from "@/lib/e1rm";
import { weightUnit } from "@/lib/units";
import type { SessionSet, Units } from "@/types";

interface Props {
  exerciseName: string;
  sets: SessionSet[];
  weightIncrement: number; // always kg
  units: Units;
  onAddSet: (set: { reps: number; weight: number; rpe: number }) => void; // weight always kg
}

export function SetLogger({ exerciseName, sets, weightIncrement, units, onAddSet }: Props) {
  const lastSet = sets[sets.length - 1];
  const unit = weightUnit(units);

  function kgToDisplay(kg: number) {
    return units === "imperial" ? Math.round(kg * 2.20462 * 10) / 10 : kg;
  }
  function displayToKg(v: number) {
    return units === "imperial" ? v / 2.20462 : v;
  }
  const dispIncrement = units === "imperial"
    ? Math.round(weightIncrement * 2.20462 * 10) / 10
    : weightIncrement;

  const [repsStr, setRepsStr] = useState(String(lastSet?.reps ?? 8));
  const [weightStr, setWeightStr] = useState(String(kgToDisplay(lastSet?.weight ?? 0)));
  const [rpeStr, setRpeStr] = useState(String(lastSet?.rpe ?? 7));

  const reps = Math.max(1, parseInt(repsStr) || 1);
  const weightDisplay = parseFloat(weightStr) || 0;
  const rpe = Math.min(10, Math.max(1, parseFloat(rpeStr) || 1));

  const e1rmDisplay = kgToDisplay(computeE1RM(displayToKg(weightDisplay), reps));

  function handleAdd() {
    onAddSet({ reps, weight: displayToKg(weightDisplay), rpe });
  }

  return (
    <div className="flex flex-col gap-4">
      <h3 className="text-sm font-medium text-muted">
        Set {sets.length + 1} · {exerciseName}
      </h3>

      {sets.length > 0 && (
        <div className="flex flex-col gap-1">
          {sets.map((s, setIdx) => (
            <div key={`set-log-${setIdx}`} className="flex items-center justify-between text-xs text-muted px-1">
              <span>Set {setIdx + 1}</span>
              <span>{kgToDisplay(s.weight)} {unit} × {s.reps} @ RPE {s.rpe}</span>
              <span className="text-white">{kgToDisplay(computeE1RM(s.weight, s.reps)).toFixed(1)} e1RM</span>
            </div>
          ))}
        </div>
      )}

      <div className="grid grid-cols-3 gap-3">
        <div className="flex flex-col gap-1">
          <label className="text-xs text-muted">Weight ({unit})</label>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setWeightStr(String(Math.max(0, Math.round((weightDisplay - dispIncrement) * 10) / 10)))}
              className="w-7 h-7 flex items-center justify-center rounded bg-border text-muted hover:text-white"
            >−</button>
            <input
              type="number"
              inputMode="decimal"
              value={weightStr}
              onChange={(e) => setWeightStr(e.target.value)}
              onBlur={() => setWeightStr(String(Math.max(0, parseFloat(weightStr) || 0)))}
              className="flex-1 w-0 min-w-0 bg-surface border border-border rounded px-2 py-1.5 text-sm text-center focus:outline-none focus:border-[var(--accent)]"
            />
            <button
              onClick={() => setWeightStr(String(Math.round((weightDisplay + dispIncrement) * 10) / 10))}
              className="w-7 h-7 flex items-center justify-center rounded bg-border text-muted hover:text-white"
            >+</button>
          </div>
        </div>

        <div className="flex flex-col gap-1">
          <label htmlFor="set-reps-input" className="text-xs text-muted">Reps</label>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setRepsStr(String(Math.max(1, reps - 1)))}
              className="w-7 h-7 flex items-center justify-center rounded bg-border text-muted hover:text-white"
            >−</button>
            <input
              id="set-reps-input"
              type="number"
              inputMode="numeric"
              value={repsStr}
              onChange={(e) => setRepsStr(e.target.value)}
              onBlur={() => setRepsStr(String(Math.max(1, parseInt(repsStr) || 1)))}
              className="flex-1 w-0 min-w-0 bg-surface border border-border rounded px-2 py-1.5 text-sm text-center focus:outline-none focus:border-[var(--accent)]"
            />
            <button
              onClick={() => setRepsStr(String(reps + 1))}
              className="w-7 h-7 flex items-center justify-center rounded bg-border text-muted hover:text-white"
            >+</button>
          </div>
        </div>

        <div className="flex flex-col gap-1">
          <label htmlFor="set-rpe-input" className="text-xs text-muted">RPE</label>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setRpeStr(String(Math.max(1, Math.round((rpe - 0.5) * 10) / 10)))}
              className="w-7 h-7 flex items-center justify-center rounded bg-border text-muted hover:text-white"
            >−</button>
            <input
              id="set-rpe-input"
              type="number"
              inputMode="decimal"
              step="0.5"
              value={rpeStr}
              onChange={(e) => setRpeStr(e.target.value)}
              onBlur={() => setRpeStr(String(Math.min(10, Math.max(1, parseFloat(rpeStr) || 1))))}
              className="flex-1 w-0 min-w-0 bg-surface border border-border rounded px-2 py-1.5 text-sm text-center focus:outline-none focus:border-[var(--accent)]"
            />
            <button
              onClick={() => setRpeStr(String(Math.min(10, Math.round((rpe + 0.5) * 10) / 10)))}
              className="w-7 h-7 flex items-center justify-center rounded bg-border text-muted hover:text-white"
            >+</button>
          </div>
        </div>
      </div>

      <div className="text-center text-xs text-muted">
        Estimated 1RM: <span className="text-white font-medium">{e1rmDisplay.toFixed(1)} {unit}</span>
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
