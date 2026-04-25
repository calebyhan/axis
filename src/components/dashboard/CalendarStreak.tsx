"use client";

import type { CSSProperties } from "react";
import type { DayPlanEntry } from "@/lib/queries/dashboard";

interface Props {
  streak: number;
  activities: { start_time: string; type: string }[];
  dayPlans: DayPlanEntry[];
}

const DAY_LABELS = ["S", "M", "T", "W", "T", "F", "S"];

function localDateKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function buildActiveDays(
  activities: { start_time: string; type: string }[],
  dayPlans: DayPlanEntry[],
): Map<string, number> {
  const dayKinds = new Map<string, Set<string>>();
  for (const { start_time, type } of activities) {
    const kind =
      type === "workout" ? "workout"
      : type === "run" || type === "manual_run" || type === "ride" ? "cardio"
      : null;
    if (!kind) continue;
    const key = localDateKey(new Date(start_time));
    const kinds = dayKinds.get(key) ?? new Set<string>();
    kinds.add(kind);
    dayKinds.set(key, kinds);
  }

  const map = new Map<string, number>();
  for (const [key, kinds] of dayKinds) {
    map.set(key, kinds.has("workout") && kinds.has("cardio") ? 2 : 1);
  }

  // Overlay plan completion for the current week up to today (local time)
  const plansByDay = new Map(dayPlans.map((p) => [p.dayOfWeek, p]));
  const today = new Date();
  const todayKey = localDateKey(today);
  const monday = new Date(today);
  monday.setDate(today.getDate() - ((today.getDay() + 6) % 7));
  monday.setHours(0, 0, 0, 0);

  const cursor = new Date(monday);
  while (localDateKey(cursor) <= todayKey) {
    const key = localDateKey(cursor);
    const plan = plansByDay.get((cursor.getDay() + 6) % 7);
    if (plan) {
      const kinds = dayKinds.get(key);
      const workoutDone = plan.workoutSatisfiedByRest || !!kinds?.has("workout");
      const cardioDone = plan.cardioSatisfiedByRest || !!kinds?.has("cardio");
      let count = 0;
      if (plan.hasWorkoutSlot && plan.hasCardioSlot) count = Number(workoutDone) + Number(cardioDone);
      else if (plan.hasWorkoutSlot) count = workoutDone ? 1 : 0;
      else if (plan.hasCardioSlot) count = cardioDone ? 1 : 0;
      else count = kinds ? kinds.size : 0;
      if (count > 0) map.set(key, count);
    }
    cursor.setDate(cursor.getDate() + 1);
  }

  return map;
}

export function CalendarStreak({ streak, activities, dayPlans }: Props) {
  const activeDays = buildActiveDays(activities, dayPlans);
  const today = new Date();
  const year = today.getFullYear();
  const month = today.getMonth();

  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);

  const cells: (number | null)[] = [
    ...Array(firstDay.getDay()).fill(null),
    ...Array.from({ length: lastDay.getDate() }, (_, i) => i + 1),
  ];

  const monthLabel = firstDay.toLocaleString("default", { month: "long", year: "numeric" });

  function dateKey(day: number) {
    return `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  }

  return (
    <div className="card p-5">
      <div className="flex items-center justify-between mb-3">
        <span className="text-sm font-medium tracking-[-0.02em]">{monthLabel}</span>
        {streak > 0 && (
          <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-xs text-accent font-medium">
            {streak} day streak
          </span>
        )}
      </div>

      <div className="grid grid-cols-7 gap-1.5 mb-1.5">
        {DAY_LABELS.map((l, labelIdx) => (
          <div key={`day-label-${labelIdx}`} className="text-center text-[10px] text-white/35">
            {l}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1.5">
        {cells.map((day, cellIdx) => {
          if (day === null) return <div key={`cell-empty-${cellIdx}`} />;
          const key = dateKey(day);
          const isToday = day === today.getDate();
          const count = activeDays.get(key) ?? 0;
          let cellClass: string;
          let cellStyle: CSSProperties | undefined;

          if (count >= 2) {
            cellClass = "border text-white";
            cellStyle = {
              borderColor: "rgba(var(--accent-rgb), 0.95)",
              backgroundColor: "rgba(var(--accent-rgb), 0.22)",
              boxShadow: "0 0 0 1px rgba(var(--accent-rgb), 0.18) inset",
            };
          } else if (count === 1) {
            cellClass = "border text-white";
            cellStyle = {
              borderColor: "rgba(var(--accent-rgb), 0.5)",
              backgroundColor: "rgba(var(--accent-rgb), 0.08)",
            };
          } else if (isToday) {
            cellClass = "border border-white/12 bg-white/[0.04] text-white";
          } else {
            cellClass = "text-white/45";
          }

          return (
            <div
              key={`cell-${cellIdx}`}
              style={cellStyle}
              className={`aspect-square flex items-center justify-center rounded-xl text-[10px] font-medium transition-colors ${cellClass}`}
            >
              {day}
            </div>
          );
        })}
      </div>
    </div>
  );
}
