"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { ReactNode } from "react";
import { CHART_LINE_TOOLTIP_PROPS, CHART_TOOLTIP_PROPS } from "@/components/stats/chartTheme";
import { getStatsChartBucketDateKey, STATS_RANGE_LABELS, type TimeRange } from "@/lib/stats-ranges";
import type { StatsOverviewSnapshot } from "@/lib/queries/stats";
import type { StrengthBalanceSummary } from "@/lib/strength-balance";
import type { TrainingLoadPoint } from "@/lib/training-load";
import type { AdherenceWeek } from "@/lib/adherence";
import { distanceUnit, formatDistance, formatPace, formatWeight, weightUnit } from "@/lib/units";
import type { BestEffort, MuscleGroup, MuscleHeatmapDetails, Units } from "@/types";

interface WorkoutSummary {
  sessionCount: number;
  totalSets: number;
  totalVolume: number;
  topExercises: { name: string; volume: number; sets: number }[];
  muscleCoverage: Partial<Record<MuscleGroup, number>>;
  muscleDetails: MuscleHeatmapDetails;
  strengthBalance: StrengthBalanceSummary;
}

interface RunningActivity {
  id: string;
  name: string | null;
  start_time: string;
  date: string;
  distance: number | null;
  avg_pace: number | null;
  suffer_score: number | null;
  avg_heartrate?: number | null;
  duration?: number | null;
  best_efforts?: BestEffort[] | null;
}

interface RunningPersonalRecord {
  activityId: string;
  activityName: string | null;
  startTime: string;
  date: string;
  effortName: string;
  elapsedTime: number;
  distance: number;
}

interface Props {
  timeRange: TimeRange;
  units: Units;
  current: StatsOverviewSnapshot;
  previous: StatsOverviewSnapshot | null;
  workoutSummary: WorkoutSummary;
  volumeChartData: { period: string; volume: number }[];
  runningData: RunningActivity[];
  runChartData: { date: string; dist: number }[];
  bodyChartData: { date: string; body_weight: number; rolling: number }[];
  trainingLoad: TrainingLoadPoint[];
  adherence: AdherenceWeek[];
  personalRecords: RunningPersonalRecord[];
  latestLoad: TrainingLoadPoint | null;
  tsbInfo: { label: string; color: string } | null;
  trendBadge: { label: string; color: string };
}

type SignalTone = "good" | "attention" | "neutral";

interface Signal {
  tone: SignalTone;
  label: string;
  value: string;
  detail: string;
}

function summarizeAdherence(adherence: AdherenceWeek[]) {
  const totals = adherence.reduce(
    (acc, week) => {
      acc.planned += week.summary.planned;
      acc.completed += week.summary.completed + week.summary.swapped;
      acc.missed += week.summary.missed;
      acc.skipped += week.summary.skipped;
      acc.pending += week.summary.pending;
      return acc;
    },
    { planned: 0, completed: 0, missed: 0, skipped: 0, pending: 0 }
  );

  return {
    ...totals,
    rate: totals.planned > 0 ? Math.round((totals.completed / totals.planned) * 100) : null,
  };
}

function percentDelta(current: number, previous: number | null | undefined): number | null {
  if (previous === null || previous === undefined || previous === 0) return null;
  return Math.round(((current - previous) / Math.abs(previous)) * 100);
}

function deltaLabel(current: number | null, previous: number | null | undefined): string | null {
  if (current === null || previous === null || previous === undefined) return null;
  const diff = current - previous;
  if (diff === 0) return "No change";
  if (previous === 0) return "New";
  const pct = Math.round((diff / Math.abs(previous)) * 100);
  return `${pct > 0 ? "+" : ""}${pct}%`;
}

function deltaTone(current: number | null, previous: number | null | undefined, lowerIsBetter = false): string {
  if (current === null || previous === null || previous === undefined || current === previous) return "text-white/40";
  const improved = lowerIsBetter ? current < previous : current > previous;
  return improved ? "text-emerald-300" : "text-orange-300";
}

function formatElapsedTime(secs: number): string {
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  const s = Math.round(secs % 60);
  return h > 0
    ? `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`
    : `${m}:${String(s).padStart(2, "0")}`;
}

function formatDisplayWeight(value: number): string {
  return value >= 1000 ? `${(value / 1000).toFixed(1)}k` : value % 1 === 0 ? String(Math.round(value)) : value.toFixed(1);
}

function SectionHeader({ title, detail }: { title: string; detail?: string }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0">
        <h3 className="text-sm font-medium">{title}</h3>
        {detail && <p className="mt-1 text-xs text-muted">{detail}</p>}
      </div>
    </div>
  );
}

function HeaderFact({
  label,
  value,
  detail,
  valueClass = "text-white",
}: {
  label: string;
  value: string;
  detail?: string;
  valueClass?: string;
}) {
  return (
    <div className="min-w-0 border-l border-white/10 pl-3 first:border-l-0 first:pl-0 sm:pl-4">
      <div className={`truncate text-sm font-semibold leading-tight sm:text-lg ${valueClass}`}>{value}</div>
      <div className="mt-1 truncate text-[11px] text-muted">{label}</div>
      {detail && <div className="mt-0.5 truncate text-[10px] text-white/35">{detail}</div>}
    </div>
  );
}

function MetricCard({
  label,
  value,
  detail,
  delta,
  deltaClass = "text-white/40",
}: {
  label: string;
  value: string;
  detail: string;
  delta?: string | null;
  deltaClass?: string;
}) {
  return (
    <div className="card min-w-0 p-3">
      <div className="flex min-w-0 items-start justify-between gap-2">
        <span className="min-w-0 text-xs leading-snug text-muted">{label}</span>
        {delta !== undefined && <span className={`shrink-0 text-[11px] ${deltaClass}`}>{delta ?? "No prior"}</span>}
      </div>
      <div className="mt-2 break-words text-lg font-semibold leading-none sm:text-xl">{value}</div>
      <div className="mt-1 text-[11px] text-white/40">{detail}</div>
    </div>
  );
}

function NotableItem({ label, value, detail }: { label: string; value: string; detail: string }) {
  return (
    <div className="min-w-0">
      <div className="text-xs text-muted">{label}</div>
      <div className="mt-2 break-words text-base font-semibold leading-snug">{value}</div>
      <div className="mt-1 text-[11px] text-white/40">{detail}</div>
    </div>
  );
}

function DomainRow({
  label,
  value,
  detail,
  children,
}: {
  label: string;
  value: string;
  detail: string;
  children?: ReactNode;
}) {
  return (
    <div className="grid gap-3 border-t border-white/10 py-4 first:border-t-0 first:pt-0 last:pb-0 lg:grid-cols-[11rem_minmax(0,1fr)_10rem] lg:items-center">
      <div className="flex min-w-0 items-start justify-between gap-3 lg:block">
        <div className="min-w-0">
          <div className="text-sm font-medium">{label}</div>
          <div className="mt-1 text-xs text-muted">{detail}</div>
        </div>
        <div className="shrink-0 max-w-[44%] break-words text-right text-sm font-semibold lg:hidden">{value}</div>
      </div>
      <div className="min-w-0">{children}</div>
      <div className="hidden break-words text-sm font-semibold lg:block lg:text-right">{value}</div>
    </div>
  );
}

function EmptyChart({ label }: { label: string }) {
  return (
    <div className="flex h-24 items-center justify-center rounded-md border border-white/10 bg-white/[0.02] text-xs text-muted">
      {label}
    </div>
  );
}

function buildGroupedLoadData(timeRange: TimeRange, trainingLoad: TrainingLoadPoint[]) {
  const start = trainingLoad[0]?.date ?? null;
  const grouped = new Map<string, number>();

  for (const point of trainingLoad) {
    const period = getStatsChartBucketDateKey(timeRange, point.date, start);
    grouped.set(period, (grouped.get(period) ?? 0) + point.dailyTL);
  }

  return Array.from(grouped.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([period, load]) => ({ period, load: Math.round(load) }));
}

function buildWeekTimeline(
  trainingLoad: TrainingLoadPoint[],
  volumeChartData: { period: string; volume: number }[],
  runningData: RunningActivity[],
  adherence: AdherenceWeek[]
) {
  const dates = new Set<string>();
  for (const point of trainingLoad) dates.add(point.date);
  for (const point of volumeChartData) dates.add(point.period);
  for (const run of runningData) dates.add(run.date);
  for (const week of adherence) {
    for (const slot of week.slots) dates.add(slot.slot.date);
  }

  const volumeByDate = new Map(volumeChartData.map((point) => [point.period, point.volume]));
  const loadByDate = new Map(trainingLoad.map((point) => [point.date, point.dailyTL]));
  const runsByDate = new Map<string, number>();
  const planByDate = new Map<string, { completed: number; missed: number; pending: number; skipped: number }>();

  for (const run of runningData) {
    runsByDate.set(run.date, (runsByDate.get(run.date) ?? 0) + 1);
  }

  for (const week of adherence) {
    for (const item of week.slots) {
      const entry = planByDate.get(item.slot.date) ?? { completed: 0, missed: 0, pending: 0, skipped: 0 };
      if (item.status === "completed" || item.status === "swapped") entry.completed += 1;
      if (item.status === "missed") entry.missed += 1;
      if (item.status === "pending") entry.pending += 1;
      if (item.status === "skipped") entry.skipped += 1;
      planByDate.set(item.slot.date, entry);
    }
  }

  return Array.from(dates)
    .sort()
    .map((date) => ({
      date,
      label: date.slice(5),
      load: Math.round(loadByDate.get(date) ?? 0),
      volume: volumeByDate.get(date) ?? 0,
      runs: runsByDate.get(date) ?? 0,
      plan: planByDate.get(date) ?? { completed: 0, missed: 0, pending: 0, skipped: 0 },
    }));
}

function buildSignals({
  current,
  previous,
  plan,
  workoutSummary,
  personalRecords,
  latestLoad,
  trendBadge,
}: {
  current: StatsOverviewSnapshot;
  previous: StatsOverviewSnapshot | null;
  plan: ReturnType<typeof summarizeAdherence>;
  workoutSummary: WorkoutSummary;
  personalRecords: RunningPersonalRecord[];
  latestLoad: TrainingLoadPoint | null;
  trendBadge: { label: string; color: string };
}): Signal[] {
  const signals: Signal[] = [];
  const volumeDelta = percentDelta(current.totalVolume, previous?.totalVolume);
  const runDelta = percentDelta(current.runDistanceKm, previous?.runDistanceKm);
  const balanceNudge = workoutSummary.strengthBalance.nudges[0];

  if (plan.rate !== null) {
    signals.push({
      tone: plan.missed > 0 ? "attention" : plan.rate >= 85 ? "good" : "neutral",
      label: "Plan",
      value: `${plan.completed}/${plan.planned}`,
      detail: plan.missed > 0 ? `${plan.missed} missed planned slot${plan.missed === 1 ? "" : "s"}.` : `${plan.rate}% completion in range.`,
    });
  }

  if (volumeDelta !== null && Math.abs(volumeDelta) >= 10) {
    signals.push({
      tone: volumeDelta > 0 ? "good" : "attention",
      label: "Strength",
      value: `${volumeDelta > 0 ? "+" : ""}${volumeDelta}%`,
      detail: "Lifted volume versus comparable prior range.",
    });
  }

  if (runDelta !== null && Math.abs(runDelta) >= 10) {
    signals.push({
      tone: runDelta > 0 ? "good" : "neutral",
      label: "Running",
      value: `${runDelta > 0 ? "+" : ""}${runDelta}%`,
      detail: "Running distance versus comparable prior range.",
    });
  }

  if (balanceNudge) {
    signals.push({
      tone: balanceNudge.severity === "warning" ? "attention" : "neutral",
      label: "Balance",
      value: workoutSummary.strengthBalance.score === null ? "--" : String(workoutSummary.strengthBalance.score),
      detail: balanceNudge.message,
    });
  }

  if (latestLoad && latestLoad.tsb < -10) {
    signals.push({
      tone: latestLoad.tsb < -30 ? "attention" : "neutral",
      label: "Load",
      value: `${latestLoad.tsb}`,
      detail: "TSB is below neutral for the range.",
    });
  }

  if (personalRecords.length > 0) {
    signals.push({
      tone: "good",
      label: "PRs",
      value: String(personalRecords.length),
      detail: `Running PR${personalRecords.length === 1 ? "" : "s"} recorded in range.`,
    });
  }

  if (current.weighIns === 0) {
    signals.push({
      tone: "neutral",
      label: "Body",
      value: "No data",
      detail: "No weigh-ins in this range.",
    });
  } else {
    signals.push({
      tone: "neutral",
      label: "Body",
      value: trendBadge.label,
      detail: `${current.weighIns} weigh-in${current.weighIns === 1 ? "" : "s"} in range.`,
    });
  }

  return signals.slice(0, 6);
}

function SignalRow({ signal }: { signal: Signal }) {
  const toneClass =
    signal.tone === "good" ? "text-emerald-300" : signal.tone === "attention" ? "text-orange-300" : "text-white/60";

  return (
    <div className="grid gap-1 border-t border-white/10 py-3 first:border-t-0 first:pt-0 last:pb-0 sm:grid-cols-[7rem_5rem_minmax(0,1fr)] sm:gap-2 sm:items-start">
      <div className="flex min-w-0 items-baseline justify-between gap-3 sm:contents">
        <div className="text-xs font-medium uppercase tracking-wider text-white/35">{signal.label}</div>
        <div className={`shrink-0 text-sm font-semibold ${toneClass}`}>{signal.value}</div>
      </div>
      <div className="text-sm text-white/65">{signal.detail}</div>
    </div>
  );
}

function WeekTimeline({
  rows,
  units,
}: {
  rows: ReturnType<typeof buildWeekTimeline>;
  units: Units;
}) {
  if (rows.length === 0) return <p className="text-sm text-muted">No timeline data for this week.</p>;

  return (
    <div className="overflow-hidden rounded-md border border-white/10">
      <div className="divide-y divide-white/10 sm:hidden">
        {rows.map((row) => {
          const planLabel =
            row.plan.missed > 0
              ? `${row.plan.missed} missed`
              : row.plan.completed > 0
              ? `${row.plan.completed} done`
              : row.plan.pending > 0
              ? `${row.plan.pending} pending`
              : row.plan.skipped > 0
              ? `${row.plan.skipped} skipped`
              : "Open";
          const planClass = row.plan.missed > 0 ? "text-orange-300" : row.plan.completed > 0 ? "text-emerald-300" : "text-white/55";
          const volume = row.volume > 0 ? `${formatDisplayWeight(row.volume)} ${weightUnit(units)}` : "0";

          return (
            <div key={row.date} className="grid grid-cols-[3.25rem_minmax(0,1fr)_3.5rem] items-center gap-3 px-3 py-2.5 text-sm">
              <div className="font-medium text-white/80">{row.label}</div>
              <div className="min-w-0">
                <div className={`truncate font-medium ${planClass}`}>{planLabel}</div>
                <div className="mt-0.5 truncate text-[11px] text-white/40">
                  {volume} - {row.runs} run{row.runs === 1 ? "" : "s"}
                </div>
              </div>
              <div className="text-right">
                <div className="text-[10px] uppercase tracking-wider text-white/30">Load</div>
                <div className="text-sm font-semibold text-white/70">{row.load}</div>
              </div>
            </div>
          );
        })}
      </div>
      <div className="hidden sm:block">
        <div className="grid grid-cols-[4.5rem_1fr_1fr_1fr_1fr] border-b border-white/10 bg-white/[0.03] px-3 py-2 text-[11px] uppercase tracking-wider text-white/35">
          <div>Day</div>
          <div>Plan</div>
          <div>Load</div>
          <div>Volume</div>
          <div>Runs</div>
        </div>
        {rows.map((row) => {
          const planLabel =
            row.plan.missed > 0
              ? `${row.plan.missed} missed`
              : row.plan.completed > 0
              ? `${row.plan.completed} done`
              : row.plan.pending > 0
              ? `${row.plan.pending} pending`
              : row.plan.skipped > 0
              ? `${row.plan.skipped} skipped`
              : "Open";
          const planClass = row.plan.missed > 0 ? "text-orange-300" : row.plan.completed > 0 ? "text-emerald-300" : "text-white/50";

          return (
            <div key={row.date} className="grid grid-cols-[4.5rem_1fr_1fr_1fr_1fr] gap-1 border-t border-white/10 px-3 py-2 text-sm first:border-t-0">
              <div className="font-medium text-white/80">{row.label}</div>
              <div className={planClass}>{planLabel}</div>
              <div className="text-white/60">{row.load}</div>
              <div className="text-white/60">{formatDisplayWeight(row.volume)} {row.volume > 0 ? weightUnit(units) : ""}</div>
              <div className="text-white/60">{row.runs}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function OverviewTab({
  timeRange,
  units,
  current,
  previous,
  workoutSummary,
  volumeChartData,
  runningData,
  runChartData,
  bodyChartData,
  trainingLoad,
  adherence,
  personalRecords,
  latestLoad,
  tsbInfo,
  trendBadge,
}: Props) {
  const plan = summarizeAdherence(adherence);
  const rangeLabel = STATS_RANGE_LABELS[timeRange];
  const signals = buildSignals({ current, previous, plan, workoutSummary, personalRecords, latestLoad, trendBadge });
  const weekTimeline = timeRange === "week" ? buildWeekTimeline(trainingLoad, volumeChartData, runningData, adherence) : [];
  const loadTimeline = timeRange === "week" ? [] : buildGroupedLoadData(timeRange, trainingLoad);
  const topExercise = workoutSummary.topExercises[0] ?? null;
  const highestVolumePeriod = [...volumeChartData].sort((a, b) => b.volume - a.volume)[0] ?? null;
  const longestRun = [...runningData].sort((a, b) => (b.distance ?? 0) - (a.distance ?? 0))[0] ?? null;
  const latestPr = [...personalRecords].sort((a, b) => b.startTime.localeCompare(a.startTime))[0] ?? null;

  return (
    <div className="flex flex-col gap-4 sm:gap-5">
      <section className="border-b border-white/10 pb-4">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="min-w-0">
            <div className="text-xs font-medium uppercase tracking-wider text-muted">{rangeLabel}</div>
            <h2 className="mt-2 text-2xl font-semibold tracking-normal">Overview</h2>
            <p className="mt-2 max-w-3xl text-sm text-white/55">
              {current.totalSessions} sessions, {current.activeDays} active days, {plan.rate === null ? "no planned sessions" : `${plan.rate}% plan adherence`}.
            </p>
          </div>
          <div className="grid grid-cols-3 gap-0 lg:min-w-[20rem] lg:text-right">
            <HeaderFact
              label="Load"
              value={tsbInfo?.label ?? "No data"}
              detail={latestLoad ? `TSB ${latestLoad.tsb > 0 ? "+" : ""}${latestLoad.tsb}` : undefined}
              valueClass={tsbInfo?.color ?? "text-white/70"}
            />
            <HeaderFact label="Plan" value={`${plan.completed}/${plan.planned || 0}`} />
            <HeaderFact label="Weigh-ins" value={String(current.weighIns)} />
          </div>
        </div>
      </section>

      <div className="grid grid-cols-2 gap-2 xl:grid-cols-4">
        <MetricCard
          label="Training Days"
          value={String(current.activeDays)}
          delta={deltaLabel(current.activeDays, previous?.activeDays)}
          deltaClass={deltaTone(current.activeDays, previous?.activeDays)}
          detail={`${current.totalSessions} logged sessions`}
        />
        <MetricCard
          label={`Lifted Volume (${weightUnit(units)})`}
          value={current.totalVolume === 0 ? "--" : formatWeight(current.totalVolume, units)}
          delta={deltaLabel(current.totalVolume, previous?.totalVolume)}
          deltaClass={deltaTone(current.totalVolume, previous?.totalVolume)}
          detail={`${current.totalSets} total sets`}
        />
        <MetricCard
          label={`Run Distance (${distanceUnit(units)})`}
          value={current.runCount === 0 ? "--" : formatDistance(current.runDistanceKm, units)}
          delta={deltaLabel(current.runDistanceKm, previous?.runDistanceKm)}
          deltaClass={deltaTone(current.runDistanceKm, previous?.runDistanceKm)}
          detail={`${current.runCount} run${current.runCount === 1 ? "" : "s"}`}
        />
        <MetricCard
          label={`Body Weight (${weightUnit(units)})`}
          value={current.bodyWeight === null ? "--" : formatWeight(current.bodyWeight, units)}
          delta={deltaLabel(current.bodyWeightDelta, previous?.bodyWeightDelta)}
          deltaClass="text-white/40"
          detail={current.bodyWeightDelta === null ? "No range change" : `${current.bodyWeightDelta > 0 ? "+" : ""}${formatWeight(current.bodyWeightDelta, units)} ${weightUnit(units)}`}
        />
      </div>

      <div className="grid gap-4 sm:gap-5 xl:grid-cols-[minmax(0,1.35fr)_minmax(20rem,0.65fr)]">
        <section className="card p-4">
          <SectionHeader
            title="Workload"
            detail={timeRange === "week" ? "Daily breakdown for the selected week." : "Training load grouped across the selected range."}
          />
          <div className="mt-4">
            {timeRange === "week" ? (
              <WeekTimeline rows={weekTimeline} units={units} />
            ) : loadTimeline.length > 0 ? (
              <div className="h-56">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={loadTimeline}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1F1F1F" />
                    <XAxis dataKey="period" tick={{ fill: "#666", fontSize: 10 }} tickLine={false} tickFormatter={(v) => String(v).slice(5)} />
                    <YAxis hide />
                    <Tooltip {...CHART_TOOLTIP_PROPS} formatter={(v) => [v, "Training Load"]} />
                    <Bar dataKey="load" fill="var(--accent, #3B82F6)" radius={[3, 3, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <EmptyChart label="No training load data for this range." />
            )}
          </div>
        </section>

        <section className="card p-4">
          <SectionHeader title="Status" detail="Notable changes in this range." />
          <div className="mt-4">
            {signals.length > 0 ? signals.map((signal) => <SignalRow key={`${signal.label}-${signal.detail}`} signal={signal} />) : (
              <p className="text-sm text-muted">No notable changes for this range.</p>
            )}
          </div>
        </section>
      </div>

      <section className="card p-4">
        <SectionHeader title="Training Areas" detail="Strength, running, body, and load context." />
        <div className="mt-4">
          <DomainRow
            label="Strength"
            detail={`${current.workoutSessions} workouts, ${current.totalSets} sets`}
            value={`${formatWeight(current.totalVolume, units)} ${weightUnit(units)}`}
          >
            {volumeChartData.length > 0 ? (
              <div className="h-24">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={volumeChartData}>
                    <XAxis dataKey="period" hide />
                    <YAxis hide />
                    <Tooltip {...CHART_TOOLTIP_PROPS} formatter={(v) => [`${v} ${weightUnit(units)}`, "Volume"]} />
                    <Bar dataKey="volume" fill="var(--accent, #3B82F6)" radius={[2, 2, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : <EmptyChart label="No strength volume." />}
          </DomainRow>

          <DomainRow
            label="Running"
            detail={`${current.runCount} runs, best pace ${current.bestPace ? formatPace(current.bestPace, units) : "--"}`}
            value={`${formatDistance(current.runDistanceKm, units)} ${distanceUnit(units)}`}
          >
            {runChartData.length > 0 ? (
              <div className="h-24">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={runChartData}>
                    <XAxis dataKey="date" hide />
                    <YAxis hide />
                    <Tooltip {...CHART_TOOLTIP_PROPS} formatter={(v) => [`${v} ${distanceUnit(units)}`, "Distance"]} />
                    <Bar dataKey="dist" fill="#22c55e" radius={[2, 2, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : <EmptyChart label="No runs." />}
          </DomainRow>

          <DomainRow
            label="Body"
            detail={`${current.weighIns} weigh-ins, ${trendBadge.label.toLowerCase()}`}
            value={current.bodyWeight === null ? "--" : `${formatWeight(current.bodyWeight, units)} ${weightUnit(units)}`}
          >
            {bodyChartData.length > 0 ? (
              <div className="h-24">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={bodyChartData}>
                    <XAxis dataKey="date" hide />
                    <YAxis hide />
                    <Tooltip {...CHART_LINE_TOOLTIP_PROPS} />
                    <Line type="monotone" dataKey="rolling" stroke="var(--accent, #3B82F6)" strokeWidth={2} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            ) : <EmptyChart label="No weigh-ins." />}
          </DomainRow>

          <DomainRow
            label="Load & Plan"
            detail={`${plan.completed}/${plan.planned || 0} planned done`}
            value={latestLoad ? `TSB ${latestLoad.tsb}` : "--"}
          >
            {trainingLoad.length > 0 ? (
              <div className="h-24">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={trainingLoad}>
                    <XAxis dataKey="date" hide />
                    <YAxis hide />
                    <Tooltip {...CHART_LINE_TOOLTIP_PROPS} formatter={(v) => [v, "Form (TSB)"]} />
                    <Line type="monotone" dataKey="tsb" stroke="#a855f7" strokeWidth={2} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            ) : <EmptyChart label="No load data." />}
          </DomainRow>
        </div>
      </section>

      <section className="card p-4">
        <SectionHeader title="Range Leaders" detail="Top items from the selected range." />
        <div className="mt-4 grid grid-cols-2 gap-x-4 gap-y-4 xl:grid-cols-4">
          <NotableItem
            label="Top Exercise"
            value={topExercise?.name ?? "--"}
            detail={topExercise ? `${formatWeight(topExercise.volume, units)} ${weightUnit(units)} - ${topExercise.sets} sets` : "No strength volume"}
          />
          <NotableItem
            label="Best Volume Period"
            value={highestVolumePeriod ? highestVolumePeriod.period.slice(5) : "--"}
            detail={highestVolumePeriod ? `${formatDisplayWeight(highestVolumePeriod.volume)} ${weightUnit(units)}` : "No volume chart data"}
          />
          <NotableItem
            label="Longest Run"
            value={longestRun?.distance ? formatDistance(longestRun.distance / 1000, units) : "--"}
            detail={longestRun?.date ?? "No runs"}
          />
          <NotableItem
            label="Latest PR"
            value={latestPr?.effortName ?? "--"}
            detail={latestPr ? `${formatElapsedTime(latestPr.elapsedTime)} on ${latestPr.date}` : "No PRs in range"}
          />
        </div>
      </section>
    </div>
  );
}
