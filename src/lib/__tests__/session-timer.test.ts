import { describe, expect, it } from "vitest";
import { formatSessionTimer, getSessionElapsedSeconds, pauseSessionTimer, startSessionTimer } from "@/lib/session-timer";
import type { SessionState } from "@/types";

function session(partial: Partial<SessionState> = {}): SessionState {
  const startTime = new Date("2026-05-16T12:00:00.000Z");
  return {
    startTime,
    timerStartedAt: startTime,
    elapsedSeconds: 0,
    dayType: null,
    exercises: [],
    ...partial,
  };
}

describe("session timer", () => {
  it("reconstructs elapsed time from a persisted running anchor", () => {
    const state = session({
      elapsedSeconds: 90,
      timerStartedAt: new Date("2026-05-16T12:02:00.000Z"),
    });

    expect(getSessionElapsedSeconds(state, new Date("2026-05-16T12:04:30.000Z"))).toBe(240);
  });

  it("freezes elapsed time when paused", () => {
    const paused = pauseSessionTimer(
      session({ timerStartedAt: new Date("2026-05-16T12:00:00.000Z") }),
      new Date("2026-05-16T12:10:05.000Z")
    );

    expect(paused.timerStartedAt).toBeNull();
    expect(paused.elapsedSeconds).toBe(605);
    expect(getSessionElapsedSeconds(paused, new Date("2026-05-16T13:00:00.000Z"))).toBe(605);
  });

  it("continues from accumulated time when resumed", () => {
    const resumed = startSessionTimer(
      session({ elapsedSeconds: 605, timerStartedAt: null }),
      new Date("2026-05-16T13:00:00.000Z")
    );

    expect(getSessionElapsedSeconds(resumed, new Date("2026-05-16T13:00:30.000Z"))).toBe(635);
  });

  it("formats active timers as clock text", () => {
    expect(formatSessionTimer(65)).toBe("1:05");
    expect(formatSessionTimer(3665)).toBe("1:01:05");
  });
});
