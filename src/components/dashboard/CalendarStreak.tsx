"use client";

interface Props {
  streak: number;
  activeDays: Set<string>; // ISO date strings yyyy-MM-dd
}

const DAY_LABELS = ["M", "T", "W", "T", "F", "S", "S"];

export function CalendarStreak({ streak, activeDays }: Props) {
  const today = new Date();
  const year = today.getFullYear();
  const month = today.getMonth();

  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  // ISO day of first: 0=Mon...6=Sun
  const firstIsoDay = (firstDay.getDay() + 6) % 7;

  const cells: (number | null)[] = [
    ...Array(firstIsoDay).fill(null),
    ...Array.from({ length: lastDay.getDate() }, (_, i) => i + 1),
  ];

  const monthLabel = firstDay.toLocaleString("default", { month: "long", year: "numeric" });

  function dateKey(day: number) {
    return `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  }

  return (
    <div className="card p-4">
      <div className="flex items-center justify-between mb-3">
        <span className="text-sm font-medium">{monthLabel}</span>
        {streak > 0 && (
          <span className="text-xs text-accent font-medium">{streak} day streak</span>
        )}
      </div>

      <div className="grid grid-cols-7 gap-1 mb-1">
        {DAY_LABELS.map((l, i) => (
          <div key={i} className="text-center text-[10px] text-muted">
            {l}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1">
        {cells.map((day, i) => {
          if (day === null) return <div key={i} />;
          const key = dateKey(day);
          const isToday = day === today.getDate();
          const isActive = activeDays.has(key);

          return (
            <div
              key={i}
              className={`aspect-square flex items-center justify-center rounded-md text-[10px] font-medium transition-colors ${
                isActive
                  ? "bg-accent text-white"
                  : isToday
                  ? "border border-border text-white"
                  : "text-muted"
              }`}
            >
              {day}
            </div>
          );
        })}
      </div>
    </div>
  );
}
