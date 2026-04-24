"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { computeE1RM } from "@/lib/e1rm";
import { weightUnit } from "@/lib/units";
import type { Exercise, Units } from "@/types";

interface SetRecord {
  session_date: string;
  set_number: number;
  reps: number;
  weight: number;
  rpe: number;
  e1rm: number;
}

interface Props {
  exercise: Exercise;
  weightIncrement: number; // kg
  units: Units;
  onAcceptSuggestion: (weight: number, reps: number) => void;
  onDismiss: () => void;
}

export function RecentStatsPanel({ exercise, weightIncrement, units, onAcceptSuggestion, onDismiss }: Props) {
  const [sets, setSets] = useState<SetRecord[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const supabase = createClient();
    supabase
      .from("session_sets")
      .select(`
        set_number, reps, weight, rpe, created_at,
        activities!inner(start_time)
      `)
      .eq("exercise_id", exercise.id)
      .order("created_at", { ascending: false })
      .limit(50)
      .then(({ data, error }) => {
        if (error) {
          console.error("[RecentStatsPanel] Failed to load sets", error.message);
          setLoading(false);
          return;
        }
        const mapped: SetRecord[] = (data ?? []).map((s: Record<string, unknown>) => ({
          session_date: (s.activities as { start_time: string })?.start_time ?? s.created_at as string,
          set_number: s.set_number as number,
          reps: s.reps as number,
          weight: s.weight as number,
          rpe: s.rpe as number,
          e1rm: computeE1RM(s.weight as number, s.reps as number),
        }));
        if (mapped.length === 0) {
          onDismiss();
          return;
        }
        setSets(mapped);
        setLoading(false);
      });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [exercise.id]);

  // Group into sessions
  const sessions = groupBySessions(sets);
  const lastSession = sessions[0] ?? [];
  const allTimeMax = sets.reduce<SetRecord | null>((best, s) => (!best || s.e1rm > best.e1rm ? s : best), null);
  const last5E1RMs = sessions.slice(0, 5).map((sess) =>
    Math.max(...sess.map((s) => s.e1rm))
  );

  // Suggestion
  const suggestion = computeSuggestion(sessions, weightIncrement);

  const unit = weightUnit(units);
  function d(kg: number) {
    const v = units === "imperial" ? kg * 2.20462 : kg;
    return v % 1 === 0 ? Math.round(v) : Math.round(v * 10) / 10;
  }

  if (loading) {
    return (
      <div className="fixed inset-0 bg-background/80 z-50 flex items-end">
        <div className="w-full card rounded-b-none p-6 pb-nav animate-pulse">
          <div className="h-4 bg-border rounded w-1/2 mb-4" />
          <div className="h-4 bg-border rounded w-3/4" />
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-background/80 z-50 flex items-end" onClick={onDismiss}>
      <div
        className="w-full card rounded-b-none p-5 pb-nav max-h-[75vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-medium">{exercise.name}</h3>
          <button onClick={onDismiss} className="text-muted text-sm">Done</button>
        </div>

        {sets.length === 0 ? (
          <p className="text-muted text-sm">No previous sets logged.</p>
        ) : (
          <div className="flex flex-col gap-5">
            {/* Last session */}
            <div>
              <p className="text-xs text-muted mb-2 uppercase tracking-wide">Last Session</p>
              <div className="flex flex-col gap-1">
                {lastSession.map((s, i) => (
                  <div key={i} className="flex justify-between text-sm">
                    <span className="text-muted">Set {s.set_number}</span>
                    <span>{d(s.weight)} {unit} × {s.reps} @ RPE {s.rpe}</span>
                    <span className="text-muted">{d(s.e1rm).toFixed(1)}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* All-time best */}
            {allTimeMax && (
              <div>
                <p className="text-xs text-muted mb-1 uppercase tracking-wide">All-Time Best</p>
                <p className="text-sm">
                  {d(allTimeMax.weight)} {unit} × {allTimeMax.reps} ={" "}
                  <span className="text-white font-medium">{d(allTimeMax.e1rm).toFixed(1)} {unit} e1RM</span>
                </p>
              </div>
            )}

            {/* e1RM trend sparkline (simple text for now) */}
            {last5E1RMs.length > 1 && (
              <div>
                <p className="text-xs text-muted mb-1 uppercase tracking-wide">e1RM Trend (last {last5E1RMs.length})</p>
                <div className="flex gap-2">
                  {[...last5E1RMs].reverse().map((v, i) => (
                    <span key={i} className="text-sm text-white">
                      {d(v).toFixed(0)}
                      {i < last5E1RMs.length - 1 && <span className="text-muted"> →</span>}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Suggestion */}
            {suggestion && (
              <button
                onClick={() => onAcceptSuggestion(suggestion.weight, suggestion.reps)}
                className="w-full border border-accent rounded-lg py-2.5 text-sm font-medium text-accent hover:bg-accent/10 transition-colors"
              >
                Try {d(suggestion.weight)} {unit} × {suggestion.reps}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function groupBySessions(sets: SetRecord[]): SetRecord[][] {
  const groups = new Map<string, SetRecord[]>();
  for (const s of sets) {
    const key = s.session_date.split("T")[0];
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(s);
  }
  return Array.from(groups.values()).sort(
    (a, b) =>
      new Date(b[0].session_date).getTime() - new Date(a[0].session_date).getTime()
  );
}

function computeSuggestion(
  sessions: SetRecord[][],
  increment: number
): { weight: number; reps: number } | null {
  if (sessions.length < 3) {
    if (sessions.length === 0) return null;
    const lastMax = sessions[0].reduce((best, s) => (s.e1rm > best.e1rm ? s : best));
    return { weight: lastMax.weight, reps: lastMax.reps };
  }

  const [s0, , s2] = sessions;
  const e0 = Math.max(...s0.map((s) => s.e1rm));
  const e2 = Math.max(...s2.map((s) => s.e1rm));
  const trend = e0 - e2;

  const lastMax = sessions[0].reduce((best, s) => (s.e1rm > best.e1rm ? s : best));

  if (trend > 2.5) {
    return { weight: lastMax.weight + increment, reps: lastMax.reps };
  } else if (trend >= 0) {
    return { weight: lastMax.weight, reps: lastMax.reps + 1 };
  } else {
    return { weight: Math.max(0, lastMax.weight - increment), reps: lastMax.reps };
  }
}
