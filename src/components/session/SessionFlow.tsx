"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { saveWorkoutSession } from "@/app/(tabs)/log/actions";
import { clearDraft, saveDraft } from "@/lib/idb/session-draft";
import { getTodayPlannedSlots, localDateStr, toISODayOfWeek } from "@/lib/planner";
import type { DayType, Exercise, MuscleGroup, ScheduleOverride, SessionExercise, SessionSet, SessionState, Units, WeeklyScheduleRow } from "@/types";
import { useSession } from "@/context/SessionContext";
import type { DraftSaveStatus } from "@/context/SessionContext";
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

function firstRelation<T>(value: T | T[] | null | undefined): T | undefined {
  if (Array.isArray(value)) return value[0];
  return value ?? undefined;
}

function normalizeScheduleRows(rows: unknown): WeeklyScheduleRow[] {
  if (!Array.isArray(rows)) return [];
  return rows.map((row) => {
    const raw = row as WeeklyScheduleRow & {
      day_type?: DayType | DayType[] | null;
      cardio_day_type?: DayType | DayType[] | null;
    };
    return {
      ...raw,
      day_type: firstRelation(raw.day_type),
      cardio_day_type: firstRelation(raw.cardio_day_type),
    };
  });
}

function SessionHeader({ session, saving, draftSaveStatus, hasLoggedSets, onCancel, onEnd }: {
  session: SessionState | null;
  saving: boolean;
  draftSaveStatus: DraftSaveStatus;
  hasLoggedSets: boolean;
  onCancel: () => void;
  onEnd: () => void;
}) {
  const statusText = {
    idle: "",
    saving: "Saving draft...",
    saved: "Draft saved",
    error: "Draft save failed",
  }[draftSaveStatus];
  const loggedExerciseCount = session?.exercises.filter((exercise) => exercise.sets.length > 0).length ?? 0;

  return (
    <div className="flex items-center gap-3 px-4 pb-4 border-b border-border" style={{ paddingTop: "max(1rem, calc(env(safe-area-inset-top, 0px) + 0.75rem))" }}>
      <button type="button" onClick={onCancel} aria-label="Close workout session" className="shrink-0 size-9 flex items-center justify-center rounded-full border border-white/10 text-white/55 hover:text-white hover:border-white/20 transition-colors">
        <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="size-4"><path d="M18 6L6 18M6 6l12 12" /></svg>
      </button>
      <div className="flex-1 min-w-0">
        <h2 id="workout-session-title" className="font-semibold">Workout Session</h2>
        {session && (
          <p className="text-xs text-muted mt-0.5">
            {loggedExerciseCount} exercise{loggedExerciseCount !== 1 ? "s" : ""}
            {statusText ? ` · ${statusText}` : ""}
          </p>
        )}
      </div>
      {hasLoggedSets && (
        <button type="button" onClick={onEnd} disabled={saving} className="shrink-0 px-4 py-1.5 rounded-full bg-accent text-white text-sm font-medium disabled:opacity-50 transition-opacity">
          {saving ? "Saving..." : "End"}
        </button>
      )}
    </div>
  );
}

function CloseSessionPrompt({ saving, error, onKeepDraft, onDiscard, onReturn }: {
  saving: boolean;
  error: string | null;
  onKeepDraft: () => void;
  onDiscard: () => void;
  onReturn: () => void;
}) {
  return (
    <div className="absolute inset-0 z-10 flex items-end bg-black/60 md:items-center md:justify-center">
      <div className="w-full border-t border-border bg-[#0A0A0A] p-4 md:max-w-sm md:rounded-2xl md:border">
        <h3 className="font-semibold">Close workout?</h3>
        <p className="mt-2 text-sm text-muted">You have logged sets in this session.</p>
        {error && <p className="mt-3 text-xs text-red-400">{error}</p>}
        <div className="mt-4 flex flex-col gap-2">
          <button type="button" onClick={onKeepDraft} disabled={saving} className="w-full rounded-lg bg-accent px-4 py-2 text-sm font-medium disabled:opacity-50">
            {saving ? "Saving..." : "Keep draft"}
          </button>
          <button type="button" onClick={onDiscard} disabled={saving} className="w-full rounded-lg border border-red-400/30 px-4 py-2 text-sm text-red-300 disabled:opacity-50">
            Discard
          </button>
          <button type="button" onClick={onReturn} disabled={saving} className="w-full rounded-lg border border-border px-4 py-2 text-sm text-muted disabled:opacity-50">
            Return to workout
          </button>
        </div>
      </div>
    </div>
  );
}

function DraftPrompt({ onResume, onDiscard }: { onResume: () => void; onDiscard: () => void }) {
  return (
    <div className="p-4 border-b border-border">
      <p className="text-sm mb-3">Resume previous session?</p>
      <div className="flex gap-2">
        <button type="button" onClick={onResume} className="flex-1 bg-accent py-2 rounded-lg text-sm font-medium">Resume</button>
        <button type="button" onClick={onDiscard} className="flex-1 border border-border py-2 rounded-lg text-sm text-muted">Discard</button>
      </div>
    </div>
  );
}

function LoggedExercisesList({ session, onSelect }: {
  session: ReturnType<typeof useSession>["session"];
  onSelect: (exerciseId: string) => void;
}) {
  const logged = session?.exercises.filter((e) => e.sets.length > 0) ?? [];
  if (!logged.length) return null;
  return (
    <div>
      <p className="text-xs text-muted mb-2 uppercase tracking-wide">Logged</p>
      <div className="flex flex-col gap-2">
        {logged.map((ex) => (
          <button key={ex.exerciseId} type="button" onClick={() => onSelect(ex.exerciseId)} className="card p-3 text-left flex justify-between items-center">
            <span className="text-sm font-medium">{ex.name}</span>
            <span className="text-xs text-muted">{ex.sets.length} sets</span>
          </button>
        ))}
      </div>
    </div>
  );
}

export function SessionFlow({ onClose, onComplete }: Props) {
  const { session, isActive, hasDraft, autosaveFailed, draftSaveStatus, startSession, resumeDraft, discardDraft, addExercise, addSet, updateSet, deleteSet, endSession, pauseSession, cancelSession } = useSession();

  const [loadedData, setLoadedData] = useState<LoadedData>({ exercises: [], allDayTypes: [] });
  const [uiState, setUiState] = useState<NavState & { showRecentStats: boolean }>({ step: "exercise_search", activeExerciseId: null, showRecentStats: false });
  const [saveState, setSaveState] = useState<SaveState>({ saving: false, error: null, finalSession: null });
  const [userSetup, setUserSetup] = useState<UserSetup>({ units: "metric", todayMuscles: undefined, todayDayType: undefined });
  const [suggestedSets, setSuggestedSets] = useState<Record<string, SessionSet | undefined>>({});
  const [closePrompt, setClosePrompt] = useState<{ open: boolean; saving: boolean; error: string | null }>({ open: false, saving: false, error: null });

  const { exercises, allDayTypes } = loadedData;
  const { step, activeExerciseId, showRecentStats } = uiState;
  const { saving, error: saveError, finalSession } = saveState;
  const { units, todayMuscles, todayDayType } = userSetup;

  const activeExerciseRecord = activeExerciseId ? exercises.find((e) => e.id === activeExerciseId) ?? null : null;
  const sessionExercise = session?.exercises.find((e) => e.exerciseId === activeExerciseId) ?? null;
  const activeExercise: SessionExercise | null = sessionExercise ?? (activeExerciseRecord
    ? {
        exerciseId: activeExerciseRecord.id,
        name: activeExerciseRecord.name,
        primaryMuscles: activeExerciseRecord.primary_muscles,
        secondaryMuscles: activeExerciseRecord.secondary_muscles,
        sets: [],
      }
    : null);
  const activeSuggestedSet = activeExerciseId ? suggestedSets[activeExerciseId] ?? null : null;
  const hasLoggedSets = (session?.exercises.some((ex) => ex.sets.length > 0) ?? false);

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
    const today = new Date();
    const isoDay = toISODayOfWeek(today);
    const todayStr = localDateStr(today);

    Promise.all([
      supabase.from("exercises").select("*"),
      supabase.from("day_types").select("id, name, category, muscle_focus").eq("category", "strength"),
      supabase.auth.getUser().then(({ data: { user } }) => {
        if (!user) return null;
        return supabase.from("profiles").select("units").eq("id", user.id).single();
      }),
      supabase
        .from("weekly_schedule")
        .select("id, day_of_week, day_type_id, cardio_day_type_id, active, day_type:day_types!weekly_schedule_day_type_id_fkey(id, name, category, muscle_focus), cardio_day_type:day_types!weekly_schedule_cardio_day_type_id_fkey(id, name, category, muscle_focus)")
        .eq("day_of_week", isoDay)
        .eq("active", true),
      supabase
        .from("schedule_overrides")
        .select("*")
        .eq("date", todayStr),
    ]).then(([exercisesRes, dayTypesRes, profileRes, scheduleRes, overridesRes]) => {
      const dayTypes = (dayTypesRes.data ?? []) as DayType[];
      const dayTypeMap = new Map(dayTypes.map((dayType) => [dayType.id, dayType]));
      const todaySlots = getTodayPlannedSlots(
        normalizeScheduleRows(scheduleRes.data),
        (overridesRes.data ?? []) as unknown as ScheduleOverride[],
        dayTypeMap,
        today
      );
      const workoutSlot = todaySlots.find((slot) => slot.kind === "workout");
      const dt = workoutSlot?.effective?.id === "__workout_rest__" ? null : workoutSlot?.effective;
      setLoadedData({
        exercises: (exercisesRes.data ?? []) as Exercise[],
        allDayTypes: dayTypes,
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
    setUiState((prev) => ({ ...prev, step: "logging", activeExerciseId: ex.id, showRecentStats: true }));
  }

  function handleAcceptSuggestion(set: SessionSet) {
    if (!activeExerciseId) return;
    setSuggestedSets((prev) => ({ ...prev, [activeExerciseId]: set }));
    setUiState((prev) => ({ ...prev, showRecentStats: false }));
  }

  function handleAddSet(exerciseId: string, set: SessionSet) {
    const existing = session?.exercises.some((ex) => ex.exerciseId === exerciseId) ?? false;
    if (!existing) {
      const exercise = exercises.find((ex) => ex.id === exerciseId);
      if (!exercise) return;
      addExercise({
        exerciseId: exercise.id,
        name: exercise.name,
        primaryMuscles: exercise.primary_muscles,
        secondaryMuscles: exercise.secondary_muscles,
      });
    }
    addSet(exerciseId, set);
    setSuggestedSets((prev) => {
      if (!prev[exerciseId]) return prev;
      const next = { ...prev };
      delete next[exerciseId];
      return next;
    });
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

    const captured = session;
    const key = captured.startTime.toISOString();
    const loggedExercises = captured.exercises.filter((ex) => ex.sets.length > 0);
    const workedMuscles = loggedExercises.flatMap((ex) => ex.primaryMuscles);
    const inferredDayType = inferDayType(workedMuscles, captured.dayType ?? null);

    const sets = loggedExercises.flatMap((ex) =>
      ex.sets.map((s, setIdx) => ({
        exercise_id: ex.exerciseId,
        set_number: setIdx + 1,
        reps: s.reps,
        weight: s.weight,
        rpe: s.rpe,
      }))
    );

    const result = await saveWorkoutSession({
      start_time: captured.startTime.toISOString(),
      duration: Math.floor((Date.now() - captured.startTime.getTime()) / 1000),
      day_type_id: inferredDayType?.id ?? null,
      sets,
    });

    if (result.error) {
      saveDraft(captured).catch(console.error);
      setSaveState((prev) => ({ ...prev, saving: false, error: result.error }));
      return;
    }

    endSession();
    await clearDraft(key).catch(console.error);
    setSaveState((prev) => ({ ...prev, saving: false, finalSession: captured }));
  }

  async function handleKeepDraftAndClose() {
    setClosePrompt({ open: true, saving: true, error: null });
    const saved = await pauseSession();
    if (!saved) {
      setClosePrompt({ open: true, saving: false, error: "Failed to save this draft locally. Return to the workout and try again." });
      return;
    }
    onClose();
  }

  function handleCancelRequest() {
    if (hasLoggedSets) {
      setClosePrompt({ open: true, saving: false, error: null });
      return;
    }
    cancelSession();
    onClose();
  }

  if (finalSession) {
    return (
      <div className="fixed inset-0 z-50 flex flex-col bg-background md:bg-black/60 md:items-center md:justify-center md:p-6" role="dialog" aria-modal="true" aria-labelledby="session-complete-title">
        <div className="flex flex-col w-full h-full md:h-auto md:max-h-[90vh] md:w-full md:max-w-2xl md:rounded-3xl md:bg-[#0A0A0A] md:border md:border-[#1F1F1F] md:overflow-hidden">
          <div className="flex items-center gap-3 px-4 pb-4 border-b border-border" style={{ paddingTop: "max(1rem, calc(env(safe-area-inset-top, 0px) + 0.75rem))" }}>
            <div className="size-9 shrink-0" />
            <h2 id="session-complete-title" className="flex-1 font-semibold text-center">Session Complete</h2>
            <div className="size-9 shrink-0" />
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
    <div className="fixed inset-0 z-50 flex flex-col bg-background md:bg-black/60 md:items-center md:justify-center md:p-6" role="dialog" aria-modal="true" aria-labelledby="workout-session-title">
    <div className="flex flex-col w-full h-full md:h-auto md:max-h-[90vh] md:w-full md:max-w-2xl md:rounded-3xl md:bg-[#0A0A0A] md:border md:border-[#1F1F1F] md:overflow-hidden">
      <SessionHeader session={session} saving={saving} draftSaveStatus={draftSaveStatus} hasLoggedSets={hasLoggedSets} onCancel={handleCancelRequest} onEnd={handleEndSession} />

      {autosaveFailed && <div className="px-4 py-2 bg-yellow-900/30 border-b border-yellow-700/40 text-xs text-yellow-400">Auto-save failed - tap End to save your workout manually.</div>}
      {saveError && <div className="px-4 py-2 bg-red-900/30 border-b border-red-700/40 text-xs text-red-400">{saveError}</div>}
      {hasDraft && <DraftPrompt onResume={resumeDraft} onDiscard={discardDraft} />}

      <div className="flex-1 overflow-y-auto p-4 pb-nav flex flex-col gap-6">
        {step === "logging" && activeExercise && session && (
          <div className="card p-4">
            <SetLogger
              key={[
                activeExercise.exerciseId,
                units,
                activeSuggestedSet?.weight ?? "manual",
                activeSuggestedSet?.reps ?? "manual",
                activeSuggestedSet?.rpe ?? "manual",
              ].join(":")}
              exerciseName={activeExercise.name}
              sets={activeExercise.sets}
              suggestedSet={activeSuggestedSet}
              weightIncrement={2.5}
              units={units}
              onAddSet={(s) => handleAddSet(activeExercise.exerciseId, s)}
              onUpdateSet={(setIndex, set) => updateSet(activeExercise.exerciseId, setIndex, set)}
              onDeleteSet={(setIndex) => deleteSet(activeExercise.exerciseId, setIndex)}
            />
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

      {showRecentStats && activeExerciseRecord && (
        <RecentStatsPanel
          exercise={activeExerciseRecord}
          weightIncrement={2.5}
          units={units}
          onAcceptSuggestion={handleAcceptSuggestion}
          onDismiss={() => setUiState((prev) => ({ ...prev, showRecentStats: false }))}
        />
      )}
      {closePrompt.open && (
        <CloseSessionPrompt
          saving={closePrompt.saving}
          error={closePrompt.error}
          onKeepDraft={handleKeepDraftAndClose}
          onDiscard={() => { cancelSession(); onClose(); }}
          onReturn={() => setClosePrompt({ open: false, saving: false, error: null })}
        />
      )}
    </div>
    </div>
  );
}
