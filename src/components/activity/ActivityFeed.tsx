"use client";

import { useState, useMemo } from "react";
import { RunCard } from "./RunCard";
import { WorkoutCard } from "./WorkoutCard";
import type { Activity, MuscleGroup, Units } from "@/types";

type TypeFilter = "all" | "run" | "workout";

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

export function ActivityFeed({ activities, workoutDataMap, dayTypeNames, units }: Props) {
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("all");

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return activities.filter((a) => {
      if (typeFilter === "run" && a.type !== "run" && a.type !== "manual_run") return false;
      if (typeFilter === "workout" && a.type !== "workout") return false;

      if (q) {
        const name = (a.name ?? "").toLowerCase();
        const date = new Date(a.start_time).toLocaleDateString("en-US", {
          weekday: "long",
          month: "long",
          day: "numeric",
          year: "numeric",
        }).toLowerCase();
        const typLabel = a.type === "workout" ? "workout" : a.type === "manual_run" ? "manual run" : "run";
        const dayType = a.day_type_id ? (dayTypeNames[a.day_type_id] ?? "").toLowerCase() : "";
        if (!name.includes(q) && !date.includes(q) && !typLabel.includes(q) && !dayType.includes(q)) return false;
      }

      return true;
    });
  }, [activities, typeFilter, search, dayTypeNames]);

  const typeOptions: { value: TypeFilter; label: string }[] = [
    { value: "all", label: "All" },
    { value: "run", label: "Runs" },
    { value: "workout", label: "Workouts" },
  ];

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <input
          type="search"
          placeholder="Search activities…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full bg-[#141414] border border-[#1F1F1F] rounded-lg px-3 py-2 text-sm text-white placeholder-white/30 focus:outline-none focus:border-white/20"
        />
        <div className="flex gap-1.5">
          {typeOptions.map((opt) => (
            <button
              key={opt.value}
              onClick={() => setTypeFilter(opt.value)}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                typeFilter === opt.value
                  ? "bg-white/10 text-white"
                  : "text-white/40 hover:text-white/60"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="card p-6 text-center">
          <p className="text-muted text-sm">No activities match your search.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
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
