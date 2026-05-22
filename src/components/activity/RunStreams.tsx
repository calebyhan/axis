"use client";

import { use, type ReactNode } from "react";
import useSWR from "swr";
import type { HRZone, HRZoneSource } from "@/lib/hr-zones";
import {
  DEFAULT_PACE_ZONES,
  PACE_ZONE_NAMES,
  formatPaceSeconds,
  paceSecondsPerKmToUnitSeconds,
  paceUnitSecondsToSecondsPerKm,
  type PaceZone,
  type PaceZoneSource,
} from "@/lib/pace-zones";
import type { Units } from "@/types";

type Point = { t: number; [key: string]: number | null };

type HRZoneArea = {
  label: string;
  min: number;
  max: number;
  y1: number;
  y2: number;
  fill: string;
  range: string;
};

type ZoneDurationDatum = {
  label: string;
  name: string;
  range: string;
  seconds: number;
  percent: number;
  color: string;
};

type PaceZoneArea = {
  label: string;
  min: number;
  max: number;
  y1: number;
  y2: number;
  color: string;
  range: string;
};

interface StreamsData {
  points: Point[];
  available: string[];
}

// Dynamic import - avoids bundling recharts in the initial chunk
const rechartsModule = import("recharts");

const fetcher = async (url: string) => {
  const res = await fetch(url);
  const body = await res.json().catch(() => null);
  if (!res.ok) {
    throw new Error(body?.error ?? "Failed to load streams");
  }
  return body;
};

function mpsToMinPerUnit(mps: number, units: Units): number {
  if (mps <= 0) return 0;
  const mPerUnit = units === "imperial" ? 1609.34 : 1000;
  return mPerUnit / mps / 60;
}

function formatPaceLabel(minPerUnit: number): string {
  const totalSeconds = Math.max(0, Math.round(minPerUnit * 60));
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
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
const ZONE_COLORS = ["#64748b", "#38bdf8", "#22c55e", "#f59e0b", "#ef4444", "#a855f7"];

function finiteNumber(value: number | null | undefined): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function streamIntervalSeconds(points: Point[], index: number): number {
  const next = points[index + 1];
  if (!next) return 0;

  const delta = next.t - points[index].t;
  return Number.isFinite(delta) && delta > 0 ? delta : 0;
}

function formatDurationCompact(seconds: number): string {
  const rounded = Math.round(seconds);
  if (rounded < 60) return `${rounded}s`;

  const totalMinutes = Math.round(rounded / 60);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours > 0) return minutes > 0 ? `${hours}h ${minutes}m` : `${hours}h`;
  return `${totalMinutes}m`;
}

function paceFromPoint(point: Point, units: Units): number | null {
  const velocity = point.velocity_smooth;
  if (!finiteNumber(velocity) || velocity <= 0.5) return null;
  return mpsToMinPerUnit(velocity, units);
}

function paceSecondsPerKmFromPoint(point: Point): number | null {
  const velocity = point.velocity_smooth;
  if (!finiteNumber(velocity) || velocity <= 0.5) return null;
  return 1000 / velocity;
}

function hrZoneRange(zone: HRZone): string {
  return zone.max === -1 ? `${zone.min}+` : `${zone.min}-${zone.max}`;
}

function findHRZoneIndex(value: number, zones: HRZone[]): number {
  return zones.findIndex((zone, index) => {
    const isLast = index === zones.length - 1;
    return value >= zone.min && (zone.max === -1 || value < zone.max || (isLast && value <= zone.max));
  });
}

function buildHRZoneAreas(hrZones: HRZone[] | null, hrMin: number, hrMax: number): HRZoneArea[] | null {
  if (!hrZones?.length) return null;

  return hrZones.map((zone, index) => {
    const max = zone.max === -1 ? hrMax : zone.max;
    return {
      label: `Z${index + 1}`,
      min: zone.min,
      max,
      y1: Math.max(zone.min, hrMin),
      y2: Math.min(max, hrMax),
      fill: ZONE_COLORS[index] ?? ZONE_COLORS[ZONE_COLORS.length - 1],
      range: hrZoneRange(zone),
    };
  });
}

function buildHRZoneDurations(points: Point[], hrZones: HRZone[] | null): ZoneDurationDatum[] | null {
  if (!hrZones?.length) return null;

  const durations = hrZones.map((zone, index) => ({
    label: `Z${index + 1}`,
    name: `Zone ${index + 1}`,
    range: `${hrZoneRange(zone)} bpm`,
    seconds: 0,
    color: ZONE_COLORS[index] ?? ZONE_COLORS[ZONE_COLORS.length - 1],
  }));

  for (let index = 0; index < points.length - 1; index += 1) {
    const heartrate = points[index].heartrate;
    if (!finiteNumber(heartrate)) continue;

    const zoneIndex = findHRZoneIndex(heartrate, hrZones);
    if (zoneIndex === -1) continue;

    durations[zoneIndex].seconds += streamIntervalSeconds(points, index);
  }

  const totalSeconds = durations.reduce((sum, zone) => sum + zone.seconds, 0);
  if (totalSeconds <= 0) return null;

  return durations.map((zone) => ({
    ...zone,
    percent: (zone.seconds / totalSeconds) * 100,
  }));
}

function findPaceZoneIndex(value: number, zones: PaceZone[]): number {
  return zones.findIndex((zone) => value >= zone.min && (zone.max === -1 || value < zone.max));
}

function paceZoneRange(zone: PaceZone, units: Units): string {
  const min = formatPaceSeconds(paceSecondsPerKmToUnitSeconds(zone.min, units));
  if (zone.max === -1) return `${min}+`;

  const max = formatPaceSeconds(paceSecondsPerKmToUnitSeconds(zone.max, units));
  if (zone.min <= 0) return `<${max}`;
  return `${min}-${max}`;
}

function buildPaceZoneAreas(
  paceZones: PaceZone[] | null,
  paceMin: number,
  paceMax: number,
  units: Units,
): PaceZoneArea[] | null {
  if (!paceZones?.length) return null;

  return paceZones.map((zone, index) => {
    const min = paceSecondsPerKmToUnitSeconds(zone.min, units) / 60;
    const max = zone.max === -1 ? paceMax : paceSecondsPerKmToUnitSeconds(zone.max, units) / 60;
    return {
      label: `Z${index + 1}`,
      min,
      max,
      y1: Math.max(min, paceMin),
      y2: Math.min(max, paceMax),
      color: ZONE_COLORS[index] ?? ZONE_COLORS[ZONE_COLORS.length - 1],
      range: paceZoneRange(zone, units),
    };
  });
}

function buildPaceZoneDurations(
  points: Point[],
  units: Units,
  paceZones: PaceZone[] | null,
): ZoneDurationDatum[] | null {
  if (!paceZones?.length) return null;

  let totalSeconds = 0;
  const durations = paceZones.map((zone, index) => ({
    label: `Z${index + 1}`,
    name: PACE_ZONE_NAMES[index] ?? `Zone ${index + 1}`,
    range: `${paceZoneRange(zone, units)} ${units === "imperial" ? "min/mi" : "min/km"}`,
    seconds: 0,
    color: ZONE_COLORS[index] ?? ZONE_COLORS[ZONE_COLORS.length - 1],
  }));

  for (let index = 0; index < points.length - 1; index += 1) {
    const pace = paceSecondsPerKmFromPoint(points[index]);
    const seconds = streamIntervalSeconds(points, index);
    if (pace == null || seconds <= 0) continue;

    totalSeconds += seconds;

    const zoneIndex = findPaceZoneIndex(pace, paceZones);
    if (zoneIndex === -1) continue;
    durations[zoneIndex].seconds += seconds;
  }

  if (totalSeconds <= 0) return null;

  return durations.map((zone) => ({
    ...zone,
    percent: (zone.seconds / totalSeconds) * 100,
  }));
}

function ChartSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div>
      <div className="text-xs text-muted uppercase tracking-wider mb-2">{title}</div>
      {children}
    </div>
  );
}

type ChartTooltipPayload = {
  value?: number | null;
  payload?: Point;
};

function ChartTooltip({
  active,
  payload,
  labelFormatter,
  valueFormatter,
  detailFormatter,
}: {
  active?: boolean;
  payload?: ChartTooltipPayload[];
  labelFormatter?: (value: number) => string;
  valueFormatter?: (value: number, point?: Point) => ReactNode;
  detailFormatter?: (value: number, point?: Point) => ReactNode;
}) {
  if (!active || !payload?.length) return null;
  const value = payload[0]?.value;
  if (value == null) return null;
  const point = payload[0]?.payload;
  const detail = detailFormatter?.(value, point);

  return (
    <div className="bg-[#1a1a1a] border border-white/10 rounded-lg px-2.5 py-1.5 text-xs">
      <div className="text-muted">{point?.t != null ? labelFormatter?.(point.t) : null}</div>
      <div className="font-medium text-white">{valueFormatter?.(value, point)}</div>
      {detail && <div className="mt-0.5 text-[10px] text-muted">{detail}</div>}
    </div>
  );
}

function ElevationChart({ points, hasGrade, altMin, altMax }: { points: Point[]; hasGrade: boolean; altMin: number; altMax: number }) {
  const { ComposedChart, Area, Line, XAxis, YAxis, Tooltip, CartesianGrid, ResponsiveContainer } = use(rechartsModule);
  return (
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
          <CartesianGrid stroke="#1f1f1f" vertical={false} />
          <YAxis yAxisId="alt" tick={{ fill: "#666", fontSize: 10 }} tickLine={false} axisLine={false} domain={[altMin - 5, altMax + 5]} />
          {hasGrade && <YAxis yAxisId="grade" orientation="right" tick={{ fill: "#666", fontSize: 10 }} tickLine={false} axisLine={false} tickFormatter={(v) => `${v}%`} domain={[-20, 20]} />}
          <Tooltip content={<ChartTooltip labelFormatter={(t: number) => formatTime(t)} valueFormatter={(v: number) => `${Math.round(v)} m`} />} />
          <Area yAxisId="alt" type="monotone" dataKey="altitude" stroke={CHART_ACCENT} strokeWidth={1.5} fill="url(#altGrad)" dot={false} connectNulls />
          {hasGrade && <Line yAxisId="grade" type="monotone" dataKey="grade_smooth" stroke="#f97316" strokeWidth={1} dot={false} connectNulls opacity={0.6} />}
        </ComposedChart>
      </ResponsiveContainer>
      {hasGrade && (
        <div className="flex items-center gap-3 mt-1 text-[10px] text-muted">
          <span className="flex items-center gap-1"><span className="inline-block w-3 h-0.5 bg-accent opacity-80" /> Elevation</span>
          <span className="flex items-center gap-1"><span className="inline-block w-3 h-0.5 bg-orange-400 opacity-60" /> Grade %</span>
        </div>
      )}
    </ChartSection>
  );
}

function HRChart({
  points,
  hrMin,
  hrMax,
  hrZones,
  zoneAreas,
}: {
  points: Point[];
  hrMin: number;
  hrMax: number;
  hrZones: HRZone[] | null;
  zoneAreas: HRZoneArea[] | null;
}) {
  const { AreaChart, Area, XAxis, YAxis, Tooltip, ReferenceArea, ReferenceLine, CartesianGrid, ResponsiveContainer } = use(rechartsModule);
  const visibleAreas = zoneAreas?.filter((zone) => zone.y2 > zone.y1) ?? [];
  return (
    <ChartSection title={`Heart Rate${hrZones ? " (zones)" : ""}`}>
      <ResponsiveContainer width="100%" height={CHART_HEIGHT}>
        <AreaChart data={points} margin={{ top: 4, right: 6, left: -20, bottom: 0 }}>
          <defs>
            <linearGradient id="hrGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#f87171" stopOpacity={0.36} />
              <stop offset="95%" stopColor="#f87171" stopOpacity={0} />
            </linearGradient>
          </defs>
          <XAxis dataKey="t" hide />
          <CartesianGrid stroke="#1f1f1f" vertical={false} />
          <YAxis tick={{ fill: "#777", fontSize: 10 }} tickLine={false} axisLine={false} domain={[hrMin, hrMax]} />
          {visibleAreas.map((zone) => (
            <ReferenceArea key={`zone-area-${zone.label}`} y1={zone.y1} y2={zone.y2} fill={zone.fill} fillOpacity={0.16} strokeOpacity={0} />
          ))}
          {zoneAreas?.map((zone) => (
            zone.max < hrMax && zone.max > hrMin
              ? <ReferenceLine key={`zone-line-${zone.label}`} y={zone.max} stroke={zone.fill} strokeOpacity={0.55} strokeDasharray="3 3" />
              : null
          ))}
          <Tooltip
            content={(
              <ChartTooltip
                labelFormatter={(t: number) => formatTime(t)}
                valueFormatter={(v: number) => `${Math.round(v)} bpm`}
                detailFormatter={(v: number) => {
                  if (!hrZones) return null;
                  const zoneIndex = findHRZoneIndex(v, hrZones);
                  return zoneIndex >= 0 ? `Zone ${zoneIndex + 1}` : null;
                }}
              />
            )}
          />
          <Area type="monotone" dataKey="heartrate" stroke="#fecaca" strokeWidth={2} fill="url(#hrGrad)" dot={false} connectNulls />
        </AreaChart>
      </ResponsiveContainer>
    </ChartSection>
  );
}

function PaceChart({
  points,
  units,
  paceZones,
  zoneAreas,
}: {
  points: Point[];
  units: Units;
  paceZones: PaceZone[] | null;
  zoneAreas: PaceZoneArea[] | null;
}) {
  const { AreaChart, Area, XAxis, YAxis, Tooltip, ReferenceArea, ReferenceLine, CartesianGrid, ResponsiveContainer } = use(rechartsModule);
  const paceUnit = units === "imperial" ? "min/mi" : "min/km";
  const pacePoints = points.map((p) => {
    const pace = paceFromPoint(p, units);
    return {
      ...p,
      pace: pace == null ? null : Math.min(pace, 20),
    };
  });
  return (
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
          <CartesianGrid stroke="#1f1f1f" vertical={false} />
          <YAxis tick={{ fill: "#777", fontSize: 10 }} tickLine={false} axisLine={false} reversed tickFormatter={formatPaceLabel} domain={["dataMin - 0.3", "dataMax + 0.3"]} />
          {zoneAreas?.filter((zone) => zone.y2 > zone.y1).map((zone) => (
            <ReferenceArea key={`pace-zone-area-${zone.label}`} y1={zone.y1} y2={zone.y2} fill={zone.color} fillOpacity={0.14} strokeOpacity={0} />
          ))}
          {zoneAreas?.map((zone) => (
            zone.min > 0 && zone.min >= zone.y1 && zone.min <= zone.y2
              ? <ReferenceLine key={`pace-zone-line-${zone.label}`} y={zone.min} stroke={zone.color} strokeOpacity={0.5} strokeDasharray="3 3" />
              : null
          ))}
          <Tooltip
            content={(
              <ChartTooltip
                labelFormatter={(t: number) => formatTime(t)}
                valueFormatter={(v: number) => formatPaceLabel(v)}
                detailFormatter={(v: number) => {
                  if (!paceZones) return null;
                  const secondsPerKm = paceUnitSecondsToSecondsPerKm(v * 60, units);
                  const zoneIndex = findPaceZoneIndex(secondsPerKm, paceZones);
                  return zoneIndex >= 0 ? `Zone ${zoneIndex + 1}` : null;
                }}
              />
            )}
          />
          <Area type="monotone" dataKey="pace" stroke="#c4b5fd" strokeWidth={2} fill="url(#paceGrad)" dot={false} connectNulls />
        </AreaChart>
      </ResponsiveContainer>
    </ChartSection>
  );
}

function ZoneDurationChart({ title, data }: { title: string; data: ZoneDurationDatum[] }) {
  return (
    <ChartSection title={title}>
      <div className="flex flex-col gap-2.5">
        {data.map((zone) => (
          <div key={zone.label} className="grid grid-cols-[2.75rem_minmax(0,1fr)_4.25rem] items-center gap-2">
            <div className="flex items-center gap-1.5 text-[11px] font-medium text-white/80">
              <span className="size-2 shrink-0 rounded-sm" style={{ background: zone.color }} />
              <span>{zone.label}</span>
            </div>
            <div className="min-w-0">
              <div className="mb-1 flex min-w-0 items-center justify-between gap-2 text-[10px]">
                <span className="truncate text-white/65">{zone.name}</span>
                <span className="shrink-0 text-muted">{zone.range}</span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-white/[0.06]">
                <div
                  className="h-full rounded-full"
                  style={{
                    width: zone.seconds > 0 ? `${Math.max(zone.percent, 2)}%` : "0%",
                    background: zone.color,
                  }}
                />
              </div>
            </div>
            <div className="text-right tabular-nums">
              <div className="text-[11px] font-medium text-white/85">{formatDurationCompact(zone.seconds)}</div>
              <div className="text-[10px] text-muted">{Math.round(zone.percent)}%</div>
            </div>
          </div>
        ))}
      </div>
    </ChartSection>
  );
}

function CadenceChart({ points }: { points: Point[] }) {
  const { AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid, ResponsiveContainer } = use(rechartsModule);
  return (
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
          <CartesianGrid stroke="#1f1f1f" vertical={false} />
          <YAxis tick={{ fill: "#666", fontSize: 10 }} tickLine={false} axisLine={false} domain={["dataMin - 5", "dataMax + 5"]} />
          <Tooltip content={<ChartTooltip labelFormatter={(t: number) => formatTime(t)} valueFormatter={(v: number) => `${Math.round(v * 2)} spm`} />} />
          <Area type="monotone" dataKey="cadence" stroke="#34d399" strokeWidth={1.5} fill="url(#cadGrad)" dot={false} connectNulls />
        </AreaChart>
      </ResponsiveContainer>
    </ChartSection>
  );
}

function PowerChart({ points }: { points: Point[] }) {
  const { AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid, ResponsiveContainer } = use(rechartsModule);
  return (
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
          <CartesianGrid stroke="#1f1f1f" vertical={false} />
          <YAxis tick={{ fill: "#666", fontSize: 10 }} tickLine={false} axisLine={false} />
          <Tooltip content={<ChartTooltip labelFormatter={(t: number) => formatTime(t)} valueFormatter={(v: number) => `${Math.round(v)} W`} />} />
          <Area type="monotone" dataKey="watts" stroke="#fbbf24" strokeWidth={1.5} fill="url(#pwrGrad)" dot={false} connectNulls />
        </AreaChart>
      </ResponsiveContainer>
    </ChartSection>
  );
}

export function RunStreams({
  stravaActivityId,
  units,
}: {
  stravaActivityId: number;
  units: Units;
}) {
  const { data: streamData, error, isLoading, mutate } = useSWR<StreamsData>(`/api/strava/streams/${stravaActivityId}`, fetcher);
  const { data: zonesData } = useSWR<{
    hr?: HRZone[] | null;
    source?: HRZoneSource;
    pace?: PaceZone[] | null;
    paceSource?: PaceZoneSource;
  }>("/api/strava/zones", fetcher);

  if (isLoading) return <div className="text-sm text-muted py-4 text-center">Loading charts…</div>;
  if (error) {
    return (
      <div className="py-4 text-center">
        <p className="text-sm text-muted">Could not load stream charts.</p>
        <button type="button" onClick={() => void mutate()} className="mt-2 text-xs text-accent hover:opacity-80">
          Retry
        </button>
      </div>
    );
  }
  if (!streamData || streamData.points.length === 0) {
    return <div className="text-sm text-muted py-4 text-center">No stream data available for this activity.</div>;
  }

  const { points, available } = streamData;
  const hrZones = zonesData?.hr ?? null;
  const paceZones = zonesData?.pace ?? DEFAULT_PACE_ZONES;
  const hasHR = available.includes("heartrate");
  const hasAlt = available.includes("altitude");
  const hasGrade = available.includes("grade_smooth");
  const hasPace = available.includes("velocity_smooth");
  const hasCadence = available.includes("cadence");
  const hasPower = available.includes("watts");

  const altValues = hasAlt
    ? points.reduce<number[]>((acc, p) => { if (p.altitude != null) acc.push(p.altitude); return acc; }, [])
    : [];
  const altMin = altValues.length ? Math.min(...altValues) : 0;
  const altMax = altValues.length ? Math.max(...altValues) : 100;
  const hrValues = hasHR
    ? points.reduce<number[]>((acc, p) => { if (p.heartrate != null) acc.push(p.heartrate); return acc; }, [])
    : [];
  const hrMin = hrValues.length ? Math.max(0, Math.floor((Math.min(...hrValues) - 8) / 5) * 5) : 0;
  const hrMax = hrValues.length ? Math.ceil((Math.max(...hrValues) + 8) / 5) * 5 : 220;
  const zoneAreas = buildHRZoneAreas(hrZones, hrMin, hrMax);
  const hrZoneDurations = hasHR ? buildHRZoneDurations(points, hrZones) : null;
  const paceValues = hasPace
    ? points.reduce<number[]>((acc, p) => {
        const pace = paceFromPoint(p, units);
        if (pace != null) acc.push(Math.min(pace, 20));
        return acc;
      }, [])
    : [];
  const paceMin = paceValues.length ? Math.max(0, Math.min(...paceValues) - 0.3) : 0;
  const paceMax = paceValues.length ? Math.max(...paceValues) + 0.3 : 20;
  const paceZoneAreas = hasPace ? buildPaceZoneAreas(paceZones, paceMin, paceMax, units) : null;
  const paceZoneDurations = hasPace ? buildPaceZoneDurations(points, units, paceZones) : null;

  return (
    <div className="flex flex-col gap-5">
      {hasAlt && <ElevationChart points={points} hasGrade={hasGrade} altMin={altMin} altMax={altMax} />}
      {hasHR && <HRChart points={points} hrMin={hrMin} hrMax={hrMax} hrZones={hrZones} zoneAreas={zoneAreas} />}
      {hrZoneDurations && <ZoneDurationChart title="Time in HR Zones" data={hrZoneDurations} />}
      {hasPace && <PaceChart points={points} units={units} paceZones={paceZones} zoneAreas={paceZoneAreas} />}
      {paceZoneDurations && <ZoneDurationChart title={`Time in Pace Zones (${units === "imperial" ? "min/mi" : "min/km"})`} data={paceZoneDurations} />}
      {hasCadence && <CadenceChart points={points} />}
      {hasPower && <PowerChart points={points} />}
    </div>
  );
}
