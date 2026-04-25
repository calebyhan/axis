"use client";

import { useEffect, useState } from "react";
import {
  AreaChart,
  Area,
  ComposedChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ReferenceArea,
  ResponsiveContainer,
} from "recharts";
import type { Units } from "@/types";
import type { HRZone } from "@/app/api/strava/zones/route";

type Point = { t: number; [key: string]: number | null };

// Zones are athlete-level, not activity-level — cache across component instances
let zonesPromise: Promise<HRZone[] | null> | null = null;

interface StreamsData {
  points: Point[];
  available: string[];
}

function mpsToMinPerUnit(mps: number, units: Units): number {
  if (mps <= 0) return 0;
  const mPerUnit = units === "imperial" ? 1609.34 : 1000;
  return mPerUnit / mps / 60;
}

function formatPaceLabel(minPerUnit: number): string {
  const m = Math.floor(minPerUnit);
  const s = Math.round((minPerUnit - m) * 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

function formatTime(secs: number): string {
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  const s = secs % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  return `${m}:${String(s).padStart(2, "0")}`;
}

const CHART_ACCENT = "var(--accent)";
const CHART_HEIGHT = 140;

// Zone 1–5 fill colors (subtle, dark-mode-friendly)
const ZONE_COLORS = ["#6b7280", "#3b82f6", "#22c55e", "#f97316", "#ef4444"];

function ChartSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-xs text-muted uppercase tracking-wider mb-2">{title}</div>
      {children}
    </div>
  );
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function ChartTooltip({ active, payload, labelFormatter, valueFormatter }: any) {
  if (!active || !payload?.length) return null;
  const value = payload[0]?.value;
  if (value == null) return null;
  return (
    <div className="bg-[#1a1a1a] border border-white/10 rounded-lg px-2.5 py-1.5 text-xs">
      <div className="text-muted">{labelFormatter?.(payload[0]?.payload?.t)}</div>
      <div className="font-medium text-white">{valueFormatter?.(value)}</div>
    </div>
  );
}

export function RunStreams({
  stravaActivityId,
  units,
}: {
  stravaActivityId: number;
  units: Units;
}) {
  const [data, setData] = useState<StreamsData | null>(null);
  const [hrZones, setHrZones] = useState<HRZone[] | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!zonesPromise) {
      zonesPromise = fetch("/api/strava/zones")
        .then((r) => r.json())
        .then((z) => z.hr ?? null)
        .catch(() => null);
    }

    Promise.all([
      fetch(`/api/strava/streams/${stravaActivityId}`).then((r) => r.json()),
      zonesPromise,
    ])
      .then(([streams, zones]) => {
        setData(streams);
        setHrZones(zones);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [stravaActivityId]);

  if (loading) return <div className="text-sm text-muted py-4 text-center">Loading charts…</div>;
  if (!data || data.points.length === 0) return null;

  const { points, available } = data;
  const hasHR = available.includes("heartrate");
  const hasAlt = available.includes("altitude");
  const hasGrade = available.includes("grade_smooth");
  const hasPace = available.includes("velocity_smooth");
  const hasCadence = available.includes("cadence");
  const hasPower = available.includes("watts");

  const pacePoints = hasPace
    ? points.map((p) => ({
        ...p,
        pace:
          p.velocity_smooth && p.velocity_smooth > 0.5
            ? Math.min(mpsToMinPerUnit(p.velocity_smooth, units), 20)
            : null,
      }))
    : [];

  const paceUnit = units === "imperial" ? "min/mi" : "min/km";

  // Altitude domain for grade overlay scaling
  const altValues = hasAlt ? points.map((p) => p.altitude).filter((v): v is number => v != null) : [];
  const altMin = altValues.length ? Math.min(...altValues) : 0;
  const altMax = altValues.length ? Math.max(...altValues) : 100;

  // HR zone reference areas — using the athlete's own zones when available
  const hrMin = hasHR
    ? Math.min(...points.map((p) => p.heartrate ?? 999).filter((v) => v !== 999)) - 5
    : 0;
  const hrMax = hasHR
    ? Math.max(...points.map((p) => p.heartrate ?? 0)) + 5
    : 220;

  const zoneAreas = hrZones
    ? hrZones.map((z, i) => ({
        y1: z.min,
        y2: z.max === -1 ? 220 : z.max,
        fill: ZONE_COLORS[i] ?? ZONE_COLORS[4],
      }))
    : null;

  return (
    <div className="flex flex-col gap-5">
      {/* Elevation + grade overlay */}
      {hasAlt && (
        <ChartSection title="Elevation">
          <ResponsiveContainer width="100%" height={CHART_HEIGHT}>
            <ComposedChart data={points} margin={{ top: 4, right: hasGrade ? 28 : 0, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="altGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={CHART_ACCENT} stopOpacity={0.25} />
                  <stop offset="95%" stopColor={CHART_ACCENT} stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis dataKey="t" hide />
              <YAxis
                yAxisId="alt"
                tick={{ fill: "#666", fontSize: 10 }}
                tickLine={false}
                axisLine={false}
                domain={[altMin - 5, altMax + 5]}
              />
              {hasGrade && (
                <YAxis
                  yAxisId="grade"
                  orientation="right"
                  tick={{ fill: "#666", fontSize: 10 }}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(v) => `${v}%`}
                  domain={[-20, 20]}
                />
              )}
              <Tooltip
                content={
                  <ChartTooltip
                    labelFormatter={(t: number) => formatTime(t)}
                    valueFormatter={(v: number) => `${Math.round(v)} m`}
                  />
                }
              />
              <Area
                yAxisId="alt"
                type="monotone"
                dataKey="altitude"
                stroke={CHART_ACCENT}
                strokeWidth={1.5}
                fill="url(#altGrad)"
                dot={false}
                connectNulls
              />
              {hasGrade && (
                <Line
                  yAxisId="grade"
                  type="monotone"
                  dataKey="grade_smooth"
                  stroke="#f97316"
                  strokeWidth={1}
                  dot={false}
                  connectNulls
                  opacity={0.6}
                />
              )}
            </ComposedChart>
          </ResponsiveContainer>
          {hasGrade && (
            <div className="flex items-center gap-3 mt-1 text-[10px] text-muted">
              <span className="flex items-center gap-1">
                <span className="inline-block w-3 h-0.5 bg-accent opacity-80" /> Elevation
              </span>
              <span className="flex items-center gap-1">
                <span className="inline-block w-3 h-0.5 bg-orange-400 opacity-60" /> Grade %
              </span>
            </div>
          )}
        </ChartSection>
      )}

      {/* HR with zone bands */}
      {hasHR && (
        <ChartSection title={`Heart Rate${hrZones ? " (zones)" : ""}`}>
          <ResponsiveContainer width="100%" height={CHART_HEIGHT}>
            <AreaChart data={points} margin={{ top: 4, right: 0, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="hrGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#f87171" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#f87171" stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis dataKey="t" hide />
              <YAxis
                tick={{ fill: "#666", fontSize: 10 }}
                tickLine={false}
                axisLine={false}
                domain={[hrMin, hrMax]}
              />
              {/* Zone bands rendered behind the line */}
              {zoneAreas?.map((z, i) => (
                <ReferenceArea
                  key={i}
                  y1={z.y1}
                  y2={z.y2}
                  fill={z.fill}
                  fillOpacity={0.08}
                  strokeOpacity={0}
                />
              ))}
              <Tooltip
                content={
                  <ChartTooltip
                    labelFormatter={(t: number) => formatTime(t)}
                    valueFormatter={(v: number) => `${Math.round(v)} bpm`}
                  />
                }
              />
              <Area
                type="monotone"
                dataKey="heartrate"
                stroke="#f87171"
                strokeWidth={1.5}
                fill="url(#hrGrad)"
                dot={false}
                connectNulls
              />
            </AreaChart>
          </ResponsiveContainer>
          {zoneAreas && (
            <div className="flex items-center gap-3 mt-1 flex-wrap text-[10px] text-muted">
              {zoneAreas.map((z, i) => (
                <span key={i} className="flex items-center gap-1">
                  <span
                    className="inline-block w-2 h-2 rounded-sm"
                    style={{ background: ZONE_COLORS[i], opacity: 0.7 }}
                  />
                  Z{i + 1} {hrZones![i].min}–{hrZones![i].max === -1 ? "max" : hrZones![i].max}
                </span>
              ))}
            </div>
          )}
        </ChartSection>
      )}

      {/* Pace */}
      {hasPace && (
        <ChartSection title={`Pace (${paceUnit})`}>
          <ResponsiveContainer width="100%" height={CHART_HEIGHT}>
            <AreaChart data={pacePoints} margin={{ top: 4, right: 0, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="paceGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#a78bfa" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#a78bfa" stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis dataKey="t" hide />
              <YAxis
                tick={{ fill: "#666", fontSize: 10 }}
                tickLine={false}
                axisLine={false}
                reversed
                tickFormatter={formatPaceLabel}
                domain={["dataMin - 0.3", "dataMax + 0.3"]}
              />
              <Tooltip
                content={
                  <ChartTooltip
                    labelFormatter={(t: number) => formatTime(t)}
                    valueFormatter={(v: number) => formatPaceLabel(v)}
                  />
                }
              />
              <Area
                type="monotone"
                dataKey="pace"
                stroke="#a78bfa"
                strokeWidth={1.5}
                fill="url(#paceGrad)"
                dot={false}
                connectNulls
              />
            </AreaChart>
          </ResponsiveContainer>
        </ChartSection>
      )}

      {/* Cadence */}
      {hasCadence && (
        <ChartSection title="Cadence (spm)">
          <ResponsiveContainer width="100%" height={CHART_HEIGHT}>
            <AreaChart data={points} margin={{ top: 4, right: 0, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="cadGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#34d399" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#34d399" stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis dataKey="t" hide />
              <YAxis
                tick={{ fill: "#666", fontSize: 10 }}
                tickLine={false}
                axisLine={false}
                domain={["dataMin - 5", "dataMax + 5"]}
              />
              <Tooltip
                content={
                  <ChartTooltip
                    labelFormatter={(t: number) => formatTime(t)}
                    valueFormatter={(v: number) => `${Math.round(v * 2)} spm`}
                  />
                }
              />
              <Area
                type="monotone"
                dataKey="cadence"
                stroke="#34d399"
                strokeWidth={1.5}
                fill="url(#cadGrad)"
                dot={false}
                connectNulls
              />
            </AreaChart>
          </ResponsiveContainer>
        </ChartSection>
      )}

      {/* Power */}
      {hasPower && (
        <ChartSection title="Power (W)">
          <ResponsiveContainer width="100%" height={CHART_HEIGHT}>
            <AreaChart data={points} margin={{ top: 4, right: 0, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="pwrGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#fbbf24" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#fbbf24" stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis dataKey="t" hide />
              <YAxis tick={{ fill: "#666", fontSize: 10 }} tickLine={false} axisLine={false} />
              <Tooltip
                content={
                  <ChartTooltip
                    labelFormatter={(t: number) => formatTime(t)}
                    valueFormatter={(v: number) => `${Math.round(v)} W`}
                  />
                }
              />
              <Area
                type="monotone"
                dataKey="watts"
                stroke="#fbbf24"
                strokeWidth={1.5}
                fill="url(#pwrGrad)"
                dot={false}
                connectNulls
              />
            </AreaChart>
          </ResponsiveContainer>
        </ChartSection>
      )}
    </div>
  );
}
