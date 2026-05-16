import { addDateKeyDays, zonedDateKey } from "@/lib/time-zone";

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

export interface TrainingLoadActivityInput {
  start_time: string;
  suffer_score: number | null;
}

export interface TrainingLoadStrengthSetInput {
  start_time: string;
  reps: number;
  weight: number;
  rpe?: number | null;
}

function isWithinDateKeyRange(date: string, startDate: string, endDate: string): boolean {
  return date >= startDate && date <= endDate;
}

export function buildDailyTrainingLoads(
  activities: TrainingLoadActivityInput[],
  strengthSets: TrainingLoadStrengthSetInput[],
  startDate: string,
  endDate: string,
  timeZone: string
): DailyLoad[] {
  const dayLoads = new Map<string, { runTL: number; strengthTL: number }>();

  for (const activity of activities) {
    const day = zonedDateKey(activity.start_time, timeZone);
    if (!isWithinDateKeyRange(day, startDate, endDate)) continue;

    const entry = dayLoads.get(day) ?? { runTL: 0, strengthTL: 0 };
    entry.runTL = Math.min(200, entry.runTL + (activity.suffer_score ?? 0));
    dayLoads.set(day, entry);
  }

  for (const set of strengthSets) {
    const day = zonedDateKey(set.start_time, timeZone);
    if (!isWithinDateKeyRange(day, startDate, endDate)) continue;

    const entry = dayLoads.get(day) ?? { runTL: 0, strengthTL: 0 };
    const rpe = set.rpe ?? 7;
    entry.strengthTL += set.reps * set.weight * rpe;
    dayLoads.set(day, entry);
  }

  const loads: DailyLoad[] = [];
  for (let date = startDate; date <= endDate; date = addDateKeyDays(date, 1)) {
    const { runTL, strengthTL } = dayLoads.get(date) ?? { runTL: 0, strengthTL: 0 };
    loads.push({
      date,
      runTL,
      strengthTL: normalizeStrengthTL(strengthTL),
    });
  }

  return loads;
}

export function computeATLCTLTSB(
  loads: DailyLoad[],
  startATL = 0,
  startCTL = 0
): TrainingLoadPoint[] {
  const sorted = [...loads].sort(
    (a, b) => a.date.localeCompare(b.date)
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
