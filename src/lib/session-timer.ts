import type { SessionState } from "@/types";

type TimerSession = Pick<SessionState, "elapsedSeconds" | "timerStartedAt">;

function toMs(value: Date | number): number {
  return typeof value === "number" ? value : value.getTime();
}

export function getSessionElapsedSeconds(session: TimerSession, now: Date | number = Date.now()): number {
  const baseElapsed = Number.isFinite(session.elapsedSeconds)
    ? Math.max(0, Math.floor(session.elapsedSeconds))
    : 0;

  if (!session.timerStartedAt) return baseElapsed;

  const startedAtMs = session.timerStartedAt.getTime();
  const nowMs = toMs(now);
  if (!Number.isFinite(startedAtMs) || !Number.isFinite(nowMs)) return baseElapsed;

  return baseElapsed + Math.max(0, Math.floor((nowMs - startedAtMs) / 1000));
}

export function pauseSessionTimer(session: SessionState, now: Date | number = Date.now()): SessionState {
  return {
    ...session,
    elapsedSeconds: getSessionElapsedSeconds(session, now),
    timerStartedAt: null,
  };
}

export function startSessionTimer(session: SessionState, now: Date = new Date()): SessionState {
  if (session.timerStartedAt) return session;
  return {
    ...session,
    timerStartedAt: now,
  };
}

export function formatSessionTimer(totalSeconds: number): string {
  const seconds = Math.max(0, Math.floor(totalSeconds));
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  return `${m}:${String(s).padStart(2, "0")}`;
}

export function formatSessionDuration(totalSeconds: number): string {
  const seconds = Math.max(0, Math.floor(totalSeconds));
  const mins = Math.floor(seconds / 60);
  const hrs = Math.floor(mins / 60);
  const rem = mins % 60;
  return hrs > 0 ? `${hrs}h ${rem}m` : `${mins}m`;
}
