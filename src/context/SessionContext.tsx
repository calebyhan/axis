"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import type { DayType, SessionExercise, SessionState, SessionSet } from "@/types";
import { saveDraft, getDraft, clearDraft } from "@/lib/idb/session-draft";

export type DraftSaveStatus = "idle" | "saving" | "saved" | "error";

interface SessionContextValue {
  session: SessionState | null;
  isActive: boolean;
  hasDraft: boolean;
  draft: SessionState | null;
  draftKey: string | null;
  autosaveFailed: boolean;
  draftSaveStatus: DraftSaveStatus;
  startSession: (dayType: DayType | null) => void;
  resumeDraft: () => void;
  discardDraft: () => void;
  addExercise: (exercise: Omit<SessionExercise, "sets">) => void;
  addSet: (exerciseId: string, set: SessionSet) => void;
  endSession: () => SessionState;
  pauseSession: () => Promise<boolean>;
  cancelSession: () => void;
}

const SessionContext = createContext<SessionContextValue | null>(null);

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<SessionState | null>(null);
  const [hasDraft, setHasDraft] = useState(false);
  const [draftData, setDraftData] = useState<SessionState | null>(null);
  const [draftKey, setDraftKey] = useState<string | null>(null);
  const [autosaveFailed, setAutosaveFailed] = useState(false);
  const [draftSaveStatus, setDraftSaveStatus] = useState<DraftSaveStatus>("idle");
  const autosaveRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const autosaveFailCount = useRef(0);
  const sessionRef = useRef<SessionState | null>(null);

  // Check for existing draft on mount
  useEffect(() => {
    getDraft()
      .then((result) => {
        if (result) {
          setDraftData(result.state);
          setDraftKey(result.key);
          setHasDraft(true);
        }
      })
      .catch((err) => {
        console.error("[SessionContext] Failed to load draft from IndexedDB", String(err));
      });
  }, []);

  useEffect(() => {
    sessionRef.current = session;
  }, [session]);

  const persistDraft = useCallback(async (state: SessionState | null = sessionRef.current) => {
    if (!state) return true;
    setDraftSaveStatus("saving");
    try {
      await saveDraft(state);
      setDraftKey(state.startTime.toISOString());
      autosaveFailCount.current = 0;
      setAutosaveFailed(false);
      setDraftSaveStatus("saved");
      return true;
    } catch (err) {
      console.error("[SessionContext] Autosave failed", String(err));
      autosaveFailCount.current += 1;
      if (autosaveFailCount.current >= 2) {
        setAutosaveFailed(true);
      }
      setDraftSaveStatus("error");
      return false;
    }
  }, []);

  // Autosave shortly after edits and periodically while a session is open.
  useEffect(() => {
    if (!session) {
      if (autosaveRef.current) clearInterval(autosaveRef.current);
      return;
    }
    const debounce = setTimeout(() => {
      void persistDraft(session);
    }, 750);
    autosaveRef.current = setInterval(() => {
      void persistDraft();
    }, 30_000);
    return () => {
      clearTimeout(debounce);
      if (autosaveRef.current) clearInterval(autosaveRef.current);
    };
  }, [persistDraft, session]);

  const startSession = useCallback((dayType: DayType | null) => {
    const newSession: SessionState = {
      startTime: new Date(),
      dayType,
      exercises: [],
    };
    setSession(newSession);
    setHasDraft(false);
    setDraftData(null);
    setDraftKey(null);
    autosaveFailCount.current = 0;
    setAutosaveFailed(false);
    setDraftSaveStatus("idle");
  }, []);

  const resumeDraft = useCallback(() => {
    if (draftData) {
      setSession(draftData);
      setHasDraft(false);
      setDraftData(null);
      autosaveFailCount.current = 0;
      setAutosaveFailed(false);
      setDraftSaveStatus("saved");
      // Keep draftKey so SessionFlow can clear it after successful save
    }
  }, [draftData]);

  const discardDraft = useCallback(() => {
    clearDraft(draftKey ?? undefined).catch(console.error);
    setHasDraft(false);
    setDraftData(null);
    setDraftKey(null);
    setDraftSaveStatus("idle");
  }, [draftKey]);

  const addExercise = useCallback((exercise: Omit<SessionExercise, "sets">) => {
    setSession((prev) => {
      if (!prev) return prev;
      if (prev.exercises.some((existing) => existing.exerciseId === exercise.exerciseId)) return prev;
      return { ...prev, exercises: [...prev.exercises, { ...exercise, sets: [] }] };
    });
  }, []);

  const addSet = useCallback(
    (exerciseId: string, set: SessionSet) => {
      setSession((prev) => {
        if (!prev) return prev;
        const updatedExercises = prev.exercises.map((ex) => {
          if (ex.exerciseId !== exerciseId) return ex;
          return { ...ex, sets: [...ex.sets, set] };
        });
        return { ...prev, exercises: updatedExercises };
      });
    },
    []
  );

  // Returns the final session state; caller is responsible for clearDraft after DB write
  const endSession = useCallback((): SessionState => {
    if (!session) throw new Error("No active session");
    const finalSession = session;
    setSession(null);
    setAutosaveFailed(false);
    autosaveFailCount.current = 0;
    setDraftSaveStatus("idle");
    return finalSession;
  }, [session]);

  const pauseSession = useCallback(async () => {
    const saved = await persistDraft();
    if (!saved) return false;
    setSession(null);
    setHasDraft(true);
    setDraftData(sessionRef.current);
    setAutosaveFailed(false);
    autosaveFailCount.current = 0;
    return true;
  }, [persistDraft]);

  const cancelSession = useCallback(() => {
    clearDraft(draftKey ?? undefined).catch(console.error);
    setSession(null);
    setDraftKey(null);
    setAutosaveFailed(false);
    autosaveFailCount.current = 0;
    setDraftSaveStatus("idle");
  }, [draftKey]);

  return (
    <SessionContext.Provider
      value={{
        session,
        isActive: session !== null,
        hasDraft,
        draft: draftData,
        draftKey,
        autosaveFailed,
        draftSaveStatus,
        startSession,
        resumeDraft,
        discardDraft,
        addExercise,
        addSet,
        endSession,
        pauseSession,
        cancelSession,
      }}
    >
      {children}
    </SessionContext.Provider>
  );
}

export function useSession() {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error("useSession must be used within SessionProvider");
  return ctx;
}
