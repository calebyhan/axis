"use client";

import type { CSSProperties } from "react";

interface Props {
  year: number;
  month: number;
  activeDays: Map<string, number>;
  badge?: string | null;
  today?: Date;
}

const DAY_LABELS = ["S", "M", "T", "W", "T", "F", "S"];

function dateKey(year: number, month: number, day: number) {
  return `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

export function CalendarMonth({ year, month, activeDays, badge, today = new Date() }: Props) {
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);

  const cells: (number | null)[] = [
    ...Array(firstDay.getDay()).fill(null),
    ...Array.from({ length: lastDay.getDate() }, (_, i) => i + 1),
  ];

  const monthLabel = firstDay.toLocaleString("default", { month: "long", year: "numeric" });

  return (
    <div className="card p-5">
      <div className="flex items-center justify-between mb-3">
        <span className="text-sm font-medium tracking-normal">{monthLabel}</span>
        {badge && (
          <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-xs text-accent font-medium">
            {badge}
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
          const key = dateKey(year, month, day);
          const isToday = year === today.getFullYear() && month === today.getMonth() && day === today.getDate();
          const count = activeDays.get(key) ?? 0;
          let cellClass: string;
          let cellStyle: CSSProperties | undefined;
          let numberClass = "";

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

          if (isToday) {
            numberClass = "text-[#F6D365]";
            cellStyle = {
              ...cellStyle,
              boxShadow: [cellStyle?.boxShadow, "0 0 0 1px rgba(246, 211, 101, 0.45) inset"].filter(Boolean).join(", "),
            };
          }

          return (
            <div
              key={`cell-${cellIdx}`}
              style={cellStyle}
              className={`aspect-square flex items-center justify-center rounded-xl text-[10px] font-medium transition-colors ${cellClass}`}
            >
              <span className={numberClass}>{day}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
