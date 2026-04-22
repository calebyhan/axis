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

interface SessionContextValue {
  session: SessionState | null;
  isActive: boolean;
  hasDraft: boolean;
  draftKey: string | null;
  autosaveFailed: boolean;
  startSession: (dayType: DayType | null) => void;
  resumeDraft: () => void;
  discardDraft: () => void;
  addExercise: (exercise: Omit<SessionExercise, "sets">) => void;
  addSet: (exerciseId: string, set: SessionSet) => void;
  endSession: () => SessionState;
  cancelSession: () => void;
}

const SessionContext = createContext<SessionContextValue | null>(null);

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<SessionState | null>(null);
  const [hasDraft, setHasDraft] = useState(false);
  const [draftData, setDraftData] = useState<SessionState | null>(null);
  const [draftKey, setDraftKey] = useState<string | null>(null);
  const [autosaveFailed, setAutosaveFailed] = useState(false);
  const autosaveRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const autosaveFailCount = useRef(0);

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

  // Autosave every 60 seconds
  useEffect(() => {
    if (!session) {
      if (autosaveRef.current) clearInterval(autosaveRef.current);
      return;
    }
    autosaveRef.current = setInterval(() => {
      saveDraft(session).then(() => {
        autosaveFailCount.current = 0;
        setAutosaveFailed(false);
      }).catch((err) => {
        console.error("[SessionContext] Autosave failed", String(err));
        autosaveFailCount.current += 1;
        if (autosaveFailCount.current >= 2) {
          setAutosaveFailed(true);
        }
      });
    }, 60_000);
    return () => {
      if (autosaveRef.current) clearInterval(autosaveRef.current);
    };
  }, [session]);

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
  }, []);

  const resumeDraft = useCallback(() => {
    if (draftData) {
      setSession(draftData);
      setHasDraft(false);
      setDraftData(null);
      // Keep draftKey so SessionFlow can clear it after successful save
    }
  }, [draftData]);

  const discardDraft = useCallback(() => {
    clearDraft(draftKey ?? undefined).catch(console.error);
    setHasDraft(false);
    setDraftData(null);
    setDraftKey(null);
  }, [draftKey]);

  const addExercise = useCallback((exercise: Omit<SessionExercise, "sets">) => {
    setSession((prev) => {
      if (!prev) return prev;
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
    return finalSession;
  }, [session]);

  const cancelSession = useCallback(() => {
    clearDraft(draftKey ?? undefined).catch(console.error);
    setSession(null);
    setDraftKey(null);
    setAutosaveFailed(false);
    autosaveFailCount.current = 0;
  }, [draftKey]);

  return (
    <SessionContext.Provider
      value={{
        session,
        isActive: session !== null,
        hasDraft,
        draftKey,
        autosaveFailed,
        startSession,
        resumeDraft,
        discardDraft,
        addExercise,
        addSet,
        endSession,
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
