"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";
import { CHART_TOOLTIP_PROPS } from "@/components/stats/chartTheme";
import type { AdherenceWeek } from "@/lib/adherence";
import { localDateStr } from "@/lib/planner";

interface Props {
  adherence: AdherenceWeek[];
}

export default function PlanTab({ adherence }: Props) {
  const latest = adherence[adherence.length - 1] ?? null;
  const todayStr = localDateStr(new Date());
  const totals = adherence.reduce(
    (acc, week) => {
      acc.planned += week.summary.planned;
      acc.completed += week.summary.completed + week.summary.swapped;
      acc.missed += week.summary.missed;
      acc.skipped += week.summary.skipped;
      return acc;
    },
    { planned: 0, completed: 0, missed: 0, skipped: 0 }
  );
  const rate = totals.planned > 0 ? Math.round((totals.completed / totals.planned) * 100) : null;
  const chartData = adherence.map((week) => ({
    week: week.weekStart.slice(5),
    completed: week.summary.completed + week.summary.swapped,
    missed: week.summary.missed,
    pending: week.summary.pending,
    skipped: week.summary.skipped,
  }));
  const currentWeekDays = latest ? groupSlotsByDay(latest.slots) : [];
  const currentWeekDone = latest ? latest.summary.completed + latest.summary.swapped : 0;
  const currentWeekLabel =
    latest && latest.summary.planned > 0 ? `${currentWeekDone}/${latest.summary.planned} done` : "No planned sessions";

  return (
    <div className="flex flex-col gap-5">
      <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
        <StatCard label="Adherence" value={rate === null ? "—" : `${rate}%`} />
        <StatCard label="Completed" value={String(totals.completed)} />
        <StatCard label="Missed" value={String(totals.missed)} />
        <StatCard label="Skipped" value={String(totals.skipped)} />
      </div>

      <div className="card p-4">
        <h3 className="text-sm font-medium mb-4">Weekly Plan Follow-through</h3>
        {chartData.length === 0 || totals.planned === 0 ? (
          <p className="text-muted text-sm">No planned sessions for this period.</p>
        ) : (
          <div className="h-44">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1F1F1F" />
                <XAxis dataKey="week" tick={{ fill: "#666", fontSize: 10 }} tickLine={false} />
                <YAxis allowDecimals={false} tick={{ fill: "#666", fontSize: 10 }} tickLine={false} axisLine={false} />
                <Tooltip {...CHART_TOOLTIP_PROPS} />
                <Bar dataKey="completed" stackId="a" fill="var(--accent, #3B82F6)" radius={[2, 2, 0, 0]} />
                <Bar dataKey="missed" stackId="a" fill="#ef4444" radius={[2, 2, 0, 0]} />
                <Bar dataKey="pending" stackId="a" fill="#6b7280" radius={[2, 2, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {latest && currentWeekDays.length > 0 && (
        <div className="card p-4">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-sm font-medium">Current Week</h3>
            <span className="rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1 text-xs text-white/55">
              {currentWeekLabel}
            </span>
          </div>
          <div className="overflow-hidden rounded-lg border border-white/10">
            {currentWeekDays.map((day, index) => {
              const isToday = day.date === todayStr;

              return (
                <div
                  key={day.date}
                  className={`grid grid-cols-[3.75rem_1fr] gap-3 px-3 py-3 text-sm sm:grid-cols-[4.75rem_1fr] ${
                    index > 0 ? "border-t border-white/10" : ""
                  } ${isToday ? "bg-[rgba(var(--accent-rgb),0.09)]" : "bg-white/[0.025]"}`}
                >
                  <div className="pt-0.5">
                    <div className={`font-medium ${isToday ? "text-accent" : "text-white/70"}`}>
                      {isToday ? "Today" : day.weekday}
                    </div>
                    <div className="mt-1 text-xs text-white/35">{day.date.slice(5)}</div>
                  </div>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {day.workout ? <SlotCell item={day.workout} /> : <RestCell kind="Workout" />}
                    {day.cardio ? <SlotCell item={day.cardio} /> : <RestCell kind="Cardio" />}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

type CurrentWeekSlot = AdherenceWeek["slots"][number];

const STATUS_STYLES: Record<CurrentWeekSlot["status"], { shell: string; badge: string }> = {
  completed: {
    shell: "border-green-500/25 bg-green-500/[0.08]",
    badge: "border-green-500/25 bg-green-500/[0.12] text-green-300",
  },
  swapped: {
    shell: "border-blue-500/25 bg-blue-500/[0.08]",
    badge: "border-blue-500/25 bg-blue-500/[0.12] text-blue-300",
  },
  missed: {
    shell: "border-red-500/25 bg-red-500/[0.08]",
    badge: "border-red-500/25 bg-red-500/[0.12] text-red-300",
  },
  skipped: {
    shell: "border-white/10 bg-white/[0.03]",
    badge: "border-white/10 bg-white/[0.04] text-white/40",
  },
  pending: {
    shell: "border-white/10 bg-black/20",
    badge: "border-white/10 bg-white/[0.04] text-white/45",
  },
};

function groupSlotsByDay(slots: AdherenceWeek["slots"]) {
  const days = new Map<string, { date: string; weekday: string; workout: CurrentWeekSlot | null; cardio: CurrentWeekSlot | null }>();

  for (const item of slots) {
    const { slot } = item;
    const weekday = new Intl.DateTimeFormat("en-US", { weekday: "short", timeZone: "UTC" }).format(
      new Date(`${slot.date}T12:00:00Z`)
    );

    const existing = days.get(slot.date) ?? { date: slot.date, weekday, workout: null, cardio: null };
    existing[slot.kind] = item;
    days.set(slot.date, existing);
  }

  return Array.from(days.values()).sort((a, b) => a.date.localeCompare(b.date));
}

function SlotCell({ item }: { item: CurrentWeekSlot }) {
  const styles = STATUS_STYLES[item.status];
  const kindLabel = item.slot.kind === "workout" ? "Workout" : "Cardio";
  const showStatusBadge = item.status !== "skipped";

  return (
    <div className={`min-h-14 rounded-md border px-3 py-2 ${styles.shell}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-[10px] font-medium uppercase tracking-[0.16em] text-white/35">{kindLabel}</div>
          <div className="mt-1 truncate text-sm font-medium text-white/80">{item.slot.effective?.name ?? "Skipped"}</div>
        </div>
        {showStatusBadge && (
          <span className={`shrink-0 rounded-full border px-2 py-0.5 text-[11px] capitalize ${styles.badge}`}>
            {item.status}
          </span>
        )}
      </div>
    </div>
  );
}

function RestCell({ kind }: { kind: "Workout" | "Cardio" }) {
  return (
    <div className="min-h-14 rounded-md border border-white/10 bg-white/[0.02] px-3 py-2">
      <div className="text-[10px] font-medium uppercase tracking-[0.16em] text-white/25">{kind}</div>
      <div className="mt-1 text-sm font-medium text-white/40">Rest</div>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="card p-3 flex flex-col gap-1">
      <span className="text-xs text-muted">{label}</span>
      <span className="text-base font-semibold leading-tight">{value}</span>
    </div>
  );
}
