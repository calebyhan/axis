"use client";

import { useId, useState } from "react";
import { computeE1RM } from "@/lib/e1rm";
import { displayWeightToKg, kgToDisplayWeight, roundDisplayWeight, weightUnit } from "@/lib/units";
import type { SessionSet, Units } from "@/types";

interface Props {
  exerciseName: string;
  sets: SessionSet[];
  suggestedSet: SessionSet | null;
  weightIncrement: number; // active display unit
  units: Units;
  onAddSet: (set: { reps: number; weight: number; rpe: number }) => void; // weight always kg
  onUpdateSet?: (setIndex: number, set: SessionSet) => void;
  onDeleteSet?: (setIndex: number) => void;
}

function inputNumber(value: number) {
  return String(roundDisplayWeight(value));
}

function LoggedSetRow({
  set,
  setIdx,
  weightIncrement,
  units,
  onUpdateSet,
  onDeleteSet,
}: {
  set: SessionSet;
  setIdx: number;
  weightIncrement: number;
  units: Units;
  onUpdateSet?: (setIndex: number, set: SessionSet) => void;
  onDeleteSet?: (setIndex: number) => void;
}) {
  const rowId = useId();
  const unit = weightUnit(units);
  const [editing, setEditing] = useState(false);
  const [repsStr, setRepsStr] = useState(String(set.reps));
  const [weightStr, setWeightStr] = useState(() => inputNumber(kgToDisplayWeight(set.weight, units)));
  const [rpeStr, setRpeStr] = useState(String(set.rpe));

  const reps = Math.max(1, parseInt(repsStr) || 1);
  const weightDisplay = Math.max(0, parseFloat(weightStr) || 0);
  const rpe = Math.min(10, Math.max(1, parseFloat(rpeStr) || 1));
  const canEdit = !!onUpdateSet;
  const canDelete = !!onDeleteSet;

  function displayToKg(value: number) {
    return displayWeightToKg(value, units);
  }

  function resetDraft() {
    setRepsStr(String(set.reps));
    setWeightStr(inputNumber(kgToDisplayWeight(set.weight, units)));
    setRpeStr(String(set.rpe));
  }

  function handleSave() {
    onUpdateSet?.(setIdx, { reps, weight: displayToKg(weightDisplay), rpe });
    setEditing(false);
  }

  if (editing) {
    return (
      <div className="rounded-lg border border-border bg-background/60 p-3">
        <div className="mb-3 flex items-center justify-between gap-3">
          <span className="text-xs font-medium text-white">Set {setIdx + 1}</span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                resetDraft();
                setEditing(false);
              }}
              className="text-xs text-muted hover:text-white"
            >
              Cancel
            </button>
            {canDelete && (
              <button
                type="button"
                onClick={() => onDeleteSet?.(setIdx)}
                className="text-xs text-red-300 hover:text-red-200"
              >
                Delete
              </button>
            )}
          </div>
        </div>

        <div className="grid gap-2 sm:grid-cols-3">
          <div className="flex flex-col gap-1">
            <label htmlFor={`${rowId}-weight`} className="text-[11px] text-muted">Weight ({unit})</label>
            <input
              id={`${rowId}-weight`}
              aria-label={`Weight in ${unit}`}
              type="number"
              inputMode="decimal"
              step={weightIncrement}
              value={weightStr}
              onChange={(e) => setWeightStr(e.target.value)}
              onBlur={() => setWeightStr(String(Math.max(0, roundDisplayWeight(parseFloat(weightStr) || 0))))}
              className="w-full min-w-0 rounded border border-border bg-surface px-2 py-1.5 text-center text-sm focus:outline-none focus:border-[var(--accent)]"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor={`${rowId}-reps`} className="text-[11px] text-muted">Reps</label>
            <input
              id={`${rowId}-reps`}
              aria-label="Reps"
              type="number"
              inputMode="numeric"
              value={repsStr}
              onChange={(e) => setRepsStr(e.target.value)}
              onBlur={() => setRepsStr(String(Math.max(1, parseInt(repsStr) || 1)))}
              className="w-full min-w-0 rounded border border-border bg-surface px-2 py-1.5 text-center text-sm focus:outline-none focus:border-[var(--accent)]"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor={`${rowId}-rpe`} className="text-[11px] text-muted">RPE</label>
            <input
              id={`${rowId}-rpe`}
              aria-label="RPE"
              type="number"
              inputMode="decimal"
              step="0.5"
              value={rpeStr}
              onChange={(e) => setRpeStr(e.target.value)}
              onBlur={() => setRpeStr(String(Math.min(10, Math.max(1, parseFloat(rpeStr) || 1))))}
              className="w-full min-w-0 rounded border border-border bg-surface px-2 py-1.5 text-center text-sm focus:outline-none focus:border-[var(--accent)]"
            />
          </div>
        </div>

        <button
          type="button"
          onClick={handleSave}
          className="mt-3 w-full rounded-lg bg-accent px-3 py-2 text-sm font-medium text-white"
        >
          Save Set
        </button>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-[auto_1fr_auto] items-center gap-3 rounded-lg px-1 py-1.5 text-xs text-muted">
      <span>Set {setIdx + 1}</span>
      <span className="min-w-0 truncate">
        {inputNumber(kgToDisplayWeight(set.weight, units))} {unit} × {set.reps} @ RPE {set.rpe}
      </span>
      <div className="flex items-center gap-2">
        <span className="hidden text-white sm:inline">
          {inputNumber(kgToDisplayWeight(computeE1RM(set.weight, set.reps), units))} e1RM
        </span>
        {canEdit && (
          <button
            type="button"
            onClick={() => {
              resetDraft();
              setEditing(true);
            }}
            aria-label={`Edit set ${setIdx + 1}`}
            className="flex size-9 items-center justify-center rounded-full border border-white/10 text-white/55 hover:border-white/20 hover:text-white"
          >
            <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} className="size-3.5">
              <path d="M12 20h9" />
              <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" />
            </svg>
          </button>
        )}
      </div>
    </div>
  );
}

export function SetLogger({ exerciseName, sets, suggestedSet, weightIncrement, units, onAddSet, onUpdateSet, onDeleteSet }: Props) {
  const lastSet = sets[sets.length - 1];
  const seedSet = suggestedSet ?? lastSet;
  const unit = weightUnit(units);

  function kgToDisplay(kg: number) {
    return roundDisplayWeight(kgToDisplayWeight(kg, units));
  }
  function displayToKg(v: number) {
    return displayWeightToKg(v, units);
  }

  const [repsStr, setRepsStr] = useState(String(seedSet?.reps ?? 8));
  const [weightStr, setWeightStr] = useState(String(kgToDisplay(seedSet?.weight ?? 0)));
  const [rpeStr, setRpeStr] = useState(String(seedSet?.rpe ?? 7));

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
        <div className="flex flex-col gap-1.5">
          {sets.map((s, setIdx) => (
            <LoggedSetRow
              key={`set-${setIdx}-${s.weight}-${s.reps}`}
              set={s}
              setIdx={setIdx}
              weightIncrement={weightIncrement}
              units={units}
              onUpdateSet={onUpdateSet}
              onDeleteSet={onDeleteSet}
            />
          ))}
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="flex flex-col gap-1">
          <label htmlFor="set-weight-input" className="text-xs text-muted">Weight ({unit})</label>
          <div className="flex items-center gap-1">
            <button
              type="button"
              aria-label="Decrease weight"
              onClick={() => setWeightStr(String(Math.max(0, roundDisplayWeight(weightDisplay - weightIncrement))))}
              className="size-11 flex items-center justify-center rounded bg-border text-muted hover:text-white"
            >−</button>
            <input
              id="set-weight-input"
              type="number"
              inputMode="decimal"
              step={weightIncrement}
              value={weightStr}
              onChange={(e) => setWeightStr(e.target.value)}
              onBlur={() => setWeightStr(String(Math.max(0, roundDisplayWeight(parseFloat(weightStr) || 0))))}
              className="flex-1 w-0 min-w-0 bg-surface border border-border rounded px-2 py-1.5 text-sm text-center focus:outline-none focus:border-[var(--accent)]"
            />
            <button
              type="button"
              aria-label="Increase weight"
              onClick={() => setWeightStr(String(roundDisplayWeight(weightDisplay + weightIncrement)))}
              className="size-11 flex items-center justify-center rounded bg-border text-muted hover:text-white"
            >+</button>
          </div>
        </div>

        <div className="flex flex-col gap-1">
          <label htmlFor="set-reps-input" className="text-xs text-muted">Reps</label>
          <div className="flex items-center gap-1">
            <button
              type="button"
              aria-label="Decrease reps"
              onClick={() => setRepsStr(String(Math.max(1, reps - 1)))}
              className="size-11 flex items-center justify-center rounded bg-border text-muted hover:text-white"
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
              type="button"
              aria-label="Increase reps"
              onClick={() => setRepsStr(String(reps + 1))}
              className="size-11 flex items-center justify-center rounded bg-border text-muted hover:text-white"
            >+</button>
          </div>
        </div>

        <div className="flex flex-col gap-1">
          <label htmlFor="set-rpe-input" className="text-xs text-muted">RPE</label>
          <div className="flex items-center gap-1">
            <button
              type="button"
              aria-label="Decrease RPE"
              onClick={() => setRpeStr(String(Math.max(1, Math.round((rpe - 0.5) * 10) / 10)))}
              className="size-11 flex items-center justify-center rounded bg-border text-muted hover:text-white"
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
              type="button"
              aria-label="Increase RPE"
              onClick={() => setRpeStr(String(Math.min(10, Math.round((rpe + 0.5) * 10) / 10)))}
              className="size-11 flex items-center justify-center rounded bg-border text-muted hover:text-white"
            >+</button>
          </div>
        </div>
      </div>

      <div className="text-center text-xs text-muted">
        Estimated 1RM: <span className="text-white font-medium">{e1rmDisplay.toFixed(1)} {unit}</span>
      </div>

      <button
        type="button"
        onClick={handleAdd}
        className="w-full bg-accent py-3 rounded-lg text-sm font-medium text-white hover:opacity-90 transition-opacity"
      >
        Log Set
      </button>
    </div>
  );
}
