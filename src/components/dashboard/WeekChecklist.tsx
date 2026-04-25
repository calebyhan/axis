"use client";

import type { ChecklistDay, ChecklistSlot } from "@/lib/checklist";

const DAY_NAMES = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

interface Props {
  items: ChecklistDay[];
}

function Pill({ slot, dayPassed }: { slot: ChecklistSlot; dayPassed: boolean }) {
  const done = !!slot.matched || (slot.planned.name === "Rest" && dayPassed);
  return (
    <span
      style={
        done
          ? {
              borderColor: "rgba(var(--accent-rgb), 0.4)",
              backgroundColor: "rgba(var(--accent-rgb), 0.1)",
              color: "var(--accent)",
            }
          : undefined
      }
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border transition-colors ${
        done ? "" : "border-white/10 bg-white/[0.03] text-white/40"
      }`}
    >
      {done && (
        <svg viewBox="0 0 10 8" fill="none" className="w-2.5 h-2 shrink-0">
          <path d="M1 4l2.5 2.5L9 1" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )}
      {slot.planned.name}
    </span>
  );
}

export function WeekChecklist({ items }: Props) {
  if (items.length === 0) {
    return (
      <div className="card p-4">
        <p className="text-sm text-muted">No schedule set. Add one in Settings.</p>
      </div>
    );
  }

  const todayIsoDay = (new Date().getDay() + 6) % 7;

  return (
    <div className="card divide-y divide-white/5">
      {items.map((day) => {
        const dayPassed = day.dayOfWeek <= todayIsoDay;
        return (
          <div key={day.dayOfWeek} className="flex items-center gap-3 px-4 py-3">
            <span className="text-xs text-white/38 w-8 shrink-0">{DAY_NAMES[day.dayOfWeek]}</span>
            <div className="flex flex-wrap gap-2">
              {day.workout && <Pill slot={day.workout} dayPassed={dayPassed} />}
              {day.cardio && <Pill slot={day.cardio} dayPassed={dayPassed} />}
            </div>
          </div>
        );
      })}
    </div>
  );
}
