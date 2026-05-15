"use client";

import { useState, useMemo } from "react";
import { RunCard } from "./RunCard";
import { WorkoutCard } from "./WorkoutCard";
import type { Activity, MuscleGroup, Units } from "@/types";

type TypeFilter = "all" | "run" | "workout";
type DistanceFilter = "any" | "short" | "medium" | "long";

type WorkoutData = {
  coverage: Partial<Record<MuscleGroup, number>>;
  exerciseCount: number;
  totalVolume: number;
};

interface Props {
  activities: Activity[];
  workoutDataMap: Record<string, WorkoutData>;
  dayTypeNames: Record<string, string>;
  units: Units;
}

// Muscle group chips grouped for compact display
const MUSCLE_GROUPS: { label: string; muscles: MuscleGroup[] }[] = [
  { label: "Chest", muscles: ["chest"] },
  { label: "Back", muscles: ["upper_back", "lats", "traps", "lower_back"] },
  { label: "Shoulders", muscles: ["front_delt", "lateral_delt", "rear_delt"] },
  { label: "Arms", muscles: ["biceps", "triceps", "forearm"] },
  { label: "Legs", muscles: ["quads", "hamstrings", "glutes", "calves", "hip_flexors", "adductors"] },
  { label: "Core", muscles: ["abs", "obliques"] },
];

function distanceKm(activity: Activity) {
  return activity.distance ? activity.distance / 1000 : null;
}

function matchesDistanceFilter(activity: Activity, filter: DistanceFilter, useMetric: boolean): boolean {
  if (filter === "any") return true;
  const km = distanceKm(activity);
  if (km === null) return false;
  const dist = useMetric ? km : km * 0.621371; // convert to miles if imperial
  if (filter === "short") return dist < (useMetric ? 5 : 3.1);
  if (filter === "medium") return dist >= (useMetric ? 5 : 3.1) && dist <= (useMetric ? 15 : 9.3);
  if (filter === "long") return dist > (useMetric ? 15 : 9.3);
  return true;
}


function workoutHasMuscleGroup(coverage: Partial<Record<MuscleGroup, number>>, muscles: MuscleGroup[]): boolean {
  return muscles.some((m) => (coverage[m] ?? 0) > 0);
}

function filterChipClass(active: boolean) {
  return `px-2.5 py-1 rounded-md text-xs transition-colors border ${
    active
      ? "bg-white/10 border-white/20 text-white"
      : "border-[#1F1F1F] text-white/40 hover:text-white/60"
  }`;
}

export function ActivityFeed({ activities, workoutDataMap, dayTypeNames, units }: Props) {
  const useMetric = units === "metric";

  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("all");
  const [distanceFilter, setDistanceFilter] = useState<DistanceFilter>("any");
  const [muscleFilter, setMuscleFilter] = useState<string | null>(null); // label from MUSCLE_GROUPS
  const [dayTypeFilter, setDayTypeFilter] = useState<string | null>(null); // day_type_id

  // derive unique day types present in data
  const availableDayTypes = useMemo(() => {
    const seen = new Map<string, string>();
    for (const a of activities) {
      if (a.type === "workout" && a.day_type_id && dayTypeNames[a.day_type_id]) {
        seen.set(a.day_type_id, dayTypeNames[a.day_type_id]);
      }
    }
    return Array.from(seen.entries()); // [id, name]
  }, [activities, dayTypeNames]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();

    return activities.filter((a) => {
      // type filter
      if (typeFilter === "run" && a.type !== "run" && a.type !== "manual_run") return false;
      if (typeFilter === "workout" && a.type !== "workout") return false;

      // run-specific filters
      if ((typeFilter === "run" || (typeFilter === "all" && (a.type === "run" || a.type === "manual_run")))) {
        if (a.type === "run" || a.type === "manual_run") {
          if (!matchesDistanceFilter(a, distanceFilter, useMetric)) return false;
        }
      }

      // workout-specific filters
      if (a.type === "workout") {
        if (muscleFilter !== null) {
          const group = MUSCLE_GROUPS.find((g) => g.label === muscleFilter);
          const coverage = workoutDataMap[a.id]?.coverage ?? {};
          if (!group || !workoutHasMuscleGroup(coverage, group.muscles)) return false;
        }
        if (dayTypeFilter !== null && a.day_type_id !== dayTypeFilter) return false;
      }

      // text search
      if (q) {
        const name = (a.name ?? "").toLowerCase();
        const date = new Date(a.start_time).toLocaleDateString("en-US", {
          weekday: "long", month: "long", day: "numeric", year: "numeric",
        }).toLowerCase();
        const typeLabel = a.type === "workout" ? "workout" : a.type === "manual_run" ? "manual run" : "run";
        const dayType = a.day_type_id ? (dayTypeNames[a.day_type_id] ?? "").toLowerCase() : "";
        if (!name.includes(q) && !date.includes(q) && !typeLabel.includes(q) && !dayType.includes(q)) return false;
      }

      return true;
    });
  }, [activities, typeFilter, distanceFilter, muscleFilter, dayTypeFilter, search, dayTypeNames, workoutDataMap, useMetric]);

  const typeOptions: { value: TypeFilter; label: string }[] = [
    { value: "all", label: "All" },
    { value: "run", label: "Runs" },
    { value: "workout", label: "Workouts" },
  ];

  const distanceOptions: { value: DistanceFilter; label: string }[] = useMetric
    ? [
        { value: "any", label: "Any" },
        { value: "short", label: "< 5 km" },
        { value: "medium", label: "5 – 15 km" },
        { value: "long", label: "> 15 km" },
      ]
    : [
        { value: "any", label: "Any" },
        { value: "short", label: "< 3 mi" },
        { value: "medium", label: "3 – 9 mi" },
        { value: "long", label: "> 9 mi" },
      ];

  const showRunFilters = typeFilter === "run" || (typeFilter === "all");
  const showWorkoutFilters = typeFilter === "workout" || (typeFilter === "all");
  const hasRunsInData = activities.some((a) => a.type === "run" || a.type === "manual_run");
  const hasWorkoutsInData = activities.some((a) => a.type === "workout");
  const showRunFilterGroup = showRunFilters && hasRunsInData;
  const showWorkoutFilterGroup = showWorkoutFilters && hasWorkoutsInData;
  const scopedFilterGridClass =
    showRunFilterGroup && showWorkoutFilterGroup
      ? "grid gap-3 border-t border-white/8 pt-3 lg:grid-cols-[minmax(14rem,0.8fr)_minmax(0,1.2fr)]"
      : "grid gap-3 border-t border-white/8 pt-3";
  const activeFilterCount = [
    search.trim() !== "",
    typeFilter !== "all",
    distanceFilter !== "any",
    muscleFilter !== null,
    dayTypeFilter !== null,
  ].filter(Boolean).length;
  const hasActiveFilters = activeFilterCount > 0;

  function clearFilters() {
    setSearch("");
    setTypeFilter("all");
    setDistanceFilter("any");
    setMuscleFilter(null);
    setDayTypeFilter(null);
  }

  return (
    <div className="flex flex-col gap-4">
      <section aria-label="Activity filters" className="card p-3 sm:p-4">
        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <label htmlFor="activity-search" className="sr-only">Search activities</label>
            <input
              id="activity-search"
              type="search"
              placeholder="Search activities…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="min-h-10 w-full flex-1 rounded-lg border border-[#1F1F1F] bg-[#141414] px-3 py-2 text-sm text-white placeholder-white/30 focus:outline-none focus:border-white/20"
            />
            <div className="flex shrink-0 gap-1.5 rounded-lg border border-[#1F1F1F] bg-white/[0.02] p-1" role="group" aria-label="Activity type">
              {typeOptions.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  aria-pressed={typeFilter === opt.value}
                  onClick={() => {
                    setTypeFilter(opt.value);
                    setDistanceFilter("any");
                    setMuscleFilter(null);
                    setDayTypeFilter(null);
                  }}
                  className={`min-h-8 flex-1 rounded-md px-3 py-1.5 text-xs font-medium transition-colors sm:flex-none ${
                    typeFilter === opt.value ? "bg-white/10 text-white" : "text-white/40 hover:text-white/60"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-white/8 pt-3">
            <div className="text-xs text-white/40">
              Showing <span className="text-white/70">{filtered.length}</span> of {activities.length}
              {hasActiveFilters && (
                <span className="ml-2 text-white/30">
                  {activeFilterCount} {activeFilterCount === 1 ? "filter" : "filters"} active
                </span>
              )}
            </div>
            {hasActiveFilters && (
              <button
                type="button"
                onClick={clearFilters}
                className="rounded-md px-2.5 py-1 text-xs text-white/45 transition-colors hover:bg-white/6 hover:text-white/70"
              >
                Reset
              </button>
            )}
          </div>

          {showRunFilterGroup || showWorkoutFilterGroup ? (
            <div className={scopedFilterGridClass}>
              {showRunFilterGroup && (
                <div className="flex flex-col gap-1.5">
                  <span className="text-[10px] text-white/35 uppercase tracking-[0.16em]">Run Distance</span>
                  <div className="flex flex-wrap gap-1.5" role="group" aria-label="Distance filter">
                    {distanceOptions.map((opt) => (
                      <button
                        key={opt.value}
                        type="button"
                        aria-pressed={distanceFilter === opt.value}
                        onClick={() => setDistanceFilter(opt.value)}
                        className={filterChipClass(distanceFilter === opt.value)}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {showWorkoutFilterGroup && (
                <div className="mobile-landscape-stack grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
                  <div className="flex flex-col gap-1.5">
                    <span className="text-[10px] text-white/35 uppercase tracking-[0.16em]">Muscle Group</span>
                    <div className="flex flex-wrap gap-1.5" role="group" aria-label="Muscle group filter">
                      {MUSCLE_GROUPS.map((g) => (
                        <button
                          key={g.label}
                          type="button"
                          aria-pressed={muscleFilter === g.label}
                          onClick={() => setMuscleFilter(muscleFilter === g.label ? null : g.label)}
                          className={filterChipClass(muscleFilter === g.label)}
                        >
                          {g.label}
                        </button>
                      ))}
                    </div>
                  </div>
                  {availableDayTypes.length > 0 && (
                    <div className="flex flex-col gap-1.5">
                      <span className="text-[10px] text-white/35 uppercase tracking-[0.16em]">Day Type</span>
                      <div className="flex flex-wrap gap-1.5" role="group" aria-label="Day type filter">
                        {availableDayTypes.map(([id, name]) => (
                          <button
                            key={id}
                            type="button"
                            aria-pressed={dayTypeFilter === id}
                            onClick={() => setDayTypeFilter(dayTypeFilter === id ? null : id)}
                            className={filterChipClass(dayTypeFilter === id)}
                          >
                            {name}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          ) : null}
        </div>
      </section>

      {/* Results */}
      {filtered.length === 0 ? (
        <div className="card p-6 text-center">
          <p className="text-muted text-sm">No activities match your filters.</p>
        </div>
      ) : (
        <div className="mobile-landscape-stack grid gap-3 lg:grid-cols-2">
          {filtered.map((activity) => {
            if (activity.type === "workout") {
              const wd = workoutDataMap[activity.id] ?? { coverage: {}, exerciseCount: 0, totalVolume: 0 };
              return (
                <WorkoutCard
                  key={activity.id}
                  activity={activity}
                  coverage={wd.coverage}
                  exerciseCount={wd.exerciseCount}
                  totalVolume={wd.totalVolume}
                  dayTypeName={activity.day_type_id ? dayTypeNames[activity.day_type_id] : undefined}
                  units={units}
                />
              );
            }
            return <RunCard key={activity.id} activity={activity} units={units} />;
          })}
        </div>
      )}
    </div>
  );
}
