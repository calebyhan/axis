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
import type { AdherenceWeek } from "@/lib/adherence";

const CHART_STYLE = {
  contentStyle: {
    background: "#141414",
    border: "1px solid #1F1F1F",
    borderRadius: 8,
    fontSize: 12,
  },
  labelStyle: { color: "#666" },
};

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
                <Tooltip {...CHART_STYLE} />
                <Bar dataKey="completed" stackId="a" fill="var(--accent, #3B82F6)" radius={[2, 2, 0, 0]} />
                <Bar dataKey="missed" stackId="a" fill="#ef4444" radius={[2, 2, 0, 0]} />
                <Bar dataKey="pending" stackId="a" fill="#6b7280" radius={[2, 2, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {latest && latest.slots.length > 0 && (
        <div className="card p-4">
          <h3 className="text-sm font-medium mb-3">Current Week</h3>
          <div className="flex flex-col gap-2">
            {latest.slots.map(({ slot, status }) => (
              <div key={slot.id} className="flex items-center justify-between rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-sm">
                <span className="text-white/75">{slot.effective?.name ?? "Skipped"}</span>
                <span className="capitalize text-white/45">{status}</span>
              </div>
            ))}
          </div>
        </div>
      )}
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
