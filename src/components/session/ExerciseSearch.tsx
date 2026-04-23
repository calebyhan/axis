"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Fuse from "fuse.js";
import type { Exercise } from "@/types";

interface Props {
  exercises: Exercise[];
  onSelect: (exercise: Exercise) => void;
  scoredOrder?: string[];
  autoFocus?: boolean;
  collapseUntilTyped?: boolean;
}

export function ExerciseSearch({ exercises, onSelect, scoredOrder, autoFocus = true, collapseUntilTyped = false }: Props) {
  const [query, setQuery] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (autoFocus) inputRef.current?.focus();
  }, [autoFocus]);

  const fuse = useMemo(
    () =>
      new Fuse(exercises, {
        keys: ["name", "category"],
        threshold: 0.35,
        distance: 80,
      }),
    [exercises]
  );

  const results = useMemo(() => {
    if (!query.trim()) {
      if (scoredOrder && scoredOrder.length > 0) {
        const idMap = new Map(exercises.map((e) => [e.id, e]));
        const ordered = scoredOrder.flatMap((id) => (idMap.has(id) ? [idMap.get(id)!] : []));
        const rest = exercises.filter((e) => !scoredOrder.includes(e.id));
        return [...ordered, ...rest].slice(0, 40);
      }
      return exercises.slice(0, 40);
    }
    return fuse.search(query).map((r) => r.item).slice(0, 20);
  }, [query, fuse, exercises, scoredOrder]);

  return (
    <div className="flex flex-col gap-3">
      <input
        ref={inputRef}
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search exercises…"
        className="w-full bg-background border border-border rounded-lg px-3 py-2.5 text-sm text-white placeholder-[#333] focus:outline-none focus:border-[var(--accent)] transition-colors"
      />

      {(!collapseUntilTyped || query.trim()) && <ul className="flex flex-col gap-1 max-h-[40vh] overflow-y-auto">
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
      </ul>}
    </div>
  );
}
