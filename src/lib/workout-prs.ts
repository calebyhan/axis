import { computeE1RM } from "@/lib/e1rm";
import { zonedDateKey } from "@/lib/time-zone";

type Relation<T> = T | T[] | null | undefined;

export interface WorkoutPrSetRow {
  id: string;
  exercise_id: string;
  set_number: number;
  reps: number;
  weight: number;
  created_at: string;
  activities?: Relation<{
    id: string;
    start_time: string;
  }>;
  exercises?: Relation<{
    name: string;
  }>;
}

export interface WorkoutPersonalRecord {
  kind: "workout";
  activityId: string;
  exerciseId: string;
  exerciseName: string;
  startTime: string;
  setCreatedAt: string;
  date: string;
  e1rm: number;
  weight: number;
  reps: number;
  setNumber: number;
}

interface DeriveWorkoutPrOptions {
  startInstant: string | null;
  endExclusiveInstant: string;
  timeZone: string;
}

const EPSILON = 0.0001;

function firstRelation<T>(value: Relation<T>): T | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

function compareRows(a: WorkoutPrSetRow, b: WorkoutPrSetRow): number {
  const aActivity = firstRelation(a.activities);
  const bActivity = firstRelation(b.activities);
  const startCompare = (aActivity?.start_time ?? "").localeCompare(bActivity?.start_time ?? "");
  if (startCompare !== 0) return startCompare;
  const createdCompare = a.created_at.localeCompare(b.created_at);
  if (createdCompare !== 0) return createdCompare;
  return a.set_number - b.set_number;
}

function inRange(startTime: string, options: DeriveWorkoutPrOptions): boolean {
  return (!options.startInstant || startTime >= options.startInstant) && startTime < options.endExclusiveInstant;
}

export function deriveWorkoutPersonalRecords(
  rows: WorkoutPrSetRow[],
  options: DeriveWorkoutPrOptions
): WorkoutPersonalRecord[] {
  const bestByExercise = new Map<string, number>();
  const recordsByExerciseActivity = new Map<string, WorkoutPersonalRecord>();

  for (const row of [...rows].sort(compareRows)) {
    const activity = firstRelation(row.activities);
    const exercise = firstRelation(row.exercises);
    if (!activity || !exercise) continue;
    if (activity.start_time >= options.endExclusiveInstant) continue;

    const e1rm = computeE1RM(row.weight, row.reps);
    const previousBest = bestByExercise.get(row.exercise_id);
    if (previousBest !== undefined && e1rm <= previousBest + EPSILON) continue;

    bestByExercise.set(row.exercise_id, e1rm);
    if (!inRange(activity.start_time, options)) continue;

    const key = `${activity.id}:${row.exercise_id}`;
    recordsByExerciseActivity.set(key, {
      kind: "workout",
      activityId: activity.id,
      exerciseId: row.exercise_id,
      exerciseName: exercise.name,
      startTime: activity.start_time,
      setCreatedAt: row.created_at,
      date: zonedDateKey(activity.start_time, options.timeZone),
      e1rm: Math.round(e1rm * 10) / 10,
      weight: row.weight,
      reps: row.reps,
      setNumber: row.set_number,
    });
  }

  return Array.from(recordsByExerciseActivity.values()).sort((a, b) => {
    const startCompare = b.startTime.localeCompare(a.startTime);
    if (startCompare !== 0) return startCompare;
    const createdCompare = b.setCreatedAt.localeCompare(a.setCreatedAt);
    if (createdCompare !== 0) return createdCompare;
    return b.e1rm - a.e1rm;
  });
}
