"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { computeE1RM } from "@/lib/e1rm";

export interface ExerciseSetRecord {
  session_date: string;
  set_number: number;
  reps: number;
  weight: number;
  rpe: number;
  e1rm: number;
}

interface ExerciseHistoryState {
  sets: ExerciseSetRecord[];
  sessions: ExerciseSetRecord[][];
  loading: boolean;
}

export function groupBySessions(sets: ExerciseSetRecord[]): ExerciseSetRecord[][] {
  const groups = new Map<string, ExerciseSetRecord[]>();
  for (const s of sets) {
    const key = localDateKey(s.session_date);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(s);
  }
  return Array.from(groups.values()).sort(
    (a, b) => new Date(b[0].session_date).getTime() - new Date(a[0].session_date).getTime()
  );
}

export function localDateKey(value: string): string {
  const date = new Date(value);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

interface LoadedHistory {
  exerciseId: string;
  sets: ExerciseSetRecord[];
  sessions: ExerciseSetRecord[][];
}

export function useExerciseHistory(exerciseId: string | null): ExerciseHistoryState {
  const [loaded, setLoaded] = useState<LoadedHistory | null>(null);

  useEffect(() => {
    if (!exerciseId) return;
    let cancelled = false;
    const supabase = createClient();
    supabase
      .from("session_sets")
      .select(`
        set_number, reps, weight, rpe, created_at,
        activities!inner(start_time)
      `)
      .eq("exercise_id", exerciseId)
      .order("created_at", { ascending: false })
      .limit(150)
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error) {
          console.error("[useExerciseHistory] Failed to load sets", error.message);
          setLoaded({ exerciseId, sets: [], sessions: [] });
          return;
        }
        const mapped: ExerciseSetRecord[] = (data ?? []).map((s: Record<string, unknown>) => ({
          session_date: (s.activities as { start_time: string })?.start_time ?? (s.created_at as string),
          set_number: s.set_number as number,
          reps: s.reps as number,
          weight: s.weight as number,
          rpe: s.rpe as number,
          e1rm: computeE1RM(s.weight as number, s.reps as number),
        }));
        setLoaded({ exerciseId, sets: mapped, sessions: groupBySessions(mapped) });
      });
    return () => {
      cancelled = true;
    };
  }, [exerciseId]);

  if (!exerciseId) return { sets: [], sessions: [], loading: false };
  if (loaded?.exerciseId !== exerciseId) return { sets: [], sessions: [], loading: true };
  return { sets: loaded.sets, sessions: loaded.sessions, loading: false };
}
