"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { updateWorkoutSession } from "@/app/(tabs)/activity/actions";
import { ExerciseSearch } from "@/components/session/ExerciseSearch";
import { computeE1RM } from "@/lib/e1rm";
import { createClient } from "@/lib/supabase/client";
import { displayWeightToKg, formatWeight, kgToDisplayWeight, roundDisplayWeight, weightUnit } from "@/lib/units";
import type { Exercise, MuscleGroup, Units } from "@/types";

export interface EditableWorkoutSet {
  row_id: string;
  exercise_id: string;
  exercise_name: string;
  primary_muscles: MuscleGroup[];
  secondary_muscles: MuscleGroup[];
  set_number: number;
  reps: number;
  weight: number;
  rpe: number;
}

interface Props {
  activityId: string;
  initialSets: EditableWorkoutSet[];
  units: Units;
}

interface ExerciseGroup {
  exerciseId: string;
  name: string;
  primaryMuscles: MuscleGroup[];
  secondaryMuscles: MuscleGroup[];
  sets: EditableWorkoutSet[];
}

function displayNumber(value: number) {
  return String(roundDisplayWeight(value));
}

function groupSets(rows: EditableWorkoutSet[]): ExerciseGroup[] {
  const groups = new Map<string, ExerciseGroup>();
  for (const row of rows) {
    const existing = groups.get(row.exercise_id);
    if (existing) {
      existing.sets.push(row);
      continue;
    }
    groups.set(row.exercise_id, {
      exerciseId: row.exercise_id,
      name: row.exercise_name,
      primaryMuscles: row.primary_muscles,
      secondaryMuscles: row.secondary_muscles,
      sets: [row],
    });
  }

  return Array.from(groups.values()).map((group) => ({
    ...group,
    sets: group.sets.toSorted((a, b) => a.set_number - b.set_number),
  }));
}

function normalizeRows(rows: EditableWorkoutSet[]) {
  return groupSets(rows).flatMap((group) =>
    group.sets.map((set, idx) => ({
      ...set,
      set_number: idx + 1,
    }))
  );
}

function makePayload(rows: EditableWorkoutSet[]) {
  return normalizeRows(rows).map((set) => ({
    exercise_id: set.exercise_id,
    set_number: set.set_number,
    reps: set.reps,
    weight: set.weight,
    rpe: set.rpe,
  }));
}

function findLastExerciseIndex(rows: EditableWorkoutSet[], exerciseId: string) {
  for (let i = rows.length - 1; i >= 0; i -= 1) {
    if (rows[i].exercise_id === exerciseId) return i;
  }
  return -1;
}

export function WorkoutSetsEditor({ activityId, initialSets, units }: Props) {
  const { refresh } = useRouter();
  const unit = weightUnit(units);
  const [editing, setEditing] = useState(false);
  const [committedSets, setCommittedSets] = useState<EditableWorkoutSet[]>(initialSets);
  const [draftSets, setDraftSets] = useState<EditableWorkoutSet[]>(initialSets);
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const nextIdRef = useRef(0);

  useEffect(() => {
    if (!editing || exercises.length > 0) return;
    const supabase = createClient();
    supabase
      .from("exercises")
      .select("*")
      .order("name")
      .then(({ data, error: loadError }) => {
        if (loadError) {
          setError("Could not load exercises.");
          return;
        }
        setExercises((data ?? []) as Exercise[]);
      });
  }, [editing, exercises.length]);

  const groups = useMemo(() => groupSets(editing ? draftSets : committedSets), [committedSets, draftSets, editing]);

  function updateDraft(rowId: string, patch: Partial<Pick<EditableWorkoutSet, "reps" | "weight" | "rpe">>) {
    setDraftSets((prev) => prev.map((set) => (set.row_id === rowId ? { ...set, ...patch } : set)));
  }

  function deleteDraft(rowId: string) {
    setDraftSets((prev) => normalizeRows(prev.filter((set) => set.row_id !== rowId)));
  }

  function addSetForGroup(group: ExerciseGroup) {
    const previous = group.sets[group.sets.length - 1];
    const newSet: EditableWorkoutSet = {
      row_id: `new-${nextIdRef.current++}`,
      exercise_id: group.exerciseId,
      exercise_name: group.name,
      primary_muscles: group.primaryMuscles,
      secondary_muscles: group.secondaryMuscles,
      set_number: group.sets.length + 1,
      reps: previous?.reps ?? 8,
      weight: previous?.weight ?? 0,
      rpe: previous?.rpe ?? 7,
    };
    setDraftSets((prev) => {
      const insertAfter = findLastExerciseIndex(prev, group.exerciseId);
      if (insertAfter === -1) return normalizeRows([...prev, newSet]);
      return normalizeRows([...prev.slice(0, insertAfter + 1), newSet, ...prev.slice(insertAfter + 1)]);
    });
  }

  function addExercise(exercise: Exercise) {
    const existing = groups.find((group) => group.exerciseId === exercise.id);
    if (existing) {
      addSetForGroup(existing);
      return;
    }

    const newSet: EditableWorkoutSet = {
      row_id: `new-${nextIdRef.current++}`,
      exercise_id: exercise.id,
      exercise_name: exercise.name,
      primary_muscles: exercise.primary_muscles,
      secondary_muscles: exercise.secondary_muscles,
      set_number: 1,
      reps: 8,
      weight: 0,
      rpe: 7,
    };
    setDraftSets((prev) => normalizeRows([...prev, newSet]));
  }

  async function saveChanges() {
    const payload = makePayload(draftSets);
    if (payload.length === 0) {
      setError("A workout needs at least one set.");
      return;
    }

    setSaving(true);
    setError("");
    const result = await updateWorkoutSession(activityId, payload);
    if (result.error) {
      setError(result.error);
      setSaving(false);
      return;
    }

    const normalized = normalizeRows(draftSets);
    setCommittedSets(normalized);
    setDraftSets(normalized);
    setSaving(false);
    setEditing(false);
    refresh();
  }

  if (!editing) {
    return (
      <div>
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 className="text-sm font-medium text-muted uppercase tracking-wide">Exercises</h2>
          <button
            type="button"
            onClick={() => {
              setDraftSets(committedSets);
              setError("");
              setEditing(true);
            }}
            className="flex size-8 items-center justify-center rounded-full border border-white/10 text-white/55 hover:border-white/20 hover:text-white"
            aria-label="Edit workout"
          >
            <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} className="size-4">
              <path d="M12 20h9" />
              <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" />
            </svg>
          </button>
        </div>
        <div className="flex flex-col gap-4">
          {groups.map((group) => {
            const bestE1RM = Math.max(...group.sets.map((set) => computeE1RM(set.weight, set.reps)));
            return (
              <div key={group.exerciseId} className="card p-4">
                <div className="mb-3 flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                  <span className="font-medium">{group.name}</span>
                  {bestE1RM > 0 && (
                    <span className="text-xs text-muted">
                      Best e1RM: {formatWeight(bestE1RM, units)} {unit}
                    </span>
                  )}
                </div>
                <div className="flex flex-col gap-1.5">
                  {group.sets.map((set) => (
                    <div key={set.row_id} className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm sm:grid-cols-3">
                      <span className="text-muted">Set {set.set_number}</span>
                      <span className="text-right sm:text-left">
                        {formatWeight(set.weight, units)} {unit} x {set.reps}
                      </span>
                      <span className="text-muted col-span-2 sm:col-span-1 sm:text-right">
                        RPE {set.rpe} | {formatWeight(computeE1RM(set.weight, set.reps), units)} e1RM
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 className="text-sm font-medium text-muted uppercase tracking-wide">Edit Exercises</h2>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => {
              setDraftSets(committedSets);
              setError("");
              setEditing(false);
            }}
            disabled={saving}
            className="rounded-full border border-border px-3 py-1.5 text-xs text-muted hover:text-white disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={saveChanges}
            disabled={saving}
            className="rounded-full bg-accent px-3 py-1.5 text-xs font-medium text-white disabled:opacity-50"
          >
            {saving ? "Saving..." : "Save"}
          </button>
        </div>
      </div>

      {error && <p className="mb-3 rounded-lg border border-red-400/20 bg-red-500/10 px-3 py-2 text-xs text-red-300">{error}</p>}

      <div className="flex flex-col gap-4">
        {groups.map((group) => (
          <div key={group.exerciseId} className="card p-4">
            <div className="mb-3 flex items-center justify-between gap-3">
              <span className="min-w-0 truncate font-medium">{group.name}</span>
              <button
                type="button"
                onClick={() => addSetForGroup(group)}
                className="shrink-0 rounded-full border border-white/10 px-3 py-1.5 text-xs text-muted hover:text-white"
              >
                Add Set
              </button>
            </div>

            <div className="flex flex-col gap-2">
              {group.sets.map((set) => (
                <EditableSetRow
                  key={set.row_id}
                  set={set}
                  unit={unit}
                  units={units}
                  onChange={(patch) => updateDraft(set.row_id, patch)}
                  onDelete={() => deleteDraft(set.row_id)}
                />
              ))}
            </div>
          </div>
        ))}

        <div className="card p-4">
          <div className="mb-3 text-sm font-medium">Add Exercise</div>
          <ExerciseSearch exercises={exercises} onSelect={addExercise} collapseUntilTyped />
        </div>
      </div>
    </div>
  );
}

function EditableSetRow({
  set,
  unit,
  units,
  onChange,
  onDelete,
}: {
  set: EditableWorkoutSet;
  unit: string;
  units: Units;
  onChange: (patch: Partial<Pick<EditableWorkoutSet, "reps" | "weight" | "rpe">>) => void;
  onDelete: () => void;
}) {
  const [weightStr, setWeightStr] = useState(() => displayNumber(kgToDisplayWeight(set.weight, units)));
  const [repsStr, setRepsStr] = useState(String(set.reps));
  const [rpeStr, setRpeStr] = useState(String(set.rpe));

  function commitWeight(value: string) {
    const displayWeight = Math.max(0, parseFloat(value) || 0);
    onChange({ weight: displayWeightToKg(displayWeight, units) });
  }

  function commitReps(value: string) {
    onChange({ reps: Math.max(1, parseInt(value) || 1) });
  }

  function commitRpe(value: string) {
    onChange({ rpe: Math.min(10, Math.max(1, parseFloat(value) || 1)) });
  }

  return (
    <div className="grid grid-cols-[auto_minmax(0,1fr)_minmax(0,0.75fr)_minmax(0,0.75fr)_auto] items-end gap-2 rounded-lg bg-background/50 p-2">
      <div className="pb-2 text-xs text-muted">Set {set.set_number}</div>
      <label className="flex min-w-0 flex-col gap-1">
        <span className="text-[11px] text-muted">Weight ({unit})</span>
        <input
          type="number"
          inputMode="decimal"
          step="2.5"
          min="0"
          value={weightStr}
          onChange={(event) => {
            setWeightStr(event.target.value);
            commitWeight(event.target.value);
          }}
          onBlur={() => setWeightStr(displayNumber(Math.max(0, parseFloat(weightStr) || 0)))}
          className="w-full min-w-0 rounded border border-border bg-surface px-2 py-1.5 text-center text-sm focus:outline-none focus:border-[var(--accent)]"
        />
      </label>
      <label className="flex min-w-0 flex-col gap-1">
        <span className="text-[11px] text-muted">Reps</span>
        <input
          type="number"
          inputMode="numeric"
          min="1"
          value={repsStr}
          onChange={(event) => {
            setRepsStr(event.target.value);
            commitReps(event.target.value);
          }}
          onBlur={() => setRepsStr(String(Math.max(1, parseInt(repsStr) || 1)))}
          className="w-full min-w-0 rounded border border-border bg-surface px-2 py-1.5 text-center text-sm focus:outline-none focus:border-[var(--accent)]"
        />
      </label>
      <label className="flex min-w-0 flex-col gap-1">
        <span className="text-[11px] text-muted">RPE</span>
        <input
          type="number"
          inputMode="decimal"
          step="0.5"
          min="1"
          max="10"
          value={rpeStr}
          onChange={(event) => {
            setRpeStr(event.target.value);
            commitRpe(event.target.value);
          }}
          onBlur={() => setRpeStr(String(Math.min(10, Math.max(1, parseFloat(rpeStr) || 1))))}
          className="w-full min-w-0 rounded border border-border bg-surface px-2 py-1.5 text-center text-sm focus:outline-none focus:border-[var(--accent)]"
        />
      </label>
      <button
        type="button"
        onClick={onDelete}
        aria-label={`Delete set ${set.set_number}`}
        className="mb-0.5 flex size-8 items-center justify-center rounded-full border border-red-400/20 text-red-300 hover:border-red-300/40 hover:text-red-200"
      >
        <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} className="size-3.5">
          <path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6" />
        </svg>
      </button>
    </div>
  );
}
