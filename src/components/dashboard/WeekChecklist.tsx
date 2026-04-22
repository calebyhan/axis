import type { ChecklistItem } from "@/lib/checklist";

const DAY_NAMES = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

interface Props {
  items: ChecklistItem[];
}

export function WeekChecklist({ items }: Props) {
  if (items.length === 0) {
    return (
      <div className="card p-4">
        <p className="text-sm text-muted">No schedule set. Add one in Settings.</p>
      </div>
    );
  }

  return (
    <div className="card divide-y divide-border">
      {items.map((item, i) => (
        <div key={i} className="flex items-center gap-3 px-4 py-3">
          <div
            className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors ${
              item.matched
                ? "border-accent bg-accent"
                : "border-border"
            }`}
          >
            {item.matched && (
              <svg viewBox="0 0 12 10" fill="none" className="w-3 h-2.5">
                <path d="M1 5l3 3 7-7" stroke="white" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            )}
          </div>
          <div className="flex-1 min-w-0">
            <div className={`text-sm font-medium ${item.matched ? "text-white" : "text-muted"}`}>
              {item.planned.name}
            </div>
          </div>
          <div className="text-xs text-muted shrink-0">{DAY_NAMES[item.dayOfWeek]}</div>
        </div>
      ))}
    </div>
  );
}
