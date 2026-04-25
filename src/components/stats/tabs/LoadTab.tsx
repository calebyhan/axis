"use client";

import {
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  ReferenceLine,
  Legend,
} from "recharts";
import type { TrainingLoadPoint } from "@/lib/training-load";

const CHART_STYLE = {
  contentStyle: {
    background: "#141414",
    border: "1px solid #1F1F1F",
    borderRadius: 8,
    fontSize: 12,
  },
  labelStyle: { color: "#666" },
};

function StatCard({ label, value, valueClass }: { label: string; value: string; valueClass?: string }) {
  return (
    <div className="card p-3 flex flex-col gap-1 flex-1">
      <span className="text-xs text-muted">{label}</span>
      <span className={`text-base font-semibold leading-tight ${valueClass ?? ""}`}>{value}</span>
    </div>
  );
}

interface Props {
  trainingLoad: TrainingLoadPoint[];
  latestLoad: TrainingLoadPoint | null;
  tsbInfo: { label: string; color: string } | null;
}

export default function LoadTab({ trainingLoad, latestLoad, tsbInfo }: Props) {
  return (
    <div className="flex flex-col gap-5">
      {latestLoad && tsbInfo && (
        <div className="flex gap-2">
          <StatCard label="Fitness (CTL)" value={String(latestLoad.ctl)} />
          <StatCard label="Fatigue (ATL)" value={String(latestLoad.atl)} />
          <div className="card p-3 flex flex-col gap-1 flex-1">
            <span className="text-xs text-muted">Form (TSB)</span>
            <span className={`text-base font-semibold leading-tight ${tsbInfo.color}`}>
              {latestLoad.tsb > 0 ? "+" : ""}{latestLoad.tsb} · {tsbInfo.label}
            </span>
          </div>
        </div>
      )}

      {trainingLoad.length === 0 ? (
        <div className="card p-4">
          <p className="text-muted text-sm">No training data in the last 90 days.</p>
        </div>
      ) : (
        <>
          <div className="card p-4">
            <div className="flex items-center justify-between mb-1">
              <h3 className="text-sm font-medium">Fitness & Fatigue</h3>
              <span className="text-xs text-muted">Last 90 days</span>
            </div>
            <div className="h-48">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={trainingLoad}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1F1F1F" />
                  <XAxis dataKey="date" tick={{ fill: "#666", fontSize: 10 }} tickLine={false} />
                  <YAxis tick={{ fill: "#666", fontSize: 10 }} tickLine={false} axisLine={false} />
                  <Tooltip
                    {...CHART_STYLE}
                    formatter={(v, name) => [
                      v,
                      name === "ctl" ? "Fitness (CTL)" : name === "atl" ? "Fatigue (ATL)" : name,
                    ]}
                  />
                  <Legend
                    formatter={(v) => (v === "ctl" ? "Fitness (CTL)" : v === "atl" ? "Fatigue (ATL)" : v)}
                    wrapperStyle={{ fontSize: 11, color: "#666" }}
                  />
                  <Line type="monotone" dataKey="ctl" stroke="var(--accent, #3B82F6)" strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey="atl" stroke="#f97316" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="card p-4">
            <div className="flex items-center justify-between mb-1">
              <h3 className="text-sm font-medium">Form (TSB)</h3>
              <span className="text-xs text-muted">+ fresh · − fatigued</span>
            </div>
            <div className="h-40">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={trainingLoad}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1F1F1F" />
                  <XAxis dataKey="date" tick={{ fill: "#666", fontSize: 10 }} tickLine={false} />
                  <YAxis tick={{ fill: "#666", fontSize: 10 }} tickLine={false} axisLine={false} />
                  <ReferenceLine y={0} stroke="#444" strokeDasharray="4 4" />
                  <ReferenceLine y={5} stroke="#22c55e" strokeDasharray="3 6" strokeOpacity={0.4} />
                  <ReferenceLine y={-10} stroke="#f97316" strokeDasharray="3 6" strokeOpacity={0.4} />
                  <Tooltip {...CHART_STYLE} formatter={(v) => [v, "Form (TSB)"]} />
                  <Line type="monotone" dataKey="tsb" stroke="#a855f7" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
            <div className="flex gap-4 mt-3 text-xs text-muted">
              <span className="text-green-400">+5 Fresh</span>
              <span className="text-blue-400">−10–+5 Neutral</span>
              <span className="text-orange-400">−30–−10 Fatigued</span>
              <span className="text-red-400">&lt; −30 Overreaching</span>
            </div>
          </div>

          <div className="card p-4">
            <h3 className="text-sm font-medium mb-4">Daily Training Load</h3>
            <div className="h-36">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={trainingLoad}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1F1F1F" />
                  <XAxis dataKey="date" tick={{ fill: "#666", fontSize: 10 }} tickLine={false} />
                  <YAxis tick={{ fill: "#666", fontSize: 10 }} tickLine={false} axisLine={false} />
                  <Tooltip {...CHART_STYLE} formatter={(v) => [v, "Daily TL"]} />
                  <Bar dataKey="dailyTL" fill="#6366f1" radius={[2, 2, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
