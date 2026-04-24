"use client";

import type { CSSProperties } from "react";

interface Props {
  streak: number;
  activeDays: Map<string, number>; // ISO date string → session count
}

const DAY_LABELS = ["S", "M", "T", "W", "T", "F", "S"];

export function CalendarStreak({ streak, activeDays }: Props) {
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
        {DAY_LABELS.map((l, i) => (
          <div key={i} className="text-center text-[10px] text-white/35">
            {l}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1.5">
        {cells.map((day, i) => {
          if (day === null) return <div key={i} />;
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
              key={i}
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
