"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { clearDraft, saveDraft } from "@/lib/idb/session-draft";
import type { DayType, Exercise, MuscleGroup, SessionState, Units } from "@/types";
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

interface LoadedData { exercises: Exercise[]; allDayTypes: DayType[] }
interface NavState { step: Step; activeExerciseId: string | null }
interface SaveState { saving: boolean; error: string | null; finalSession: SessionState | null }
interface UserSetup { units: Units; todayMuscles: MuscleGroup[] | undefined; todayDayType: DayType | null | undefined }

function SessionHeader({ session, saving, onCancel, onEnd }: {
  session: ReturnType<typeof useSession>["session"];
  saving: boolean;
  onCancel: () => void;
  onEnd: () => void;
}) {
  return (
    <div className="flex items-center gap-3 px-4 pb-4 border-b border-border" style={{ paddingTop: "max(1rem, calc(env(safe-area-inset-top, 0px) + 0.75rem))" }}>
      <button onClick={onCancel} className="shrink-0 w-9 h-9 flex items-center justify-center rounded-full border border-white/10 text-white/55 hover:text-white hover:border-white/20 transition-colors">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-4 h-4"><path d="M18 6L6 18M6 6l12 12" /></svg>
      </button>
      <div className="flex-1 min-w-0">
        <h2 className="font-semibold">Workout Session</h2>
        {session && <p className="text-xs text-muted mt-0.5">{session.exercises.length} exercise{session.exercises.length !== 1 ? "s" : ""}</p>}
      </div>
      {session && session.exercises.length > 0 && (
        <button onClick={onEnd} disabled={saving} className="shrink-0 px-4 py-1.5 rounded-full bg-accent text-white text-sm font-medium disabled:opacity-50 transition-opacity">
          {saving ? "Saving..." : "End"}
        </button>
      )}
    </div>
  );
}

function DraftPrompt({ onResume, onDiscard }: { onResume: () => void; onDiscard: () => void }) {
  return (
    <div className="px-4 py-4 border-b border-border">
      <p className="text-sm mb-3">Resume previous session?</p>
      <div className="flex gap-2">
        <button onClick={onResume} className="flex-1 bg-accent py-2 rounded-lg text-sm font-medium">Resume</button>
        <button onClick={onDiscard} className="flex-1 border border-border py-2 rounded-lg text-sm text-muted">Discard</button>
      </div>
    </div>
  );
}

function LoggedExercisesList({ session, onSelect }: {
  session: ReturnType<typeof useSession>["session"];
  onSelect: (exerciseId: string) => void;
}) {
  if (!session || !session.exercises.some((e) => e.sets.length > 0)) return null;
  return (
    <div>
      <p className="text-xs text-muted mb-2 uppercase tracking-wide">Logged</p>
      <div className="flex flex-col gap-2">
        {session.exercises.filter((ex) => ex.sets.length > 0).map((ex) => (
          <button key={ex.exerciseId} onClick={() => onSelect(ex.exerciseId)} className="card p-3 text-left flex justify-between items-center">
            <span className="text-sm font-medium">{ex.name}</span>
            <span className="text-xs text-muted">{ex.sets.length} sets</span>
          </button>
        ))}
      </div>
    </div>
  );
}

export function SessionFlow({ onClose, onComplete }: Props) {
  const { session, isActive, hasDraft, autosaveFailed, startSession, resumeDraft, discardDraft, addExercise, addSet, endSession, cancelSession } = useSession();

  const [loadedData, setLoadedData] = useState<LoadedData>({ exercises: [], allDayTypes: [] });
  const [uiState, setUiState] = useState<NavState & { showRecentStats: boolean }>({ step: "exercise_search", activeExerciseId: null, showRecentStats: false });
  const [saveState, setSaveState] = useState<SaveState>({ saving: false, error: null, finalSession: null });
  const [userSetup, setUserSetup] = useState<UserSetup>({ units: "metric", todayMuscles: undefined, todayDayType: undefined });

  const { exercises, allDayTypes } = loadedData;
  const { step, activeExerciseId, showRecentStats } = uiState;
  const { saving, error: saveError, finalSession } = saveState;
  const { units, todayMuscles, todayDayType } = userSetup;

  const activeExercise = session?.exercises.find((e) => e.exerciseId === activeExerciseId) ?? null;

  const coverage = useMemo((): Partial<Record<MuscleGroup, number>> => {
    if (!session) return {};
    const c: Partial<Record<MuscleGroup, number>> = {};
    for (const ex of session.exercises) {
      for (const m of ex.primaryMuscles) c[m] = (c[m] ?? 0) + ex.sets.length;
    }
    return c;
  }, [session]);

  useEffect(() => {
    const supabase = createClient();
    const isoDay = (new Date().getDay() + 6) % 7;

    Promise.all([
      supabase.from("exercises").select("*"),
      supabase.from("day_types").select("id, name, category, muscle_focus").eq("category", "strength"),
      supabase.auth.getUser().then(({ data: { user } }) => {
        if (!user) return null;
        return supabase.from("profiles").select("units").eq("id", user.id).single();
      }),
      supabase.from("weekly_schedule")
        .select("day_type:day_types!weekly_schedule_day_type_id_fkey(id, name, category, muscle_focus)")
        .eq("day_of_week", isoDay).eq("active", true).limit(1).single(),
    ]).then(([exercisesRes, dayTypesRes, profileRes, scheduleRes]) => {
      const dt = (Array.isArray(scheduleRes.data?.day_type) ? scheduleRes.data.day_type[0] : scheduleRes.data?.day_type) as DayType | null | undefined;
      setLoadedData({
        exercises: (exercisesRes.data ?? []) as Exercise[],
        allDayTypes: (dayTypesRes.data ?? []) as DayType[],
      });
      setUserSetup({
        units: ((profileRes?.data?.units ?? "metric") as Units),
        todayMuscles: dt?.muscle_focus && dt.muscle_focus.length > 0 ? dt.muscle_focus : undefined,
        todayDayType: dt ?? null,
      });
    });
  }, []);

  useEffect(() => {
    if (todayDayType === undefined) return;
    if (!isActive && !hasDraft) startSession(todayDayType);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [todayDayType]);

  function handleExerciseSelect(ex: Exercise) {
    addExercise({ exerciseId: ex.id, name: ex.name, primaryMuscles: ex.primary_muscles, secondaryMuscles: ex.secondary_muscles });
    setUiState((prev) => ({ ...prev, step: "logging", activeExerciseId: ex.id, showRecentStats: true }));
  }

  function inferDayType(workedMuscles: MuscleGroup[], scheduled: DayType | null): DayType | null {
    if (allDayTypes.length === 0) return scheduled;
    const worked = new Set(workedMuscles);
    let best: DayType | null = null;
    let bestScore = 0;
    for (const dt of allDayTypes) {
      const focus = dt.muscle_focus;
      if (!focus || focus.length === 0) continue;
      const overlap = focus.filter((m) => worked.has(m)).length;
      const score = overlap / focus.length;
      if (score > bestScore) { bestScore = score; best = dt; }
    }
    return bestScore >= 0.3 ? best : scheduled;
  }

  async function handleEndSession() {
    if (!session || saving) return;
    setSaveState((prev) => ({ ...prev, saving: true, error: null }));

    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setSaveState((prev) => ({ ...prev, saving: false, error: "Not authenticated. Please reload and try again." }));
      return;
    }

    const captured = endSession();
    const key = captured.startTime.toISOString();
    const workedMuscles = captured.exercises.flatMap((ex) => ex.primaryMuscles);
    const inferredDayType = inferDayType(workedMuscles, captured.dayType ?? null);

    const { data: activityData, error: activityError } = await supabase
      .from("activities")
      .insert({ user_id: user.id, type: "workout", source: "manual", start_time: captured.startTime.toISOString(), duration: Math.floor((Date.now() - captured.startTime.getTime()) / 1000), day_type_id: inferredDayType?.id ?? null })
      .select("id").single();

    if (activityError || !activityData) {
      console.error("[SessionFlow] Failed to save activity", activityError?.message);
      saveDraft(captured).catch(console.error);
      setSaveState((prev) => ({ ...prev, saving: false, error: "Failed to save session. Your draft is preserved - reopen to retry." }));
      return;
    }

    const sets = captured.exercises.flatMap((ex) =>
      ex.sets.map((s, setIdx) => ({ activity_id: activityData.id, exercise_id: ex.exerciseId, set_number: setIdx + 1, reps: s.reps, weight: s.weight, rpe: s.rpe }))
    );

    if (sets.length > 0) {
      const { error: setsError } = await supabase.from("session_sets").insert(sets);
      if (setsError) {
        console.error("[SessionFlow] Failed to insert sets", { activityId: activityData.id, error: setsError.message });
        setSaveState((prev) => ({ ...prev, error: "Session saved but some sets may be missing. Please check your history." }));
      }
    }

    await clearDraft(key).catch(console.error);
    setSaveState((prev) => ({ ...prev, saving: false, finalSession: captured }));
  }

  if (finalSession) {
    return (
      <div className="fixed inset-0 z-50 flex flex-col bg-background md:bg-black/60 md:items-center md:justify-center md:p-6">
        <div className="flex flex-col w-full h-full md:h-auto md:max-h-[90vh] md:w-full md:max-w-2xl md:rounded-3xl md:bg-[#0A0A0A] md:border md:border-[#1F1F1F] md:overflow-hidden">
          <div className="flex items-center gap-3 px-4 pb-4 border-b border-border" style={{ paddingTop: "max(1rem, calc(env(safe-area-inset-top, 0px) + 0.75rem))" }}>
            <div className="w-9 h-9 shrink-0" />
            <h2 className="flex-1 font-semibold text-center">Session Complete</h2>
            <div className="w-9 h-9 shrink-0" />
          </div>
          <div className="flex-1 overflow-y-auto px-4 py-6 pb-nav md:pb-6">
            {saveError && <p className="text-yellow-400 text-xs mb-4 px-3 py-2 bg-yellow-400/10 rounded-lg border border-yellow-400/20">{saveError}</p>}
            <SessionSummary session={finalSession} onClose={onComplete} units={units} />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-background md:bg-black/60 md:items-center md:justify-center md:p-6">
    <div className="flex flex-col w-full h-full md:h-auto md:max-h-[90vh] md:w-full md:max-w-2xl md:rounded-3xl md:bg-[#0A0A0A] md:border md:border-[#1F1F1F] md:overflow-hidden">
      <SessionHeader session={session} saving={saving} onCancel={() => { cancelSession(); onClose(); }} onEnd={handleEndSession} />

      {autosaveFailed && <div className="px-4 py-2 bg-yellow-900/30 border-b border-yellow-700/40 text-xs text-yellow-400">Auto-save failed - tap End to save your workout manually.</div>}
      {saveError && <div className="px-4 py-2 bg-red-900/30 border-b border-red-700/40 text-xs text-red-400">{saveError}</div>}
      {hasDraft && <DraftPrompt onResume={resumeDraft} onDiscard={discardDraft} />}

      <div className="flex-1 overflow-y-auto px-4 py-4 pb-nav flex flex-col gap-6">
        {step === "logging" && activeExercise && session && (
          <div className="card p-4">
            <SetLogger exerciseName={activeExercise.name} sets={activeExercise.sets} weightIncrement={2.5} units={units} onAddSet={(s) => addSet(activeExercise.exerciseId, s)} />
          </div>
        )}

        {session && session.exercises.some((e) => e.sets.length > 0) && (
          <div>
            <p className="text-xs text-muted mb-2 uppercase tracking-wide">Coverage</p>
            <MiniHeatmap coverage={coverage} />
          </div>
        )}

        {step === "exercise_search" && (
          <div>
            <p className="text-xs text-muted mb-2 uppercase tracking-wide">Choose exercise</p>
            <ExerciseSearch exercises={exercises} onSelect={handleExerciseSelect} defaultMuscles={todayMuscles} />
          </div>
        )}

        {step === "logging" && (
          <div>
            <p className="text-xs text-muted mb-2 uppercase tracking-wide">Add another exercise</p>
            <ExerciseSearch exercises={exercises} onSelect={handleExerciseSelect} defaultMuscles={todayMuscles} collapseUntilTyped />
          </div>
        )}

        <LoggedExercisesList session={session} onSelect={(exerciseId) => setUiState((prev) => ({ ...prev, step: "logging", activeExerciseId: exerciseId }))} />
      </div>

      {showRecentStats && activeExerciseId && (
        <RecentStatsPanel
          exercise={exercises.find((e) => e.id === activeExerciseId)!}
          weightIncrement={2.5}
          units={units}
          onAcceptSuggestion={() => setUiState((prev) => ({ ...prev, showRecentStats: false }))}
          onDismiss={() => setUiState((prev) => ({ ...prev, showRecentStats: false }))}
        />
      )}
    </div>
    </div>
  );
}
