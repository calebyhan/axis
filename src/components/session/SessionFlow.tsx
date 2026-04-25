"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { clearDraft, saveDraft } from "@/lib/idb/session-draft";
import type { Exercise, MuscleGroup, SessionState, Units } from "@/types";
import { useSession } from "@/context/SessionContext";
import { ExerciseSearch } from "./ExerciseSearch";
import { SetLogger } from "./SetLogger";
import { RecentStatsPanel } from "./RecentStatsPanel";
import { SessionSummary } from "./SessionSummary";
import { MiniHeatmap } from "@/components/heatmap/MiniHeatmap";

type Step = "exercise_search" | "logging";

interface Props {
  onClose: () => void;
  onComplete: () => void;
}

export function SessionFlow({ onClose, onComplete }: Props) {
  const { session, isActive, hasDraft, autosaveFailed, startSession, resumeDraft, discardDraft, addExercise, addSet, endSession, cancelSession } = useSession();

  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [step, setStep] = useState<Step>("exercise_search");
  const [activeExerciseId, setActiveExerciseId] = useState<string | null>(null);
  const [showRecentStats, setShowRecentStats] = useState(false);
  const [finalSession, setFinalSession] = useState<SessionState | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [units, setUnits] = useState<Units>("metric");
  const [todayMuscles, setTodayMuscles] = useState<MuscleGroup[] | undefined>(undefined);

  // Derive activeExercise from live session state — never stale
  const activeExercise = session?.exercises.find((e) => e.exerciseId === activeExerciseId) ?? null;

  // Compute muscle coverage on demand — not stored in session state
  const coverage = useMemo((): Partial<Record<MuscleGroup, number>> => {
    if (!session) return {};
    const c: Partial<Record<MuscleGroup, number>> = {};
    for (const ex of session.exercises) {
      for (const m of ex.primaryMuscles) {
        c[m] = (c[m] ?? 0) + ex.sets.length;
      }
    }
    return c;
  }, [session]);

  // Load exercises, user units, and today's scheduled day type in parallel
  useEffect(() => {
    const supabase = createClient();
    supabase.from("exercises").select("*").then(({ data, error }) => {
      if (error) console.error("[SessionFlow] Failed to load exercises", error.message);
      if (data) setExercises(data as Exercise[]);
    });
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return;
      supabase.from("profiles").select("units").eq("id", user.id).single().then(({ data }) => {
        if (data?.units) setUnits(data.units as Units);
      });
    });
    // ISO day: 0 = Monday … 6 = Sunday
    const isoDay = (new Date().getDay() + 6) % 7;
    supabase
      .from("weekly_schedule")
      .select("day_type:day_types!weekly_schedule_day_type_id_fkey(muscle_focus)")
      .eq("day_of_week", isoDay)
      .eq("active", true)
      .limit(1)
      .single()
      .then(({ data }) => {
        const dt = data?.day_type;
        const muscles = (Array.isArray(dt) ? dt[0] : dt)?.muscle_focus as MuscleGroup[] | null | undefined;
        if (muscles && muscles.length > 0) setTodayMuscles(muscles);
      });
  }, []);

  // Start session if no active session and no draft
  useEffect(() => {
    if (!isActive && !hasDraft) {
      startSession(null);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleExerciseSelect(ex: Exercise) {
    addExercise({
      exerciseId: ex.id,
      name: ex.name,
      primaryMuscles: ex.primary_muscles,
      secondaryMuscles: ex.secondary_muscles,
    });
    setActiveExerciseId(ex.id);
    setShowRecentStats(true);
    setStep("logging");
  }

  async function handleEndSession() {
    if (!session || saving) return;
    setSaveError(null);
    setSaving(true);

    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setSaveError("Not authenticated. Please reload and try again.");
      setSaving(false);
      return;
    }

    // Capture session before nulling it
    const captured = endSession();
    const key = captured.startTime.toISOString();

    const { data: activityData, error: activityError } = await supabase
      .from("activities")
      .insert({
        user_id: user.id,
        type: "workout",
        source: "manual",
        start_time: captured.startTime.toISOString(),
        duration: Math.floor((Date.now() - captured.startTime.getTime()) / 1000),
        day_type_id: captured.dayType?.id ?? null,
      })
      .select("id")
      .single();

    if (activityError || !activityData) {
      console.error("[SessionFlow] Failed to save activity", activityError?.message);
      setSaveError("Failed to save session. Your draft is preserved — reopen to retry.");
      // Restore draft so data isn't lost
      saveDraft(captured).catch(console.error);
      setSaving(false);
      return;
    }

    const sets = captured.exercises.flatMap((ex) =>
      ex.sets.map((s, setIdx) => ({
        activity_id: activityData.id,
        exercise_id: ex.exerciseId,
        set_number: setIdx + 1,
        reps: s.reps,
        weight: s.weight,
        rpe: s.rpe,
      }))
    );

    if (sets.length > 0) {
      const { error: setsError } = await supabase.from("session_sets").insert(sets);
      if (setsError) {
        console.error("[SessionFlow] Failed to insert sets", {
          activityId: activityData.id,
          error: setsError.message,
        });
        setSaveError("Session saved but some sets may be missing. Please check your history.");
      }
    }

    await clearDraft(key).catch(console.error);
    setSaving(false);
    setFinalSession(captured);
  }

  // Show summary overlay once we have a finalSession
  if (finalSession) {
    return (
      <div className="fixed inset-0 bg-background z-50 flex flex-col">
        <div className="flex items-center gap-3 px-4 pb-4 border-b border-border" style={{ paddingTop: "max(1rem, calc(env(safe-area-inset-top, 0px) + 0.75rem))" }}>
          <div className="w-9 h-9 shrink-0" />
          <h2 className="flex-1 font-semibold text-center">Session Complete</h2>
          <div className="w-9 h-9 shrink-0" />
        </div>
        <div className="flex-1 overflow-y-auto px-4 py-6 pb-nav">
          {saveError && (
            <p className="text-yellow-400 text-xs mb-4 px-3 py-2 bg-yellow-400/10 rounded-lg border border-yellow-400/20">
              {saveError}
            </p>
          )}
          <SessionSummary session={finalSession} onClose={onComplete} />
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-background z-50 flex flex-col">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 pb-4 border-b border-border" style={{ paddingTop: "max(1rem, calc(env(safe-area-inset-top, 0px) + 0.75rem))" }}>
        <button
          onClick={() => { cancelSession(); onClose(); }}
          className="shrink-0 w-9 h-9 flex items-center justify-center rounded-full border border-white/10 text-white/55 hover:text-white hover:border-white/20 transition-colors"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-4 h-4">
            <path d="M18 6L6 18M6 6l12 12" />
          </svg>
        </button>
        <div className="flex-1 min-w-0">
          <h2 className="font-semibold">Workout Session</h2>
          {session && (
            <p className="text-xs text-muted mt-0.5">
              {session.exercises.length} exercise{session.exercises.length !== 1 ? "s" : ""}
            </p>
          )}
        </div>
        {session && session.exercises.length > 0 && (
          <button
            onClick={handleEndSession}
            disabled={saving}
            className="shrink-0 px-4 py-1.5 rounded-full bg-accent text-white text-sm font-medium disabled:opacity-50 transition-opacity"
          >
            {saving ? "Saving…" : "End"}
          </button>
        )}
      </div>

      {/* Autosave failure warning */}
      {autosaveFailed && (
        <div className="px-4 py-2 bg-yellow-900/30 border-b border-yellow-700/40 text-xs text-yellow-400">
          Auto-save failed — tap End to save your workout manually.
        </div>
      )}

      {/* Save error */}
      {saveError && (
        <div className="px-4 py-2 bg-red-900/30 border-b border-red-700/40 text-xs text-red-400">
          {saveError}
        </div>
      )}

      {/* Draft prompt */}
      {hasDraft && (
        <div className="px-4 py-4 border-b border-border">
          <p className="text-sm mb-3">Resume previous session?</p>
          <div className="flex gap-2">
            <button
              onClick={resumeDraft}
              className="flex-1 bg-accent py-2 rounded-lg text-sm font-medium"
            >
              Resume
            </button>
            <button
              onClick={discardDraft}
              className="flex-1 border border-border py-2 rounded-lg text-sm text-muted"
            >
              Discard
            </button>
          </div>
        </div>
      )}

      <div className="flex-1 overflow-y-auto px-4 py-4 pb-nav flex flex-col gap-6">
        {/* Active set logger — shown first so it's immediately visible after exercise selection */}
        {step === "logging" && activeExercise && session && (
          <div className="card p-4">
            <SetLogger
              exerciseName={activeExercise.name}
              sets={activeExercise.sets}
              weightIncrement={2.5}
              units={units}
              onAddSet={(s) => addSet(activeExercise.exerciseId, s)}
            />
          </div>
        )}

        {/* Live muscle heatmap — only once at least one set is logged */}
        {session && session.exercises.some((e) => e.sets.length > 0) && (
          <div>
            <p className="text-xs text-muted mb-2 uppercase tracking-wide">Coverage</p>
            <MiniHeatmap coverage={coverage} />
          </div>
        )}

        {/* Exercise search */}
        {step === "exercise_search" && (
          <div>
            <p className="text-xs text-muted mb-2 uppercase tracking-wide">Choose exercise</p>
            <ExerciseSearch
              exercises={exercises}
              onSelect={handleExerciseSelect}
              defaultMuscles={todayMuscles}
            />
          </div>
        )}

        {/* Add another exercise — collapsed until user types */}
        {step === "logging" && (
          <div>
            <p className="text-xs text-muted mb-2 uppercase tracking-wide">Add another exercise</p>
            <ExerciseSearch
              exercises={exercises}
              onSelect={handleExerciseSelect}
              defaultMuscles={todayMuscles}
              autoFocus={false}
              collapseUntilTyped
            />
          </div>
        )}

        {/* Logged exercises — only show exercises that have at least one set */}
        {session && session.exercises.some((e) => e.sets.length > 0) && (
          <div>
            <p className="text-xs text-muted mb-2 uppercase tracking-wide">Logged</p>
            <div className="flex flex-col gap-2">
              {session.exercises.filter((ex) => ex.sets.length > 0).map((ex) => (
                <button
                  key={ex.exerciseId}
                  onClick={() => {
                    setActiveExerciseId(ex.exerciseId);
                    setStep("logging");
                  }}
                  className="card p-3 text-left flex justify-between items-center"
                >
                  <span className="text-sm font-medium">{ex.name}</span>
                  <span className="text-xs text-muted">{ex.sets.length} sets</span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Recent stats panel */}
      {showRecentStats && activeExerciseId && (
        <RecentStatsPanel
          exercise={exercises.find((e) => e.id === activeExerciseId)!}
          weightIncrement={2.5}
          units={units}
          onAcceptSuggestion={() => setShowRecentStats(false)}
          onDismiss={() => setShowRecentStats(false)}
        />
      )}
    </div>
  );
}
