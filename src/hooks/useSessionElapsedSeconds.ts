"use client";

import { useEffect, useState } from "react";
import { getSessionElapsedSeconds } from "@/lib/session-timer";
import type { SessionState } from "@/types";

export function useSessionElapsedSeconds(session: SessionState | null): number {
  const [now, setNow] = useState(() => Date.now());
  const timerStartedAtMs = session?.timerStartedAt?.getTime() ?? null;

  useEffect(() => {
    if (!session || timerStartedAtMs === null) return;

    const interval = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(interval);
  }, [session, timerStartedAtMs]);

  return session ? getSessionElapsedSeconds(session, now) : 0;
}
