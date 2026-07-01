"use client";

import { useEffect, useState } from "react";
import {
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { CHART_LINE_TOOLTIP_PROPS } from "@/components/stats/chartTheme";
import { useExerciseHistory, type ExerciseSetRecord } from "@/hooks/useExerciseHistory";
import { displayWeightToKg, kgToDisplayWeight, roundDisplayWeight, weightUnit } from "@/lib/units";
import type { Exercise, Units } from "@/types";

const HISTORY_PREVIEW_COUNT = 3;
const HISTORY_EXPANDED_COUNT = 10;

type SetRecord = ExerciseSetRecord;

interface Props {
  exercise: Exercise;
  weightIncrement: number; // active display unit
  units: Units;
  onAcceptSuggestion: (set: { weight: number; reps: number; rpe: number }) => void;
  onDismiss: () => void;
}

export function RecentStatsPanel({ exercise, weightIncrement, units, onAcceptSuggestion, onDismiss }: Props) {
  const { sets, sessions, loading } = useExerciseHistory(exercise.id);
  const [historyExpanded, setHistoryExpanded] = useState(false);

  useEffect(() => {
    if (!loading && sets.length === 0) onDismiss();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, sets.length]);

  const lastSession = sessions[0] ?? [];
  const allTimeMax = sets.reduce<SetRecord | null>((best, s) => (!best || s.e1rm > best.e1rm ? s : best), null);

  const chartData = sessions
    .slice(0, HISTORY_EXPANDED_COUNT)
    .map((sess) => ({
      date: sess[0].session_date,
      e1rm: Math.max(...sess.map((s) => s.e1rm)),
    }))
    .reverse();

  // Suggestion
  const suggestion = computeSuggestion(sessions, displayWeightToKg(weightIncrement, units));

  const unit = weightUnit(units);
  function d(kg: number) {
    return roundDisplayWeight(kgToDisplayWeight(kg, units));
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
    <dialog
      open
      aria-labelledby="recent-stats-title"
      className="fixed inset-0 m-0 p-0 border-0 max-w-none max-h-none w-full h-full bg-background/80 z-50 flex items-end"
    >
      <div className="absolute inset-0" aria-hidden="true" onClick={onDismiss} onKeyDown={(e) => e.key === "Escape" && onDismiss()} />
      <div
        className="relative z-10 w-full card rounded-b-none p-5 pb-nav max-h-[75vh] overflow-y-auto"
      >
        <div className="flex items-center justify-between mb-4">
          <h3 id="recent-stats-title" className="font-medium">{exercise.name}</h3>
          <button type="button" onClick={onDismiss} className="rounded-lg px-3 py-2 text-sm text-muted hover:text-white">Close</button>
        </div>

        {sets.length === 0 ? (
          <p className="text-muted text-sm">No previous sets logged.</p>
        ) : (
          <div className="flex flex-col gap-5">
            {/* Last session */}
            <div>
              <p className="text-xs text-muted mb-2 uppercase tracking-wide">Last Session</p>
              <div className="flex flex-col gap-1">
                {lastSession.map((s, lastSetIdx) => (
                  <div key={`set-${s.set_number}`} className="grid grid-cols-[3.25rem_minmax(0,1fr)_3.75rem] gap-2 text-sm">
                    <span className="text-muted">Set {s.set_number}</span>
                    <span className="min-w-0 truncate">{d(s.weight)} {unit} × {s.reps} @ RPE {s.rpe}</span>
                    <span className="text-right text-muted">{d(s.e1rm).toFixed(1)}</span>
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

            {/* e1RM trend chart */}
            {chartData.length > 1 && (
              <div>
                <p className="text-xs text-muted mb-1 uppercase tracking-wide">e1RM Trend (last {chartData.length} sessions)</p>
                <div className="h-32">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                      <XAxis
                        dataKey="date"
                        tick={{ fill: "#666", fontSize: 10 }}
                        tickLine={false}
                        axisLine={false}
                        tickFormatter={(value) => formatShortDate(value)}
                      />
                      <YAxis hide domain={["dataMin - 2", "dataMax + 2"]} />
                      <Tooltip
                        {...CHART_LINE_TOOLTIP_PROPS}
                        labelFormatter={(value) => formatShortDate(String(value))}
                        formatter={(value: number) => [`${d(value).toFixed(1)} ${unit}`, "e1RM"]}
                      />
                      <Line
                        type="monotone"
                        dataKey="e1rm"
                        stroke="var(--accent, #3B82F6)"
                        strokeWidth={2}
                        dot={{ r: 3, fill: "var(--accent, #3B82F6)", strokeWidth: 0 }}
                        activeDot={{ r: 4 }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}

            {/* Session history */}
            {sessions.length > 1 && (
              <div>
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs text-muted uppercase tracking-wide">Session History</p>
                  {sessions.length > HISTORY_PREVIEW_COUNT && (
                    <button
                      type="button"
                      onClick={() => setHistoryExpanded((v) => !v)}
                      className="text-xs text-accent hover:underline"
                    >
                      {historyExpanded ? "Show less" : `Show all ${sessions.length}`}
                    </button>
                  )}
                </div>
                <div className="flex flex-col gap-3">
                  {sessions
                    .slice(1, historyExpanded ? sessions.length : Math.min(HISTORY_PREVIEW_COUNT, sessions.length))
                    .map((sess, idx) => {
                      const best = sess.reduce((b, s) => (s.e1rm > b.e1rm ? s : b));
                      const olderBest = sessions[idx + 2]
                        ? sessions[idx + 2].reduce((b, s) => (s.e1rm > b.e1rm ? s : b))
                        : null;
                      const delta = olderBest ? best.e1rm - olderBest.e1rm : null;
                      return (
                        <div key={sess[0].session_date} className="border-t border-white/5 pt-3">
                          <div className="flex items-center justify-between text-xs text-muted mb-1">
                            <span>{formatFullDate(sess[0].session_date)}</span>
                            {delta !== null && (
                              <span className={delta > 0 ? "text-green-400" : delta < 0 ? "text-red-400" : "text-muted"}>
                                {delta > 0 ? "+" : ""}
                                {d(delta).toFixed(1)} {unit}
                              </span>
                            )}
                          </div>
                          <div className="flex flex-col gap-0.5">
                            {sess.map((s) => (
                              <div key={`hist-set-${sess[0].session_date}-${s.set_number}`} className="grid grid-cols-[3.25rem_minmax(0,1fr)_3.75rem] gap-2 text-sm">
                                <span className="text-muted">Set {s.set_number}</span>
                                <span className="min-w-0 truncate">{d(s.weight)} {unit} × {s.reps} @ RPE {s.rpe}</span>
                                <span className="text-right text-muted">{d(s.e1rm).toFixed(1)}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                </div>
              </div>
            )}

            {/* Suggestion */}
            {suggestion && (
              <button
                type="button"
                onClick={() => onAcceptSuggestion(suggestion)}
                className="w-full border border-accent rounded-lg py-2.5 text-sm font-medium text-accent hover:bg-accent/10 transition-colors"
              >
                Try {d(suggestion.weight)} {unit} × {suggestion.reps}
              </button>
            )}
          </div>
        )}
      </div>
    </dialog>
  );
}

function formatShortDate(value: string): string {
  return new Date(value).toLocaleDateString(undefined, { month: "numeric", day: "numeric" });
}

function formatFullDate(value: string): string {
  return new Date(value).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

function computeSuggestion(
  sessions: SetRecord[][],
  increment: number
): { weight: number; reps: number; rpe: number } | null {
  if (sessions.length < 3) {
    if (sessions.length === 0) return null;
    const lastMax = sessions[0].reduce((best, s) => (s.e1rm > best.e1rm ? s : best));
    return { weight: lastMax.weight, reps: lastMax.reps, rpe: lastMax.rpe };
  }

  const [s0, , s2] = sessions;
  const e0 = Math.max(...s0.map((s) => s.e1rm));
  const e2 = Math.max(...s2.map((s) => s.e1rm));
  const trend = e0 - e2;

  const lastMax = sessions[0].reduce((best, s) => (s.e1rm > best.e1rm ? s : best));

  if (trend > 2.5) {
    return { weight: lastMax.weight + increment, reps: lastMax.reps, rpe: lastMax.rpe };
  } else if (trend >= 0) {
    return { weight: lastMax.weight, reps: lastMax.reps + 1, rpe: lastMax.rpe };
  } else {
    return { weight: Math.max(0, lastMax.weight - increment), reps: lastMax.reps, rpe: lastMax.rpe };
  }
}
