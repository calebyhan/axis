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
import type { PlannedSlotKind } from "@/lib/planner";

interface Props {
  adherence: AdherenceWeek[];
}

export default function PlanTab({ adherence }: Props) {
  const latest = adherence[adherence.length - 1] ?? null;
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
          <h3 className="text-sm font-medium mb-3">Current Week</h3>
          <div className="overflow-hidden rounded-lg border border-white/10">
            {currentWeekDays.map((day, index) => (
              <div
                key={day.date}
                className={`grid gap-3 bg-white/[0.025] px-3 py-3 text-sm md:grid-cols-[5rem_1fr_1fr] ${
                  index > 0 ? "border-t border-white/10" : ""
                }`}
              >
                <div className="flex items-center justify-between gap-2 md:block">
                  <div className="font-medium text-white/70">{day.weekday}</div>
                  <div className="text-xs text-white/35 md:mt-1">{day.date.slice(5)}</div>
                </div>
                <SlotCell kind="workout" item={day.workout} />
                <SlotCell kind="cardio" item={day.cardio} />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

type CurrentWeekSlot = AdherenceWeek["slots"][number];

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

function SlotCell({ kind, item }: { kind: PlannedSlotKind; item: CurrentWeekSlot | null }) {
  if (!item) {
    return (
      <div className="flex min-h-12 items-center justify-between rounded-md border border-white/[0.06] px-3 text-white/25">
        <span className="text-[10px] uppercase tracking-[0.18em]">{kind}</span>
        <span className="text-xs">—</span>
      </div>
    );
  }

  const statusClass = {
    completed: "text-green-400",
    swapped: "text-blue-400",
    missed: "text-red-400",
    skipped: "text-white/35",
    pending: "text-white/45",
  }[item.status];

  return (
    <div className="flex min-h-12 items-center justify-between gap-3 rounded-md border border-white/[0.08] bg-black/20 px-3">
      <div className="min-w-0">
        <div className="text-[10px] uppercase tracking-[0.18em] text-white/35">{kind}</div>
        <div className="mt-0.5 truncate text-white/75">{item.slot.effective?.name ?? "Skipped"}</div>
      </div>
      <span className={`shrink-0 text-xs capitalize ${statusClass}`}>{item.status}</span>
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
