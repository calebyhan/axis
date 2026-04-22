export type AccentColor = "blue" | "green" | "orange" | "purple";

export type Units = "metric" | "imperial";

export type ActivityType = "run" | "ride" | "workout" | "manual_run";

export type ActivitySource = "strava" | "manual";

export type DayTypeCategory = "strength" | "run";

// ISO week order: 0 = Monday … 6 = Sunday (differs from Date.getDay() which is 0 = Sunday)
export type ISODayOfWeek = 0 | 1 | 2 | 3 | 4 | 5 | 6;

export type MuscleGroup =
  | "chest"
  | "front_delt"
  | "rear_delt"
  | "triceps"
  | "biceps"
  | "forearm"
  | "upper_back"
  | "lats"
  | "traps"
  | "lower_back"
  | "glutes"
  | "quads"
  | "hamstrings"
  | "calves"
  | "hip_flexors"
  | "adductors"
  | "abs"
  | "obliques";

export const MUSCLE_GROUPS: MuscleGroup[] = [
  "chest", "front_delt", "rear_delt", "triceps", "biceps", "forearm",
  "upper_back", "lats", "traps", "lower_back",
  "glutes", "quads", "hamstrings", "calves", "hip_flexors", "adductors",
  "abs", "obliques",
];

export type MovementPattern =
  | "horizontal_push"
  | "horizontal_pull"
  | "vertical_push"
  | "vertical_pull"
  | "quad_dominant"
  | "hip_hinge"
  | "elbow_flexion"
  | "elbow_extension"
  | "carry"
  | "core"
  | "other";

export interface DayType {
  id: string;
  name: string;
  category: DayTypeCategory;
  muscle_focus: MuscleGroup[] | null;
}

export interface Exercise {
  id: string;
  name: string;
  category: string;
  primary_muscles: MuscleGroup[];
  secondary_muscles: MuscleGroup[];
  movement_pattern: MovementPattern;
  equipment: string;
  is_custom: boolean;
}

// e1rm is intentionally omitted — compute with computeE1RM(weight, reps) at display sites
export interface SessionSet {
  reps: number;
  weight: number;
  rpe: number;
}

export interface SessionExercise {
  exerciseId: string;
  name: string;
  sets: SessionSet[];
  primaryMuscles: MuscleGroup[];
  secondaryMuscles: MuscleGroup[];
}

// muscleGroupCoverage is intentionally omitted — derive from exercises at render time
export interface SessionState {
  startTime: Date;
  dayType: DayType | null;
  exercises: SessionExercise[];
}

export interface Activity {
  id: string;
  user_id: string;
  strava_activity_id: number | null;
  type: ActivityType;
  day_type_id: string | null;
  start_time: string;
  duration: number;
  source: ActivitySource;
  distance: number | null;
  avg_heartrate: number | null;
  max_heartrate: number | null;
  suffer_score: number | null;
  calories: number | null;
  elevation_gain: number | null;
  avg_pace: number | null;
  tags: string[] | null;
  notes: string | null;
}

export interface Profile {
  id: string;
  units: Units;
  accent_color: AccentColor;
  weight_increment_upper: number;
  weight_increment_lower: number;
  ohp_bench_ratio: number;
  dl_squat_ratio: number;
  volume_ceiling: number;
  strava_access_token: string | null;
  strava_refresh_token: string | null;
  token_expires_at: string | null;
}

export interface DailyCheckin {
  id: string;
  user_id: string;
  date: string;
  body_weight: number;
  notes: string | null;
}

export interface WeeklyScheduleRow {
  id: string;
  day_of_week: ISODayOfWeek;
  day_type_id: string;
  active: boolean;
  day_type?: DayType;
}
