"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { MuscleHeatmap } from "@/components/heatmap/MuscleHeatmap";
import { computeE1RM } from "@/lib/e1rm";
import { ACCENT_COLORS } from "@/lib/accent-colors";
import { muscleTagLabel } from "@/lib/muscle-tags";
import { createClient } from "@/lib/supabase/client";
import { formatWeight, weightUnit } from "@/lib/units";
import type { AccentColor, Exercise, MuscleGroup, Units } from "@/types";

type SelectedMuscle = MuscleGroup | "all";

type ActivityRelation = {
  id: string;
  start_time: string;
};

type HistoryRow = {
  id: string;
  activity_id: string;
  set_number: number;
  reps: number;
  weight: number;
  rpe: number | null;
  created_at: string;
  activities?: ActivityRelation | ActivityRelation[] | null;
};

type SetRecord = {
  id: string;
  activityId: string;
  sessionDate: string;
  setNumber: number;
  reps: number;
  weight: number;
  rpe: number | null;
  e1rm: number;
};

type SessionGroup = {
  activityId: string;
  sessionDate: string;
  sets: SetRecord[];
  bestE1RM: number;
  totalVolume: number;
};

const MUSCLE_LABELS: Record<MuscleGroup, string> = {
  chest: "Chest",
  front_delt: "Front delts",
  lateral_delt: "Lateral delts",
  rear_delt: "Rear delts",
  triceps: "Triceps",
  biceps: "Biceps",
  forearm: "Forearms",
  upper_back: "Upper back",
  lats: "Lats",
  traps: "Traps",
  lower_back: "Lower back",
  glutes: "Glutes",
  quads: "Quads",
  hamstrings: "Hamstrings",
  calves: "Calves",
  hip_flexors: "Hip flexors",
  adductors: "Adductors",
  abs: "Abs",
  obliques: "Obliques",
};

const MUSCLE_SECTIONS: { label: string; muscles: MuscleGroup[] }[] = [
  { label: "Push", muscles: ["chest", "front_delt", "lateral_delt", "triceps"] },
  { label: "Pull", muscles: ["upper_back", "lats", "traps", "rear_delt", "biceps", "forearm"] },
  { label: "Legs", muscles: ["glutes", "quads", "hamstrings", "calves", "hip_flexors", "adductors", "lower_back"] },
  { label: "Core", muscles: ["abs", "obliques"] },
];

function firstRelation<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

function muscleLabel(muscle: MuscleGroup): string {
  return MUSCLE_LABELS[muscle];
}

function formatMovementPattern(value: string): string {
  return value.replace(/_/g, " ");
}

function formatDate(value: string): string {
  return new Date(value).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function exerciseMuscles(exercise: Exercise): Set<MuscleGroup> {
  return new Set([...exercise.primary_muscles, ...exercise.secondary_muscles]);
}

function exerciseHeatmapCoverage(exercise: Exercise): Partial<Record<MuscleGroup, number>> {
  const coverage: Partial<Record<MuscleGroup, number>> = {};

  for (const muscle of exercise.secondary_muscles) {
    coverage[muscle] = Math.max(coverage[muscle] ?? 0, 1);
  }

  for (const muscle of exercise.primary_muscles) {
    coverage[muscle] = 2;
  }

  return coverage;
}

function groupHistory(rows: HistoryRow[]): SessionGroup[] {
  const groups = new Map<string, SessionGroup>();

  for (const row of rows) {
    const activity = firstRelation(row.activities);
    const sessionDate = activity?.start_time ?? row.created_at;
    const activityId = activity?.id ?? row.activity_id;
    const set: SetRecord = {
      id: row.id,
      activityId,
      sessionDate,
      setNumber: row.set_number,
      reps: row.reps,
      weight: row.weight,
      rpe: row.rpe,
      e1rm: computeE1RM(row.weight, row.reps),
    };

    const existing = groups.get(activityId);
    if (existing) {
      existing.sets.push(set);
      existing.bestE1RM = Math.max(existing.bestE1RM, set.e1rm);
      existing.totalVolume += set.weight * set.reps;
      continue;
    }

    groups.set(activityId, {
      activityId,
      sessionDate,
      sets: [set],
      bestE1RM: set.e1rm,
      totalVolume: set.weight * set.reps,
    });
  }

  return Array.from(groups.values())
    .map((session) => ({
      ...session,
      sets: session.sets.toSorted((a, b) => a.setNumber - b.setNumber),
    }))
    .sort((a, b) => new Date(b.sessionDate).getTime() - new Date(a.sessionDate).getTime());
}

function MuscleChip({
  muscle,
  tone = "muted",
}: {
  muscle: MuscleGroup;
  tone?: "primary" | "secondary" | "muted";
}) {
  const className =
    tone === "primary"
      ? "border-[rgba(var(--accent-rgb),0.5)] bg-[rgba(var(--accent-rgb),0.14)] text-white"
      : tone === "secondary"
        ? "border-white/12 bg-white/[0.04] text-white/70"
        : "border-white/10 bg-white/[0.03] text-white/62";

  return (
    <span className={`rounded-full border px-2.5 py-1 text-[11px] font-medium ${className}`}>
      {muscleLabel(muscle)}
    </span>
  );
}

function ExerciseListItem({
  exercise,
  active,
  selectedMuscle,
  onSelect,
}: {
  exercise: Exercise;
  active: boolean;
  selectedMuscle: SelectedMuscle;
  onSelect: () => void;
}) {
  const primaryHit = selectedMuscle !== "all" && exercise.primary_muscles.includes(selectedMuscle);
  const secondaryHit = selectedMuscle !== "all" && exercise.secondary_muscles.includes(selectedMuscle);
  const hitLabel = primaryHit ? "Primary hit" : secondaryHit ? "Secondary hit" : exercise.category;

  return (
    <li>
      <button
        type="button"
        onClick={onSelect}
        aria-current={active ? "true" : undefined}
        className={`w-full rounded-xl border p-3 text-left transition-all ${
          active
            ? "border-[rgba(var(--accent-rgb),0.6)] bg-[rgba(var(--accent-rgb),0.12)]"
            : "border-white/10 bg-white/[0.03] hover:border-white/18 hover:bg-white/[0.055]"
        }`}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="truncate text-sm font-medium">{exercise.name}</div>
            <div className="mt-1 text-xs capitalize text-muted">
              {exercise.equipment} · {formatMovementPattern(exercise.movement_pattern)}
            </div>
          </div>
          <span className="shrink-0 rounded-full border border-white/10 px-2 py-0.5 text-[10px] capitalize text-white/55">
            {hitLabel}
          </span>
        </div>
        <div className="mt-3 flex flex-wrap gap-1.5">
          {exercise.primary_muscles.slice(0, 3).map((muscle) => (
            <MuscleChip key={muscle} muscle={muscle} tone="primary" />
          ))}
          {exercise.primary_muscles.length > 3 && (
            <span className="rounded-full border border-white/10 px-2.5 py-1 text-[11px] text-white/55">
              +{exercise.primary_muscles.length - 3}
            </span>
          )}
        </div>
      </button>
    </li>
  );
}

function ExerciseDetail({
  exercise,
  accent,
}: {
  exercise: Exercise | null;
  accent: string;
}) {
  if (!exercise) {
    return (
      <section className="card p-5">
        <div className="text-sm text-muted">Select an exercise to see what it hits.</div>
      </section>
    );
  }

  const heatmapCoverage = exerciseHeatmapCoverage(exercise);

  return (
    <section className="card p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="text-[11px] uppercase tracking-[0.2em] text-white/45">Exercise</div>
          <h2 className="mt-2 text-xl font-semibold tracking-[-0.02em]">{exercise.name}</h2>
          <div className="mt-2 text-sm capitalize text-muted">
            {exercise.equipment} · {exercise.category} · {formatMovementPattern(exercise.movement_pattern)}
          </div>
        </div>
        {exercise.is_custom && (
          <span className="w-fit rounded-full border border-white/10 px-2.5 py-1 text-xs text-white/65">Custom</span>
        )}
      </div>

      <div className="mt-5 grid gap-5 sm:grid-cols-2">
        <div>
          <div className="text-xs uppercase tracking-[0.16em] text-muted">Primary</div>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {exercise.primary_muscles.map((muscle) => (
              <MuscleChip key={muscle} muscle={muscle} tone="primary" />
            ))}
          </div>
        </div>
        <div>
          <div className="text-xs uppercase tracking-[0.16em] text-muted">Secondary</div>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {exercise.secondary_muscles.length > 0 ? (
              exercise.secondary_muscles.map((muscle) => (
                <MuscleChip key={muscle} muscle={muscle} tone="secondary" />
              ))
            ) : (
              <span className="text-sm text-muted">None listed</span>
            )}
          </div>
        </div>
      </div>

      <div className="mt-5 border-t border-border pt-5">
        <div className="flex items-center justify-between gap-3">
          <div className="text-xs uppercase tracking-[0.16em] text-muted">Muscle Map</div>
          <div className="flex items-center gap-3 text-[11px] text-white/55">
            <span className="flex items-center gap-1.5">
              <span className="size-2 rounded-full" style={{ backgroundColor: accent }} aria-hidden="true" />
              Primary
            </span>
            <span className="flex items-center gap-1.5">
              <span className="size-2 rounded-full opacity-50" style={{ backgroundColor: accent }} aria-hidden="true" />
              Secondary
            </span>
          </div>
        </div>
        <div className="mt-4 flex items-center justify-center gap-6">
          <MuscleHeatmap coverage={heatmapCoverage} accent={accent} size="full" />
          <MuscleHeatmap coverage={heatmapCoverage} accent={accent} size="full" showBack />
        </div>
      </div>

      {exercise.muscle_tags.length > 0 && (
        <div className="mt-5 border-t border-border pt-4">
          <div className="text-xs uppercase tracking-[0.16em] text-muted">Details</div>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {exercise.muscle_tags.map((tag) => (
              <span
                key={tag}
                className="rounded-full border border-white/10 bg-white/[0.035] px-2.5 py-1 text-[11px] text-white/68"
              >
                {muscleTagLabel(tag)}
              </span>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}

function HistoryPanel({
  selectedExercise,
  sessions,
  loading,
  units,
}: {
  selectedExercise: Exercise | null;
  sessions: SessionGroup[];
  loading: boolean;
  units: Units;
}) {
  const unit = weightUnit(units);
  const setCount = sessions.reduce((total, session) => total + session.sets.length, 0);
  const best = sessions.reduce<SetRecord | null>((currentBest, session) => {
    const sessionBest = session.sets.reduce<SetRecord | null>(
      (bestSet, set) => (!bestSet || set.e1rm > bestSet.e1rm ? set : bestSet),
      null
    );
    if (!sessionBest) return currentBest;
    return !currentBest || sessionBest.e1rm > currentBest.e1rm ? sessionBest : currentBest;
  }, null);

  return (
    <section className="card p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-[11px] uppercase tracking-[0.2em] text-white/45">Workout History</div>
          <div className="mt-2 text-sm text-muted">
            {selectedExercise ? selectedExercise.name : "No exercise selected"}
          </div>
        </div>
        {setCount > 0 && (
          <span className="shrink-0 rounded-full border border-white/10 px-2.5 py-1 text-xs text-white/65">
            {setCount} set{setCount === 1 ? "" : "s"}
          </span>
        )}
      </div>

      {loading && <div className="mt-5 text-sm text-muted">Loading history...</div>}

      {!loading && selectedExercise && sessions.length === 0 && (
        <div className="mt-5 text-sm text-muted">No logged sets for this exercise yet.</div>
      )}

      {!loading && sessions.length > 0 && (
        <>
          <div className="mt-5 grid grid-cols-3 gap-3 border-b border-border pb-5">
            <div>
              <div className="text-[11px] uppercase tracking-[0.16em] text-muted">Sessions</div>
              <div className="mt-1 text-lg font-semibold">{sessions.length}</div>
            </div>
            <div>
              <div className="text-[11px] uppercase tracking-[0.16em] text-muted">Best e1RM</div>
              <div className="mt-1 text-lg font-semibold">
                {best ? `${formatWeight(best.e1rm, units)} ${unit}` : "—"}
              </div>
            </div>
            <div>
              <div className="text-[11px] uppercase tracking-[0.16em] text-muted">Last</div>
              <div className="mt-1 text-lg font-semibold">{formatDate(sessions[0].sessionDate)}</div>
            </div>
          </div>

          <div className="mt-5 flex flex-col gap-5">
            {sessions.slice(0, 6).map((session) => (
              <div key={session.activityId}>
                <div className="mb-2 flex items-center justify-between gap-3">
                  <Link href={`/activity/${session.activityId}`} className="text-sm font-medium hover:text-accent">
                    {formatDate(session.sessionDate)}
                  </Link>
                  <span className="text-xs text-muted">
                    {session.sets.length} set{session.sets.length === 1 ? "" : "s"} · {formatWeight(session.bestE1RM, units)} {unit} e1RM
                  </span>
                </div>
                <div className="flex flex-col gap-1.5">
                  {session.sets.map((set) => (
                    <div key={set.id} className="grid grid-cols-[3.75rem_1fr_auto] gap-3 text-sm">
                      <span className="text-muted">Set {set.setNumber}</span>
                      <span>
                        {formatWeight(set.weight, units)} {unit} x {set.reps}
                        {set.rpe ? <span className="text-muted"> @ RPE {set.rpe}</span> : null}
                      </span>
                      <span className="text-right text-muted">{formatWeight(set.e1rm, units)}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </section>
  );
}

export function MuscleLookupClient() {
  const [query, setQuery] = useState("");
  const [selectedMuscle, setSelectedMuscle] = useState<SelectedMuscle>("all");
  const [selectedExerciseId, setSelectedExerciseId] = useState<string | null>(null);
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [units, setUnits] = useState<Units>("imperial");
  const [accent, setAccent] = useState("#3B82F6");
  const [loadingExercises, setLoadingExercises] = useState(true);
  const [exerciseError, setExerciseError] = useState<string | null>(null);
  const [historyRows, setHistoryRows] = useState<HistoryRow[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [authResolved, setAuthResolved] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const supabase = createClient();

    async function loadExercises() {
      setLoadingExercises(true);
      setExerciseError(null);

      const [exerciseRes, authRes] = await Promise.all([
        supabase.from("exercises").select("*").order("name"),
        supabase.auth.getUser(),
      ]);

      if (cancelled) return;

      if (exerciseRes.error) {
        setExerciseError("Could not load exercises.");
        setLoadingExercises(false);
        return;
      }

      const nextExercises = (exerciseRes.data ?? []) as Exercise[];
      setExercises(nextExercises);
      setSelectedExerciseId((current) => current ?? nextExercises[0]?.id ?? null);

      const user = authRes.data.user;
      setUserId(user?.id ?? null);
      setAuthResolved(true);

      if (user) {
        const profileRes = await supabase.from("profiles").select("units, accent_color").eq("id", user.id).single();
        if (!cancelled && profileRes.data?.units) {
          setUnits(profileRes.data.units as Units);
        }
        if (!cancelled && profileRes.data?.accent_color) {
          const color = ACCENT_COLORS.find((item) => item.value === (profileRes.data.accent_color as AccentColor));
          if (color) setAccent(color.hex);
        }
      }

      if (!cancelled) setLoadingExercises(false);
    }

    void loadExercises();

    return () => {
      cancelled = true;
    };
  }, []);

  const selectedExercise = useMemo(
    () => exercises.find((exercise) => exercise.id === selectedExerciseId) ?? null,
    [exercises, selectedExerciseId]
  );

  useEffect(() => {
    let cancelled = false;
    const supabase = createClient();

    async function loadHistory() {
      if (!selectedExerciseId || !authResolved || !userId) {
        setHistoryRows([]);
        setLoadingHistory(false);
        return;
      }

      setLoadingHistory(true);
      setHistoryError(null);

      const queryBuilder = supabase
        .from("session_sets")
        .select("id, activity_id, set_number, reps, weight, rpe, created_at, activities!inner(id, start_time, type, user_id)")
        .eq("exercise_id", selectedExerciseId)
        .eq("activities.type", "workout")
        .eq("activities.user_id", userId)
        .order("created_at", { ascending: false })
        .limit(80);

      const { data, error } = await queryBuilder;
      if (cancelled) return;

      if (error) {
        setHistoryRows([]);
        setHistoryError("Could not load exercise history.");
      } else {
        setHistoryRows((data ?? []) as HistoryRow[]);
      }
      setLoadingHistory(false);
    }

    void loadHistory();

    return () => {
      cancelled = true;
    };
  }, [selectedExerciseId, userId, authResolved]);

  const visibleExercises = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    return exercises
      .filter((exercise) => {
        const muscles = exerciseMuscles(exercise);
        const muscleMatch = selectedMuscle === "all" || muscles.has(selectedMuscle);
        if (!muscleMatch) return false;

        if (!normalizedQuery) return true;

        const haystack = [
          exercise.name,
          exercise.equipment,
          exercise.category,
          formatMovementPattern(exercise.movement_pattern),
          ...exercise.primary_muscles.map(muscleLabel),
          ...exercise.secondary_muscles.map(muscleLabel),
          ...exercise.muscle_tags.map(muscleTagLabel),
        ]
          .join(" ")
          .toLowerCase();

        return haystack.includes(normalizedQuery);
      })
      .toSorted((a, b) => {
        if (selectedMuscle !== "all") {
          const aPrimary = a.primary_muscles.includes(selectedMuscle);
          const bPrimary = b.primary_muscles.includes(selectedMuscle);
          if (aPrimary !== bPrimary) return aPrimary ? -1 : 1;
        }
        return a.name.localeCompare(b.name);
      });
  }, [exercises, query, selectedMuscle]);

  const historySessions = useMemo(() => groupHistory(historyRows), [historyRows]);
  const selectedExerciseMuscles = selectedExercise ? exerciseMuscles(selectedExercise) : new Set<MuscleGroup>();

  return (
    <div className="page-shell flex flex-col gap-5">
      <div className="flex items-center gap-3">
        <Link
          href="/log"
          aria-label="Back to log"
          className="shrink-0 flex size-9 items-center justify-center rounded-full border border-white/10 text-white/55 transition-colors hover:border-white/20 hover:text-white"
        >
          <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="size-4">
            <path d="M15 18l-6-6 6-6" />
          </svg>
        </Link>
        <div className="min-w-0">
          <div className="page-kicker mb-1">Log</div>
          <h1 className="text-2xl font-semibold tracking-[-0.04em] sm:text-3xl">Muscle Lookup</h1>
        </div>
      </div>

      <section className="card p-4">
        <label htmlFor="exercise-lookup-search" className="sr-only">
          Search exercises
        </label>
        <input
          id="exercise-lookup-search"
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search exercises, muscles, or equipment..."
          className="w-full rounded-xl border border-border bg-background px-3 py-3 text-sm text-white placeholder:text-white/28 focus:border-[var(--accent)] focus:outline-none"
        />

        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            aria-pressed={selectedMuscle === "all"}
            onClick={() => setSelectedMuscle("all")}
            className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
              selectedMuscle === "all"
                ? "border-[rgba(var(--accent-rgb),0.5)] bg-[rgba(var(--accent-rgb),0.16)] text-white"
                : "border-white/10 bg-white/[0.035] text-white/62 hover:text-white"
            }`}
          >
            All muscles
          </button>
          {MUSCLE_SECTIONS.flatMap((section) =>
            section.muscles.map((muscle) => (
              <button
                key={`${section.label}-${muscle}`}
                type="button"
                aria-pressed={selectedMuscle === muscle}
                onClick={() => setSelectedMuscle(muscle)}
                className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
                  selectedMuscle === muscle
                    ? "border-[rgba(var(--accent-rgb),0.5)] bg-[rgba(var(--accent-rgb),0.16)] text-white"
                    : selectedExerciseMuscles.has(muscle)
                      ? "border-white/14 bg-white/[0.055] text-white/74 hover:text-white"
                      : "border-white/10 bg-white/[0.035] text-white/62 hover:text-white"
                }`}
              >
                {muscleLabel(muscle)}
              </button>
            ))
          )}
        </div>
      </section>

      <div className="grid gap-4 lg:grid-cols-[minmax(18rem,24rem)_minmax(0,1fr)] lg:items-start">
        <section className="card flex min-h-[22rem] flex-col overflow-hidden">
          <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
            <div className="text-sm font-medium">Exercises</div>
            <div className="text-xs text-muted">
              {loadingExercises ? "Loading" : `${visibleExercises.length} / ${exercises.length}`}
            </div>
          </div>

          {exerciseError && <div className="p-4 text-sm text-red-300">{exerciseError}</div>}

          {!exerciseError && loadingExercises && <div className="p-4 text-sm text-muted">Loading exercises...</div>}

          {!exerciseError && !loadingExercises && visibleExercises.length === 0 && (
            <div className="p-4 text-sm text-muted">No exercises found.</div>
          )}

          {!exerciseError && visibleExercises.length > 0 && (
            <ul className="flex max-h-[28rem] flex-col gap-2 overflow-y-auto p-3 lg:max-h-[calc(100vh-19rem)]">
              {visibleExercises.map((exercise) => (
                <ExerciseListItem
                  key={exercise.id}
                  exercise={exercise}
                  active={exercise.id === selectedExerciseId}
                  selectedMuscle={selectedMuscle}
                  onSelect={() => setSelectedExerciseId(exercise.id)}
                />
              ))}
            </ul>
          )}
        </section>

        <div className="flex flex-col gap-4">
          <ExerciseDetail exercise={selectedExercise} accent={accent} />
          {historyError && (
            <div className="rounded-xl border border-red-400/20 bg-red-400/[0.06] px-4 py-3 text-sm text-red-200">
              {historyError}
            </div>
          )}
          <HistoryPanel
            selectedExercise={selectedExercise}
            sessions={historySessions}
            loading={loadingHistory}
            units={units}
          />
        </div>
      </div>
    </div>
  );
}
