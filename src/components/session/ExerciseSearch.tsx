"use client";

import { useMemo, useRef, useState } from "react";
import Fuse from "fuse.js";
import type { Exercise, MuscleGroup } from "@/types";

interface Props {
  exercises: Exercise[];
  onSelect: (exercise: Exercise) => void;
  scoredOrder?: string[];
  defaultMuscles?: MuscleGroup[];
  collapseUntilTyped?: boolean;
}

function muscleLabel(m: MuscleGroup): string {
  return m.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export function ExerciseSearch({
  exercises,
  onSelect,
  scoredOrder,
  defaultMuscles,
  collapseUntilTyped = false,
}: Props) {
  const [query, setQuery] = useState("");
  const [selectedMuscles, setSelectedMuscles] = useState<MuscleGroup[] | "all" | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const activeMuscs = useMemo(() => {
    if (selectedMuscles === "all") return null;
    if (selectedMuscles) return selectedMuscles;
    return defaultMuscles && defaultMuscles.length > 0 ? defaultMuscles : null;
  }, [defaultMuscles, selectedMuscles]);

  const filtered = useMemo(() => {
    if (!activeMuscs) return exercises;
    return exercises.filter((e) =>
      e.primary_muscles.some((m) => activeMuscs.includes(m)) ||
      e.secondary_muscles.some((m) => activeMuscs.includes(m))
    );
  }, [exercises, activeMuscs]);

  const results = useMemo(() => {
    const pool = filtered;
    if (!query.trim()) {
      if (scoredOrder && scoredOrder.length > 0) {
        const idMap = new Map(pool.map((e) => [e.id, e]));
        const ordered = scoredOrder.flatMap((id) => (idMap.has(id) ? [idMap.get(id)!] : []));
        const rest = pool.filter((e) => !scoredOrder.includes(e.id));
        return [...ordered, ...rest].slice(0, 40);
      }
      return pool.slice(0, 40);
    }
    return new Fuse(pool, {
      keys: ["name", "category"],
      threshold: 0.35,
      distance: 80,
    })
      .search(query)
      .map((r) => r.item)
      .slice(0, 20);
  }, [query, filtered, scoredOrder]);

  function toggleMuscle(m: MuscleGroup) {
    setSelectedMuscles((prev) => {
      const current =
        prev === "all"
          ? null
          : prev ?? (defaultMuscles && defaultMuscles.length > 0 ? defaultMuscles : null);

      if (!current) return [m];
      if (current.includes(m)) {
        const next = current.filter((x) => x !== m);
        return next.length === 0 ? "all" : next;
      }
      return [...current, m];
    });
  }

  // Chips: only show when there's a default set to use as a starting point
  const chipMuscs = defaultMuscles && defaultMuscles.length > 0 ? defaultMuscles : null;

  return (
    <div className="flex flex-col gap-3">
      {chipMuscs && (
        <div className="flex flex-wrap gap-1.5">
          <button
            onClick={() => setSelectedMuscles("all")}
            className={`px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${
              activeMuscs === null
                ? "bg-accent text-white"
                : "bg-border text-muted hover:text-white"
            }`}
          >
            All
          </button>
          {chipMuscs.map((m) => {
            const on = activeMuscs?.includes(m) ?? false;
            return (
              <button
                key={m}
                onClick={() => toggleMuscle(m)}
                className={`px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${
                  on ? "bg-accent text-white" : "bg-border text-muted hover:text-white"
                }`}
              >
                {muscleLabel(m)}
              </button>
            );
          })}
        </div>
      )}

      <input
        ref={inputRef}
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search exercises…"
        className="w-full bg-background border border-border rounded-lg px-3 py-2.5 text-sm text-white placeholder-[#333] focus:outline-none focus:border-[var(--accent)] transition-colors"
      />

      {(!collapseUntilTyped || query.trim()) && (
        <ul className="flex flex-col gap-1 max-h-[40vh] overflow-y-auto">
          {results.map((ex) => (
            <li key={ex.id}>
              <button
                onClick={() => onSelect(ex)}
                className="w-full text-left px-3 py-3 rounded-lg hover:bg-surface border border-transparent hover:border-border transition-all"
              >
                <div className="text-sm font-medium">{ex.name}</div>
                <div className="text-xs text-muted mt-0.5 capitalize">
                  {ex.equipment} · {ex.movement_pattern.replace(/_/g, " ")}
                </div>
              </button>
            </li>
          ))}
          {results.length === 0 && (
            <li className="text-muted text-sm text-center py-6">No exercises found</li>
          )}
        </ul>
      )}
    </div>
  );
}
