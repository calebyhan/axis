export interface DailyLoad {
  date: string; // ISO date yyyy-MM-dd
  runTL: number; // suffer_score or 0
  strengthTL: number; // computed from session_sets
}

export interface TrainingLoadPoint {
  date: string;
  atl: number;
  ctl: number;
  tsb: number;
  dailyTL: number;
}

export function computeATLCTLTSB(
  loads: DailyLoad[],
  startATL = 0,
  startCTL = 0
): TrainingLoadPoint[] {
  const sorted = [...loads].sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
  );

  let atl = startATL;
  let ctl = startCTL;
  const result: TrainingLoadPoint[] = [];

  for (const day of sorted) {
    const tl = day.runTL + day.strengthTL;
    atl = atl * (1 - 1 / 7) + tl * (1 / 7);
    ctl = ctl * (1 - 1 / 42) + tl * (1 / 42);
    result.push({
      date: day.date,
      atl: Math.round(atl * 10) / 10,
      ctl: Math.round(ctl * 10) / 10,
      tsb: Math.round((ctl - atl) * 10) / 10,
      dailyTL: tl,
    });
  }

  return result;
}

// Normalize strength volume to 0-200 scale
// SUM(sets × reps × weight × rpe) / 1000, capped at 200
export function normalizeStrengthTL(rawLoad: number): number {
  return Math.min(200, rawLoad / 1000);
}
