import type { HRZone, HRZoneMethod } from "@/lib/hr-zones";
import type { PaceZone } from "@/lib/pace-zones";

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
  | "lateral_delt"
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
  "chest", "front_delt", "lateral_delt", "rear_delt", "triceps", "biceps", "forearm",
  "upper_back", "lats", "traps", "lower_back",
  "glutes", "quads", "hamstrings", "calves", "hip_flexors", "adductors",
  "abs", "obliques",
];

export type MuscleTag =
  | "biceps_long_head"
  | "biceps_short_head"
  | "brachialis"
  | "brachioradialis";

export interface MuscleHeatmapDetailTag {
  label: string;
  sets: number;
}

export interface MuscleHeatmapDetail {
  items: string[];
  tags?: MuscleHeatmapDetailTag[];
}

export type MuscleHeatmapDetails = Partial<Record<MuscleGroup, MuscleHeatmapDetail>>;

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
  muscle_tags: MuscleTag[];
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
  movementPattern: MovementPattern;
  primaryMuscles: MuscleGroup[];
  secondaryMuscles: MuscleGroup[];
  muscleTags: MuscleTag[];
}

// muscleGroupCoverage is intentionally omitted — derive from exercises at render time
export interface SessionState {
  startTime: Date;
  timerStartedAt: Date | null;
  elapsedSeconds: number;
  dayType: DayType | null;
  exercises: SessionExercise[];
}

export interface Split {
  split: number;
  distance: number;
  elapsed_time: number;
  moving_time: number;
  elevation_difference: number;
  average_speed: number;
  average_grade_adjusted_speed: number | null;
  average_heartrate: number | null;
  pace_zone: number | null;
}

export interface ActivitySplitsByUnit {
  metric?: Split[] | null;
  standard?: Split[] | null;
}

export type ActivitySplits = Split[] | ActivitySplitsByUnit;

export interface BestEffort {
  name: string;
  elapsed_time: number;
  distance: number;
  pr_rank: number | null;
}

export interface Lap {
  lap_index: number;
  name: string;
  distance: number;
  moving_time: number;
  elapsed_time: number;
  average_speed: number;
  average_heartrate: number | null;
  max_heartrate: number | null;
  total_elevation_gain: number | null;
  average_cadence: number | null;
  average_watts: number | null;
  pace_zone: number | null;
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
  // enriched run fields
  name: string | null;
  summary_polyline: string | null;
  splits: ActivitySplits | null;
  laps: Lap[] | null;
  best_efforts: BestEffort[] | null;
  avg_cadence: number | null;
  avg_watts: number | null;
  elapsed_time: number | null;
  max_speed: number | null;
  average_temp: number | null;
}

export interface Profile {
  id: string;
  units: Units;
  accent_color: AccentColor;
  display_name: string | null;
  onboarding_completed_at: string | null;
  strava_access_token: string | null;
  strava_refresh_token: string | null;
  token_expires_at: string | null;
  hr_zones: HRZone[] | null;
  hr_zone_method: HRZoneMethod;
  max_heart_rate: number;
  pace_zones: PaceZone[] | null;
  strava_hr_zones: HRZone[] | null;
  strava_hr_zones_synced_at: string | null;
  strava_hr_zones_hash: string | null;
  ignored_hr_zone_suggestion_hash: string | null;
  ignored_pace_zone_suggestion_hash: string | null;
  last_hr_zone_suggestion_basis: Record<string, unknown> | null;
  last_pace_zone_suggestion_basis: Record<string, unknown> | null;
  last_zone_suggestions_generated_at: string | null;
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
  day_type_id: string | null;
  cardio_day_type_id: string | null;
  active: boolean;
  day_type?: DayType;
  cardio_day_type?: DayType;
}

export interface ScheduleOverride {
  id: string;
  user_id: string;
  date: string; // YYYY-MM-DD
  slot: "workout" | "cardio";
  day_type_id: string | null; // null = skip/rest override
}

export interface PlannedSlotSnapshot {
  id: string;
  user_id: string;
  week_start: string;
  date: string;
  day_of_week: ISODayOfWeek;
  slot: "workout" | "cardio";
  planned_day_type_id: string | null;
  effective_day_type_id: string | null;
  is_overridden: boolean;
  is_skipped: boolean;
}

export interface NotificationPreferences {
  user_id: string;
  enabled: boolean;
  today_plan_enabled: boolean;
  today_plan_time: string;
  pending_strava_enabled: boolean;
  plan_nudge_enabled: boolean;
  plan_nudge_time: string;
  weekly_review_enabled: boolean;
  weekly_review_day: number;
  weekly_review_time: string;
  timezone: string;
}
