"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { saveNotificationPreferences, saveProfile, saveWeeklyScheduleDay } from "@/app/(tabs)/settings/actions";
import { Select } from "@/components/ui/Select";
import { MiniHeatmap } from "@/components/heatmap/MiniHeatmap";
import { ACCENT_COLORS } from "@/lib/accent-colors";
import {
  DEFAULT_HR_ZONES,
  DEFAULT_MAX_HEART_RATE,
  hrBoundariesToZones,
  hrZonesToBoundaries,
  maxHeartRateToZones,
  normalizeHRZoneMethod,
  normalizeHRZones,
  normalizeMaxHeartRate,
  type HRZone,
  type HRZoneMethod,
  type HRZoneSource,
} from "@/lib/hr-zones";
import {
  DEFAULT_PACE_ZONES,
  PACE_ZONE_NAMES,
  formatPaceSeconds,
  normalizePaceZones,
  paceBoundariesToZones,
  paceSecondsPerKmToUnitSeconds,
  paceUnitSecondsToSecondsPerKm,
  paceZonesToBoundaries,
  type PaceZone,
  type PaceZoneSource,
} from "@/lib/pace-zones";
import { getOrCreatePushSubscription, pushSupported, savePushSubscription } from "@/lib/pwa/push-subscription";
import {
  coercePortableData,
  countPortableRows,
  createPortableData,
  parsePortableJson,
  portableDataFromCsv,
  portableDataToCsv,
  preparePortableImport,
  type PortableFormat,
  type PortableRow,
  type PreparedPortableImport,
} from "@/lib/data-portability";
import { MUSCLE_GROUPS, type AccentColor, type DayType, type MuscleGroup, type NotificationPreferences, type Profile, type Units, type WeeklyScheduleRow } from "@/types";

const DAY_NAMES = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
const DAY_DISPLAY_ORDER = [6, 0, 1, 2, 3, 4, 5];

interface Props {
  profile: Profile | null;
  schedule: WeeklyScheduleRow[];
  dayTypes: DayType[];
  notificationPreferences: NotificationPreferences | null;
  notificationSubscriptionCount: number;
  stravaConnected: boolean;
  stravaStatus: {
    connected: boolean;
    error: string | null;
    detail?: string | null;
  };
}

type NotificationPrefsState = Omit<NotificationPreferences, "user_id">;

type HRZonesResponse = {
  hr?: HRZone[] | null;
  source?: HRZoneSource;
  method?: HRZoneMethod;
  maxHeartRate?: number | null;
  pace?: PaceZone[] | null;
  paceSource?: PaceZoneSource;
  stravaSyncedAt?: string | null;
  stravaHash?: string | null;
  stravaError?: string | null;
  stravaStatus?: number;
  stravaDetail?: string | null;
  stravaSkipped?: "profile_override";
};

type HRZoneSuggestion = {
  kind: "max_hr";
  zones: HRZone[];
  hash: string;
  maxHeartRate: number;
  previousMaxHeartRate: number;
  observedMaxHeartRate: number;
  confidence: "medium" | "high";
  summary: string;
  basis: {
    type: "max_hr";
    observedMaxHeartRate: number;
    previousMaxHeartRate: number;
    sampleSize: number;
  };
};

type PaceZoneSuggestion = {
  kind: "pace";
  zones: PaceZone[];
  hash: string;
  confidence: "medium" | "high";
  summary: string;
  basis: {
    type: "threshold_pace";
    thresholdPaceSecondsPerKm: number;
    bestEffortSamples: number;
    streamSamples: number;
  };
};

type ZoneSuggestionsResponse = {
  hr?: HRZoneSuggestion | null;
  pace?: PaceZoneSuggestion | null;
  generatedAt?: string;
};

const DEFAULT_NOTIFICATION_PREFS: NotificationPrefsState = {
  enabled: false,
  today_plan_enabled: true,
  today_plan_time: "08:00",
  pending_strava_enabled: true,
  plan_nudge_enabled: true,
  plan_nudge_time: "19:00",
  weekly_review_enabled: true,
  weekly_review_day: 0,
  weekly_review_time: "18:00",
  timezone: "UTC",
};

const NOTIFICATION_DAYS = [
  { value: 0, label: "Sunday" },
  { value: 1, label: "Monday" },
  { value: 2, label: "Tuesday" },
  { value: 3, label: "Wednesday" },
  { value: 4, label: "Thursday" },
  { value: 5, label: "Friday" },
  { value: 6, label: "Saturday" },
];

function toTimeInput(value: string): string {
  return value.slice(0, 5);
}

function localDateKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function normalizeNotificationPrefs(preferences: NotificationPreferences | null): NotificationPrefsState {
  if (!preferences) return DEFAULT_NOTIFICATION_PREFS;
  return {
    enabled: preferences.enabled,
    today_plan_enabled: preferences.today_plan_enabled,
    today_plan_time: toTimeInput(preferences.today_plan_time),
    pending_strava_enabled: preferences.pending_strava_enabled,
    plan_nudge_enabled: preferences.plan_nudge_enabled,
    plan_nudge_time: toTimeInput(preferences.plan_nudge_time),
    weekly_review_enabled: preferences.weekly_review_enabled,
    weekly_review_day: preferences.weekly_review_day,
    weekly_review_time: toTimeInput(preferences.weekly_review_time),
    timezone: preferences.timezone,
  };
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-xs font-medium text-muted uppercase tracking-wide">{title}</h2>
      {children}
    </section>
  );
}

function NotificationToggle({
  label,
  checked,
  disabled,
  onChange,
  children,
}: {
  label: string;
  checked: boolean;
  disabled: boolean;
  onChange: (checked: boolean) => void;
  children?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-stretch gap-3 rounded-xl border border-border bg-white/[0.025] px-3 py-2.5 sm:flex-row sm:items-center sm:justify-between">
      <label className="flex min-w-0 items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={checked}
          disabled={disabled}
          onChange={(e) => onChange(e.target.checked)}
          className="size-4 accent-[var(--accent)] disabled:opacity-40"
        />
        <span className={disabled ? "text-white/45" : "text-white/80"}>{label}</span>
      </label>
      {children && <div className="w-full shrink-0 sm:w-auto">{children}</div>}
    </div>
  );
}

const ZONE_SEGMENT_COLORS = [
  "bg-sky-400/45",
  "bg-emerald-400/45",
  "bg-lime-400/45",
  "bg-amber-400/45",
  "bg-rose-400/45",
  "bg-fuchsia-400/45",
];

const HR_ZONE_STEP = 1;
const HR_ZONE_MIN_GAP = 1;
const PACE_ZONE_STEP = 5;
const PACE_ZONE_MIN_GAP = 5;

interface ZoneSegmentSummary {
  label: string;
  detail: string;
  colorClass: string;
}

function clampNumber(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function roundToStep(value: number, step: number): number {
  return Math.round(value / step) * step;
}

function roundDownToStep(value: number, step: number): number {
  return Math.floor(value / step) * step;
}

function roundUpToStep(value: number, step: number): number {
  return Math.ceil(value / step) * step;
}

function fallbackHRBoundaries(): number[] {
  return hrZonesToBoundaries(DEFAULT_HR_ZONES) ?? [114, 133, 152, 171];
}

function fallbackPaceBoundaries(units: Units): number[] {
  return paceUnitBoundariesFromZones(DEFAULT_PACE_ZONES, units);
}

function hrSliderDomain(boundaries: number[]): { min: number; max: number } {
  const first = boundaries[0] ?? 100;
  const last = boundaries[boundaries.length - 1] ?? 180;

  return {
    min: Math.max(0, Math.min(60, roundDownToStep(first - 20, 10))),
    max: Math.max(220, roundUpToStep(last + 20, 10)),
  };
}

function paceSliderDomain(boundaries: number[], units: Units): { fast: number; slow: number } {
  const slowestBoundary = boundaries[0] ?? 10 * 60;
  const fastestBoundary = boundaries[boundaries.length - 1] ?? 5 * 60;
  const defaultSlow = units === "imperial" ? 20 * 60 : 12 * 60;
  const defaultFast = units === "imperial" ? 4 * 60 : 150;

  return {
    fast: Math.max(
      PACE_ZONE_MIN_GAP,
      Math.min(defaultFast, roundDownToStep(fastestBoundary - 60, 30), fastestBoundary - PACE_ZONE_MIN_GAP)
    ),
    slow: Math.max(defaultSlow, roundUpToStep(slowestBoundary + 60, 60), slowestBoundary + PACE_ZONE_MIN_GAP),
  };
}

function clampAscendingBoundary(
  boundaries: number[],
  index: number,
  nextValue: number,
  domain: { min: number; max: number },
  step: number,
  minGap: number
): number[] {
  const lower = index === 0 ? domain.min + minGap : boundaries[index - 1] + minGap;
  const upper = index === boundaries.length - 1 ? domain.max - minGap : boundaries[index + 1] - minGap;
  const next = clampNumber(roundToStep(nextValue, step), lower, upper);
  return boundaries.map((boundary, boundaryIndex) => boundaryIndex === index ? next : boundary);
}

function clampDescendingBoundary(
  boundaries: number[],
  index: number,
  nextValue: number,
  domain: { fast: number; slow: number },
  step: number,
  minGap: number
): number[] {
  const lower = index === boundaries.length - 1 ? domain.fast + minGap : boundaries[index + 1] + minGap;
  const upper = index === 0 ? domain.slow - minGap : boundaries[index - 1] - minGap;
  const next = clampNumber(roundToStep(nextValue, step), lower, upper);
  return boundaries.map((boundary, boundaryIndex) => boundaryIndex === index ? next : boundary);
}

function hrSegments(boundaries: number[]): ZoneSegmentSummary[] {
  const segments: ZoneSegmentSummary[] = [];
  for (let index = 0; index <= boundaries.length; index += 1) {
    const min = index === 0 ? 0 : boundaries[index - 1];
    const max = boundaries[index];
    segments.push({
      label: `Z${index + 1}`,
      detail: max == null ? `${min}+ bpm` : `${min}-${max} bpm`,
      colorClass: ZONE_SEGMENT_COLORS[index],
    });
  }
  return segments;
}

function paceUnitBoundariesFromZones(zones: PaceZone[], units: Units): number[] {
  const boundaries = paceZonesToBoundaries(zones) ?? paceZonesToBoundaries(DEFAULT_PACE_ZONES) ?? [420, 360, 315, 285, 255];
  return boundaries.map((boundary) => paceSecondsPerKmToUnitSeconds(boundary, units));
}

function paceZonesFromUnitBoundaries(boundaries: number[], units: Units): PaceZone[] | null {
  return paceBoundariesToZones(
    boundaries.map((boundary) => Math.round(paceUnitSecondsToSecondsPerKm(boundary, units)))
  );
}

function paceSegments(boundaries: number[], paceUnit: string): ZoneSegmentSummary[] {
  const segments: ZoneSegmentSummary[] = [];
  for (let index = 0; index <= boundaries.length; index += 1) {
    const slowBoundary = boundaries[index - 1];
    const fastBoundary = boundaries[index];
    const range = index === 0
      ? `${formatPaceSeconds(fastBoundary)}+ ${paceUnit}`
      : index === boundaries.length
      ? `<${formatPaceSeconds(slowBoundary)} ${paceUnit}`
      : `${formatPaceSeconds(fastBoundary)}-${formatPaceSeconds(slowBoundary)} ${paceUnit}`;

    segments.push({
      label: `Z${index + 1}`,
      detail: `${PACE_ZONE_NAMES[index] ?? "Zone"} - ${range}`,
      colorClass: ZONE_SEGMENT_COLORS[index],
    });
  }
  return segments;
}

function ZoneBoundaryBar({
  ariaLabel,
  boundaries,
  disabled,
  startLabel,
  endLabel,
  segments,
  summaryGridClassName,
  valueToPercent,
  percentToValue,
  formatValue,
  compactFormatValue,
  getAriaBounds,
  onChange,
}: {
  ariaLabel: string;
  boundaries: number[];
  disabled: boolean;
  startLabel: string;
  endLabel: string;
  segments: ZoneSegmentSummary[];
  summaryGridClassName: string;
  valueToPercent: (value: number) => number;
  percentToValue: (percent: number) => number;
  formatValue: (value: number) => string;
  compactFormatValue: (value: number) => string;
  getAriaBounds: (index: number) => { min: number; max: number };
  onChange: (index: number, value: number) => void;
}) {
  const rootRef = useRef<HTMLDivElement>(null);
  const barRef = useRef<HTMLDivElement>(null);
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const positions = boundaries.map((boundary) => clampNumber(valueToPercent(boundary), 0, 100));
  const edges = [0, ...positions, 100];
  const laneTops = boundaries.length === 4 ? [0, 44, 132, 176] : [0, 42, 84, 168, 210];
  const barTop = boundaries.length === 4 ? 92 : 126;
  const barHeight = 30;
  const handleHeight = 32;
  const interfaceHeight = boundaries.length === 4 ? 216 : 250;

  function percentFromClientX(clientX: number): number {
    const rect = barRef.current?.getBoundingClientRect();
    if (!rect || rect.width <= 0) return 0;
    return clampNumber(((clientX - rect.left) / rect.width) * 100, 0, 100);
  }

  function nearestBoundaryIndex(percent: number): number {
    let nearestIndex = 0;
    let nearestDistance = Number.POSITIVE_INFINITY;
    positions.forEach((position, index) => {
      const distance = Math.abs(position - percent);
      if (distance < nearestDistance) {
        nearestIndex = index;
        nearestDistance = distance;
      }
    });
    return nearestIndex;
  }

  function updateBoundaryFromPointer(index: number, clientX: number) {
    onChange(index, percentToValue(percentFromClientX(clientX)));
  }

  function beginDrag(event: React.PointerEvent<HTMLDivElement>) {
    if (disabled) return;

    const target = event.target as HTMLElement;
    const handle = target.closest<HTMLElement>("[data-boundary-index]");
    const bar = target.closest<HTMLElement>("[data-zone-boundary-bar]");
    if (!handle && !bar) return;

    event.preventDefault();
    const percent = percentFromClientX(event.clientX);
    const nextIndex = handle ? Number(handle.dataset.boundaryIndex) : nearestBoundaryIndex(percent);
    if (!Number.isInteger(nextIndex)) return;

    setDragIndex(nextIndex);
    rootRef.current?.setPointerCapture(event.pointerId);
    updateBoundaryFromPointer(nextIndex, event.clientX);
  }

  function continueDrag(event: React.PointerEvent<HTMLDivElement>) {
    if (dragIndex == null) return;
    updateBoundaryFromPointer(dragIndex, event.clientX);
  }

  function endDrag(event: React.PointerEvent<HTMLDivElement>) {
    if (rootRef.current?.hasPointerCapture(event.pointerId)) {
      rootRef.current.releasePointerCapture(event.pointerId);
    }
    setDragIndex(null);
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLButtonElement>, index: number) {
    const direction = event.key === "ArrowRight" || event.key === "ArrowUp" || event.key === "PageUp"
      ? 1
      : event.key === "ArrowLeft" || event.key === "ArrowDown" || event.key === "PageDown"
      ? -1
      : null;
    if (!direction) return;

    event.preventDefault();
    const amount = event.key === "PageUp" || event.key === "PageDown" ? 5 : 1;
    onChange(index, percentToValue(positions[index] + direction * amount));
  }

  return (
    <div className="flex flex-col gap-4">
      <div
        ref={rootRef}
        onPointerDown={beginDrag}
        onPointerMove={continueDrag}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        className={`relative select-none ${disabled ? "opacity-50" : "touch-none"}`}
        style={{ height: interfaceHeight }}
      >
        <div
          ref={barRef}
          data-zone-boundary-bar
          aria-label={ariaLabel}
          className="absolute inset-x-0 flex overflow-hidden rounded-full border border-white/10 bg-white/[0.04]"
          style={{ top: barTop, height: barHeight }}
        >
          {segments.map((segment, index) => (
            <div
              key={`${ariaLabel}-${segment.label}`}
              style={{ width: `${Math.max(0, edges[index + 1] - edges[index])}%` }}
              className={`flex min-w-0 shrink-0 items-center justify-center px-1 ${segment.colorClass}`}
            >
              <span className="truncate text-[10px] font-semibold text-white/90">{segment.label}</span>
            </div>
          ))}
        </div>

        {boundaries.map((boundary, index) => {
          const bounds = getAriaBounds(index);
          const handleTop = laneTops[index] ?? 0;
          const handleCenter = handleTop + handleHeight / 2;
          const barCenter = barTop + barHeight / 2;
          const lineTop = Math.min(handleCenter, barCenter);
          const lineHeight = Math.abs(barCenter - handleCenter);
          const isDragging = dragIndex === index;

          return (
            <div key={`${ariaLabel}-boundary-${index}`}>
              <span
                aria-hidden="true"
                style={{
                  left: `${positions[index]}%`,
                  top: lineTop,
                  height: lineHeight,
                }}
                className="pointer-events-none absolute z-0 w-px -translate-x-1/2 bg-white/20"
              />
              <button
                type="button"
                data-boundary-index={index}
                disabled={disabled}
                role="slider"
                aria-label={`${segments[index].label} to ${segments[index + 1].label} cutoff`}
                aria-valuemin={Math.round(bounds.min)}
                aria-valuemax={Math.round(bounds.max)}
                aria-valuenow={Math.round(boundary)}
                aria-valuetext={formatValue(boundary)}
                title={formatValue(boundary)}
                onKeyDown={(event) => handleKeyDown(event, index)}
                style={{
                  left: `clamp(2.375rem, ${positions[index]}%, calc(100% - 2.375rem))`,
                  top: handleTop,
                }}
                className={`absolute z-10 flex h-8 w-[4.75rem] -translate-x-1/2 items-center justify-between gap-1 rounded-full border bg-black/85 px-2 text-left shadow-lg transition-colors disabled:pointer-events-none ${
                  isDragging ? "border-accent" : "border-white/15 hover:border-white/35"
                }`}
              >
                <span className="text-[10px] font-semibold text-white/55">{segments[index].label}-{index + 2}</span>
                <span className="text-xs font-semibold text-white">{compactFormatValue(boundary)}</span>
              </button>
            </div>
          );
        })}
      </div>

      <div className={`flex justify-between px-1 text-[10px] font-medium uppercase tracking-[0.14em] text-muted ${disabled ? "opacity-50" : ""}`}>
        <span>{startLabel}</span>
        <span>{endLabel}</span>
      </div>

      <div className={`grid gap-x-3 gap-y-2 ${summaryGridClassName}`}>
        {segments.map((segment) => (
          <div key={`${ariaLabel}-${segment.label}-summary`} className="min-w-0">
            <div className="flex min-w-0 items-center gap-1.5">
              <span className={`h-2 w-2 shrink-0 rounded-full ${segment.colorClass}`} />
              <span className="truncate text-[11px] font-medium text-white/80">{segment.label}</span>
            </div>
            <div className="mt-0.5 truncate text-[11px] text-muted">{segment.detail}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function sourceDescription(source: HRZoneSource | null, stravaConnected: boolean, maxHeartRate: number): string {
  if (source === "custom" || source === "profile") return "Using your custom zones.";
  if (source === "max_hr") return `Using max-HR zones from ${maxHeartRate} bpm.`;
  if (source === "strava") return "Using Strava heart-rate zones.";
  if (source === "strava_cached") return "Using last synced Strava zones until Strava is available again.";
  if (stravaConnected) return `Using max-HR fallback zones from ${maxHeartRate} bpm because Strava zones are unavailable.`;
  return `Using max-HR fallback zones from ${maxHeartRate} bpm because Strava is not connected.`;
}

function stravaZoneWarning(response: HRZonesResponse | null, stravaConnected: boolean): string | null {
  if (!stravaConnected || !response?.stravaError) return null;
  if (response.source !== "default" && response.source !== "max_hr") return null;

  if (response.stravaError === "strava_auth_failed") {
    return "Reconnect Strava to refresh access. Using max-HR fallback zones.";
  }
  if (response.stravaError === "missing_profile_read_all_scope") {
    return "Reconnect Strava and approve profile access. Using max-HR fallback zones.";
  }
  if (response.stravaStatus === 402) {
    return "Strava denied zone access for this account. Using max-HR fallback zones.";
  }
  if (response.stravaError === "invalid_zone_shape") {
    return "Strava returned no usable heart-rate zones. Using max-HR fallback zones.";
  }
  return "Could not load Strava zones. Using max-HR fallback zones.";
}

function formatConfidence(confidence: "medium" | "high"): string {
  return confidence === "high" ? "High confidence" : "Medium confidence";
}

type BoundaryChange = {
  label: string;
  current: string;
  suggested: string;
  delta: string;
};

function formatBoundarySet(values: number[], formatValue: (value: number) => string): string {
  return values.map(formatValue).join(" / ");
}

function boundaryChangeRows(
  current: number[],
  suggested: number[],
  formatValue: (value: number) => string,
  formatDelta: (currentValue: number, suggestedValue: number) => string
): BoundaryChange[] {
  return suggested.flatMap((suggestedValue, index) => {
    const currentValue = current[index];
    if (currentValue == null || currentValue === suggestedValue) return [];

    return [{
      label: `Z${index + 1}/Z${index + 2}`,
      current: formatValue(currentValue),
      suggested: formatValue(suggestedValue),
      delta: formatDelta(currentValue, suggestedValue),
    }];
  });
}

function formatBpmDelta(currentValue: number, suggestedValue: number): string {
  const delta = suggestedValue - currentValue;
  return `${delta > 0 ? "+" : ""}${delta} bpm`;
}

function formatPaceDelta(currentValue: number, suggestedValue: number): string {
  const delta = suggestedValue - currentValue;
  if (delta === 0) return "same";
  return `${formatPaceSeconds(Math.abs(delta))} ${delta < 0 ? "faster" : "slower"}`;
}

function formatSampleCount(count: number, label: string): string {
  return `${count} ${label} sample${count === 1 ? "" : "s"}`;
}

function formatPaceSampleSources(bestEffortSamples: number, streamSamples: number): string {
  const sources = [
    bestEffortSamples > 0 ? formatSampleCount(bestEffortSamples, "best-effort") : null,
    streamSamples > 0 ? formatSampleCount(streamSamples, "stream") : null,
  ].filter(Boolean);

  return sources.join(" and ") || "available pace samples";
}

function ZoneSuggestionDetail({
  confidence,
  summary,
  currentLabel,
  suggestedLabel,
  basis,
  changes,
}: {
  confidence: "medium" | "high";
  summary: string;
  currentLabel: string;
  suggestedLabel: string;
  basis: string;
  changes: BoundaryChange[];
}) {
  return (
    <div className="space-y-2">
      <p>{formatConfidence(confidence)}. {summary}</p>
      <dl className="grid gap-1">
        <div className="grid gap-0.5">
          <dt className="text-[10px] font-medium uppercase tracking-[0.14em] text-white/45">Current dividers</dt>
          <dd className="font-medium text-white/80">{currentLabel}</dd>
        </div>
        <div className="grid gap-0.5">
          <dt className="text-[10px] font-medium uppercase tracking-[0.14em] text-white/45">Suggested dividers</dt>
          <dd className="font-medium text-white/90">{suggestedLabel}</dd>
        </div>
      </dl>
      {changes.length > 0 && (
        <div className="grid gap-1">
          {changes.map((change) => (
            <div key={change.label} className="flex flex-wrap items-baseline gap-x-1.5 gap-y-0.5">
              <span className="font-medium text-white/75">{change.label}</span>
              <span>{change.current} to {change.suggested}</span>
              <span className="text-white/45">({change.delta})</span>
            </div>
          ))}
        </div>
      )}
      <p className="text-white/50">{basis}</p>
    </div>
  );
}

function ZoneSuggestionBox({
  detail,
  disabled,
  onAccept,
  onIgnore,
}: {
  detail: React.ReactNode;
  disabled: boolean;
  onAccept: () => void;
  onIgnore: () => void;
}) {
  return (
    <div className="rounded-lg border border-accent/30 bg-accent/10 p-3">
      <div className="text-xs font-medium text-white/85">Suggested update</div>
      <div className="mt-1 text-xs leading-relaxed text-white/60">{detail}</div>
      <div className="mt-3 flex flex-col gap-2 sm:flex-row">
        <button
          type="button"
          onClick={onAccept}
          disabled={disabled}
          className="rounded-lg bg-accent px-3 py-2 text-xs font-medium text-white disabled:opacity-50"
        >
          Accept
        </button>
        <button
          type="button"
          onClick={onIgnore}
          disabled={disabled}
          className="rounded-lg border border-border px-3 py-2 text-xs text-muted transition-colors hover:text-white disabled:opacity-50"
        >
          Ignore
        </button>
      </div>
    </div>
  );
}

function HRZonesSettings({
  initialZones,
  initialMethod,
  initialMaxHeartRate,
  stravaConnected,
  suggestion,
  onSuggestionHandled,
}: {
  initialZones: HRZone[] | null | undefined;
  initialMethod: HRZoneMethod | null | undefined;
  initialMaxHeartRate: number | null | undefined;
  stravaConnected: boolean;
  suggestion: HRZoneSuggestion | null;
  onSuggestionHandled: () => void;
}) {
  const router = useRouter();
  const initialCustomZones = normalizeHRZones(initialZones);
  const resolvedInitialMethod = normalizeHRZoneMethod(initialMethod) ?? (initialCustomZones ? "custom" : stravaConnected ? "strava" : "max_hr");
  const initialMax = normalizeMaxHeartRate(initialMaxHeartRate) ?? DEFAULT_MAX_HEART_RATE;
  const initialMaxHrZones = maxHeartRateToZones(initialMax) ?? DEFAULT_HR_ZONES;
  const initialDisplayZones = resolvedInitialMethod === "custom" ? initialCustomZones ?? initialMaxHrZones : initialMaxHrZones;
  const [boundaries, setBoundaries] = useState<number[]>(() => hrZonesToBoundaries(initialDisplayZones) ?? fallbackHRBoundaries());
  const [customBoundaries, setCustomBoundaries] = useState<number[]>(() => hrZonesToBoundaries(initialCustomZones ?? initialMaxHrZones) ?? fallbackHRBoundaries());
  const [savedCustomBoundaries, setSavedCustomBoundaries] = useState<number[]>(() => hrZonesToBoundaries(initialCustomZones ?? initialMaxHrZones) ?? fallbackHRBoundaries());
  const [method, setMethod] = useState<HRZoneMethod>(resolvedInitialMethod);
  const [savedMethod, setSavedMethod] = useState<HRZoneMethod>(resolvedInitialMethod);
  const [source, setSource] = useState<HRZoneSource | null>(initialCustomZones && resolvedInitialMethod === "custom" ? "custom" : null);
  const [maxHeartRate, setMaxHeartRate] = useState(initialMax);
  const [maxHeartRateDraft, setMaxHeartRateDraft] = useState(String(initialMax));
  const [loading, setLoading] = useState(!(initialCustomZones && resolvedInitialMethod === "custom"));
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const domain = hrSliderDomain(boundaries);
  const segments = hrSegments(boundaries);
  const customMode = method === "custom";
  const previewMaxHeartRate = normalizeMaxHeartRate(maxHeartRateDraft) ?? maxHeartRate;
  const hasUnsavedChanges =
    method !== savedMethod ||
    (method === "max_hr" && previewMaxHeartRate !== maxHeartRate) ||
    (method === "custom" && customBoundaries.some((boundary, index) => boundary !== savedCustomBoundaries[index]));

  async function loadZones(previewMethod?: HRZoneMethod, commitSavedMethod = previewMethod == null) {
    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams();
      if (previewMethod) params.set("method", previewMethod);
      if (!commitSavedMethod) params.set("preview", "1");
      const query = params.toString();
      const url = query ? `/api/strava/zones?${query}` : "/api/strava/zones";
      const response = await fetch(url, { cache: "no-store" });
      const body = await response.json().catch(() => null) as HRZonesResponse | null;
      if (!response.ok) throw new Error("Failed to load heart-rate zones.");

      const zones = normalizeHRZones(body?.hr) ?? DEFAULT_HR_ZONES;
      const nextMaxHeartRate = normalizeMaxHeartRate(body?.maxHeartRate) ?? DEFAULT_MAX_HEART_RATE;
      const nextMethod = body?.method ?? previewMethod ?? "max_hr";
      const nextBoundaries = hrZonesToBoundaries(zones) ?? fallbackHRBoundaries();
      setBoundaries(nextBoundaries);
      setMethod(nextMethod);
      if (commitSavedMethod) setSavedMethod(nextMethod);
      if (nextMethod === "custom") {
        setCustomBoundaries(nextBoundaries);
        if (commitSavedMethod) setSavedCustomBoundaries(nextBoundaries);
      }
      setSource(body?.source ?? "default");
      setMaxHeartRate(nextMaxHeartRate);
      setMaxHeartRateDraft(String(nextMaxHeartRate));
      setError(stravaZoneWarning(body, stravaConnected));
    } catch {
      setBoundaries(fallbackHRBoundaries());
      setSource("default");
      setError("Could not load Strava zones. Using fallback zones.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    let active = true;

    async function loadInitialZones() {
      try {
        const response = await fetch("/api/strava/zones", { cache: "no-store" });
        const body = await response.json().catch(() => null) as HRZonesResponse | null;
        if (!active) return;
        if (!response.ok) throw new Error("Failed to load heart-rate zones.");

        const zones = normalizeHRZones(body?.hr) ?? DEFAULT_HR_ZONES;
        const nextMaxHeartRate = normalizeMaxHeartRate(body?.maxHeartRate) ?? DEFAULT_MAX_HEART_RATE;
        const nextMethod = body?.method ?? "max_hr";
        const nextBoundaries = hrZonesToBoundaries(zones) ?? fallbackHRBoundaries();
        setBoundaries(nextBoundaries);
        setMethod(nextMethod);
        setSavedMethod(nextMethod);
        if (nextMethod === "custom") {
          setCustomBoundaries(nextBoundaries);
          setSavedCustomBoundaries(nextBoundaries);
        }
        setSource(body?.source ?? "default");
        setMaxHeartRate(nextMaxHeartRate);
        setMaxHeartRateDraft(String(nextMaxHeartRate));
        setError(stravaZoneWarning(body, stravaConnected));
      } catch {
        if (!active) return;
        setBoundaries(fallbackHRBoundaries());
        setSource("default");
        setError("Could not load Strava zones. Using fallback zones.");
      } finally {
        if (active) setLoading(false);
      }
    }

    void loadInitialZones();
    return () => {
      active = false;
    };
  }, [stravaConnected]);

  function updateBoundary(index: number, value: number) {
    if (!customMode) return;
    setBoundaries((current) => {
      const next = clampAscendingBoundary(current, index, value, hrSliderDomain(current), HR_ZONE_STEP, HR_ZONE_MIN_GAP);
      setCustomBoundaries(next);
      return next;
    });
    setMessage(null);
    setError(null);
  }

  function previewMethod(nextMethod: HRZoneMethod) {
    if (saving || loading) return;

    setMethod(nextMethod);
    setMessage(null);
    setError(null);

    if (nextMethod === "custom") {
      setBoundaries(customBoundaries);
      setSource("custom");
      return;
    }

    if (nextMethod === "max_hr") {
      const nextMaxHeartRate = normalizeMaxHeartRate(maxHeartRateDraft);
      if (!nextMaxHeartRate) {
        setError("Max heart rate must be between 100 and 240 bpm.");
        return;
      }
      const zones = maxHeartRateToZones(nextMaxHeartRate) ?? DEFAULT_HR_ZONES;
      setBoundaries(hrZonesToBoundaries(zones) ?? fallbackHRBoundaries());
      setSource("max_hr");
      return;
    }

    void loadZones("strava", false);
  }

  async function saveHeartRateSettings() {
    if (saving) return;

    const update: {
      hr_zone_method: HRZoneMethod;
      hr_zones?: HRZone[] | null;
      max_heart_rate?: number;
    } = { hr_zone_method: method };

    if (method === "custom") {
      const zones = hrBoundariesToZones(customBoundaries);
      if (!zones) {
        setError("Heart-rate dividers must stay in ascending order.");
        return;
      }
      update.hr_zones = zones;
    }

    if (method === "max_hr") {
      const nextMaxHeartRate = normalizeMaxHeartRate(maxHeartRateDraft);
      if (!nextMaxHeartRate) {
        setError("Max heart rate must be between 100 and 240 bpm.");
        return;
      }
      update.max_heart_rate = nextMaxHeartRate;
    }

    setSaving(true);
    setError(null);
    const result = await saveProfile(update);
    setSaving(false);

    if (result.error) {
      setError("Failed to save heart-rate settings. Please try again.");
      return;
    }

    setSavedMethod(method);
    if (method === "custom") {
      setSource("custom");
      setBoundaries(customBoundaries);
      setSavedCustomBoundaries(customBoundaries);
    } else if (method === "max_hr") {
      const nextMaxHeartRate = update.max_heart_rate ?? maxHeartRate;
      const zones = maxHeartRateToZones(nextMaxHeartRate) ?? DEFAULT_HR_ZONES;
      setMaxHeartRate(nextMaxHeartRate);
      setMaxHeartRateDraft(String(nextMaxHeartRate));
      setBoundaries(hrZonesToBoundaries(zones) ?? fallbackHRBoundaries());
      setSource("max_hr");
    } else {
      await loadZones("strava", true);
    }

    setMessage("Heart-rate settings saved.");
    setTimeout(() => setMessage(null), 2000);
    router.refresh();
  }

  async function acceptSuggestion() {
    if (saving || !suggestion) return;

    setSaving(true);
    setError(null);
    const result = await saveProfile({
      hr_zone_method: "max_hr",
      max_heart_rate: suggestion.maxHeartRate,
      ignored_hr_zone_suggestion_hash: null,
    });
    setSaving(false);

    if (result.error) {
      setError("Failed to save suggested heart-rate zones. Please try again.");
      return;
    }

    setMaxHeartRate(suggestion.maxHeartRate);
    setMaxHeartRateDraft(String(suggestion.maxHeartRate));
    setBoundaries(hrZonesToBoundaries(suggestion.zones) ?? fallbackHRBoundaries());
    setMethod("max_hr");
    setSource("max_hr");
    setMessage("Suggested max heart rate saved.");
    onSuggestionHandled();
    setTimeout(() => setMessage(null), 2000);
    router.refresh();
  }

  async function ignoreSuggestion() {
    if (saving || !suggestion) return;

    setSaving(true);
    setError(null);
    const result = await saveProfile({ ignored_hr_zone_suggestion_hash: suggestion.hash });
    setSaving(false);

    if (result.error) {
      setError("Failed to ignore heart-rate suggestion. Please try again.");
      return;
    }

    setMessage("Heart-rate suggestion ignored.");
    onSuggestionHandled();
    setTimeout(() => setMessage(null), 2000);
    router.refresh();
  }

  return (
    <div className="card p-4 flex flex-col gap-4">
      <div>
        <div className="font-medium text-sm">Heart-rate zones</div>
        <div className="text-xs text-muted mt-0.5">
          {loading ? "Loading zones..." : sourceDescription(source, stravaConnected, previewMaxHeartRate)}
        </div>
      </div>

      <div className="grid gap-2">
        <div className="text-[10px] font-medium uppercase tracking-[0.14em] text-muted">Method</div>
        <div className="grid grid-cols-3 gap-2">
          {([
            ["strava", "Strava"],
            ["max_hr", "Max HR"],
            ["custom", "Custom"],
          ] as const).map(([value, label]) => (
            <button
              key={value}
              type="button"
              onClick={() => previewMethod(value)}
              disabled={loading || saving || (value === "strava" && !stravaConnected)}
              className={`rounded-lg border px-3 py-2 text-xs font-medium transition-colors disabled:opacity-45 ${
                method === value
                  ? "border-accent bg-accent/15 text-white"
                  : "border-border text-muted hover:text-white"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {method === "max_hr" && (
        <label className="grid gap-1 text-xs text-muted">
          Max heart rate
          <input
            type="number"
            inputMode="numeric"
            min={100}
            max={240}
            value={maxHeartRateDraft}
            disabled={loading || saving}
            onChange={(event) => {
              const nextDraft = event.target.value.replace(/[^\d]/g, "");
              const zones = maxHeartRateToZones(nextDraft);
              setMaxHeartRateDraft(nextDraft);
              if (zones) {
                setBoundaries(hrZonesToBoundaries(zones) ?? fallbackHRBoundaries());
                setSource("max_hr");
              }
              setMessage(null);
              setError(null);
            }}
            className="min-w-0 rounded-lg border border-border bg-white/[0.03] px-3 py-2 text-sm text-white disabled:opacity-50"
          />
        </label>
      )}

      <ZoneBoundaryBar
        ariaLabel="Heart-rate zone boundaries"
        boundaries={boundaries}
        disabled={loading || saving || !customMode}
        startLabel={`${domain.min} bpm`}
        endLabel={`${domain.max} bpm`}
        segments={segments}
        summaryGridClassName="grid-cols-2 sm:grid-cols-5"
        valueToPercent={(value) => ((value - domain.min) / (domain.max - domain.min)) * 100}
        percentToValue={(percent) => domain.min + (percent / 100) * (domain.max - domain.min)}
        formatValue={(value) => `${Math.round(value)} bpm`}
        compactFormatValue={(value) => `${Math.round(value)}`}
        getAriaBounds={(index) => ({
          min: index === 0 ? domain.min + HR_ZONE_MIN_GAP : boundaries[index - 1] + HR_ZONE_MIN_GAP,
          max: index === boundaries.length - 1 ? domain.max - HR_ZONE_MIN_GAP : boundaries[index + 1] - HR_ZONE_MIN_GAP,
        })}
        onChange={updateBoundary}
      />

      {method === "max_hr" && suggestion && (
        <ZoneSuggestionBox
          detail={(() => {
            const suggestedBoundaries = hrZonesToBoundaries(suggestion.zones) ?? fallbackHRBoundaries();
            return (
              <ZoneSuggestionDetail
                confidence={suggestion.confidence}
                summary={suggestion.summary}
                currentLabel={formatBoundarySet(boundaries, (value) => `${Math.round(value)} bpm`)}
                suggestedLabel={formatBoundarySet(suggestedBoundaries, (value) => `${Math.round(value)} bpm`)}
                basis={`Observed max HR is ${suggestion.observedMaxHeartRate} bpm from ${formatSampleCount(suggestion.basis.sampleSize, "recent HR activity")}; this updates max HR from ${suggestion.previousMaxHeartRate} to ${suggestion.maxHeartRate} bpm.`}
                changes={boundaryChangeRows(
                  boundaries,
                  suggestedBoundaries,
                  (value) => `${Math.round(value)} bpm`,
                  formatBpmDelta
                )}
              />
            );
          })()}
          disabled={loading || saving}
          onAccept={() => void acceptSuggestion()}
          onIgnore={() => void ignoreSuggestion()}
        />
      )}

      {(message || error) && (
        <div className={`text-xs ${error ? "text-red-400" : "text-green-400"}`}>
          {error ?? message}
        </div>
      )}

      <div className="flex flex-col gap-2 sm:flex-row">
        <button
          type="button"
          onClick={() => void saveHeartRateSettings()}
          disabled={loading || saving}
          className="rounded-lg bg-accent px-3 py-2 text-xs font-medium text-white disabled:opacity-50"
        >
          {saving ? "Saving..." : hasUnsavedChanges ? "Save changes" : "Save settings"}
        </button>
        {method === "strava" && (
          <button
            type="button"
            onClick={() => void loadZones("strava", false)}
            disabled={loading || saving || !stravaConnected}
            className="rounded-lg border border-border px-3 py-2 text-xs text-muted transition-colors hover:text-white disabled:opacity-50"
          >
            Refresh Strava zones
          </button>
        )}
      </div>
    </div>
  );
}

type PaceZoneMode = "custom" | "default";

function paceSourceDescription(mode: PaceZoneMode): string {
  if (mode === "custom") return "Using custom pace zones.";
  return "Using default pace zones.";
}

function PaceZonesSettings({
  initialZones,
  units,
  suggestion,
  onSuggestionHandled,
}: {
  initialZones: PaceZone[] | null | undefined;
  units: Units;
  suggestion: PaceZoneSuggestion | null;
  onSuggestionHandled: () => void;
}) {
  const router = useRouter();
  const initialCustomZones = normalizePaceZones(initialZones);
  const initialMode: PaceZoneMode = initialCustomZones ? "custom" : "default";
  const [boundaries, setBoundaries] = useState<number[]>(() => paceUnitBoundariesFromZones(initialCustomZones ?? DEFAULT_PACE_ZONES, units));
  const [customBoundaries, setCustomBoundaries] = useState<number[]>(() => paceUnitBoundariesFromZones(initialCustomZones ?? DEFAULT_PACE_ZONES, units));
  const [savedCustomBoundaries, setSavedCustomBoundaries] = useState<number[]>(() => paceUnitBoundariesFromZones(initialCustomZones ?? DEFAULT_PACE_ZONES, units));
  const [mode, setMode] = useState<PaceZoneMode>(initialMode);
  const [savedMode, setSavedMode] = useState<PaceZoneMode>(initialMode);
  const [loading, setLoading] = useState(!initialCustomZones);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const paceUnit = units === "imperial" ? "min/mi" : "min/km";
  const domain = paceSliderDomain(boundaries, units);
  const segments = paceSegments(boundaries, paceUnit);
  const customMode = mode === "custom";
  const hasUnsavedChanges =
    mode !== savedMode ||
    (customMode && customBoundaries.some((boundary, index) => boundary !== savedCustomBoundaries[index]));

  useEffect(() => {
    let active = true;

    async function loadInitialZones() {
      try {
        const response = await fetch("/api/strava/zones", { cache: "no-store" });
        const body = await response.json().catch(() => null) as HRZonesResponse | null;
        if (!active) return;
        if (!response.ok) throw new Error("Failed to load pace zones.");

        const zones = normalizePaceZones(body?.pace) ?? DEFAULT_PACE_ZONES;
        const nextMode: PaceZoneMode = body?.paceSource === "profile" ? "custom" : "default";
        const nextBoundaries = paceUnitBoundariesFromZones(zones, units);
        setBoundaries(nextBoundaries);
        setMode(nextMode);
        setSavedMode(nextMode);
        setCustomBoundaries(nextBoundaries);
        setSavedCustomBoundaries(nextBoundaries);
      } catch {
        if (!active) return;
        const fallbackBoundaries = fallbackPaceBoundaries(units);
        setBoundaries(fallbackBoundaries);
        setCustomBoundaries(fallbackBoundaries);
        setSavedCustomBoundaries(fallbackBoundaries);
        setError("Could not load pace zones. Using fallback zones.");
      } finally {
        if (active) setLoading(false);
      }
    }

    void loadInitialZones();
    return () => {
      active = false;
    };
  }, [units]);

  function updateBoundary(index: number, value: number) {
    if (!customMode) return;
    setBoundaries((current) => {
      const next = clampDescendingBoundary(current, index, value, paceSliderDomain(current, units), PACE_ZONE_STEP, PACE_ZONE_MIN_GAP);
      setCustomBoundaries(next);
      return next;
    });
    setMessage(null);
    setError(null);
  }

  function previewMode(nextMode: PaceZoneMode) {
    if (saving || loading) return;
    setMode(nextMode);
    setMessage(null);
    setError(null);

    if (nextMode === "custom") {
      setBoundaries(customBoundaries);
    } else {
      setBoundaries(fallbackPaceBoundaries(units));
    }
  }

  async function savePaceSettings() {
    if (saving) return;
    let zones: PaceZone[] | null = null;

    if (customMode) {
      zones = paceZonesFromUnitBoundaries(customBoundaries, units);
      if (!zones) {
        setError("Pace dividers must stay ordered from slower Zone 1 to faster Zone 6.");
        return;
      }
    }

    setSaving(true);
    setError(null);
    const result = await saveProfile({ pace_zones: customMode ? zones : null });
    setSaving(false);

    if (result.error) {
      setError("Failed to save pace settings. Please try again.");
      return;
    }

    setSavedMode(mode);
    if (customMode && zones) {
      const nextBoundaries = paceUnitBoundariesFromZones(zones, units);
      setBoundaries(nextBoundaries);
      setCustomBoundaries(nextBoundaries);
      setSavedCustomBoundaries(nextBoundaries);
    } else {
      setBoundaries(fallbackPaceBoundaries(units));
    }

    setMessage("Pace settings saved.");
    setTimeout(() => setMessage(null), 2000);
    router.refresh();
  }

  async function acceptSuggestion() {
    if (saving || !suggestion) return;

    setSaving(true);
    setError(null);
    const result = await saveProfile({
      pace_zones: suggestion.zones,
      ignored_pace_zone_suggestion_hash: null,
    });
    setSaving(false);

    if (result.error) {
      setError("Failed to save suggested pace zones. Please try again.");
      return;
    }

    const nextBoundaries = paceUnitBoundariesFromZones(suggestion.zones, units);
    setBoundaries(nextBoundaries);
    setCustomBoundaries(nextBoundaries);
    setSavedCustomBoundaries(nextBoundaries);
    setMode("custom");
    setSavedMode("custom");
    setMessage("Suggested pace zones saved.");
    onSuggestionHandled();
    setTimeout(() => setMessage(null), 2000);
    router.refresh();
  }

  async function ignoreSuggestion() {
    if (saving || !suggestion) return;

    setSaving(true);
    setError(null);
    const result = await saveProfile({ ignored_pace_zone_suggestion_hash: suggestion.hash });
    setSaving(false);

    if (result.error) {
      setError("Failed to ignore pace suggestion. Please try again.");
      return;
    }

    setMessage("Pace suggestion ignored.");
    onSuggestionHandled();
    setTimeout(() => setMessage(null), 2000);
    router.refresh();
  }

  return (
    <div className="card p-4 flex flex-col gap-4">
      <div>
        <div className="font-medium text-sm">Pace zones</div>
        <div className="text-xs text-muted mt-0.5">
          {loading ? "Loading zones..." : `${paceSourceDescription(mode)} Values are shown as ${paceUnit}.`}
        </div>
      </div>

      <div className="grid gap-2">
        <div className="text-[10px] font-medium uppercase tracking-[0.14em] text-muted">Mode</div>
        <div className="grid grid-cols-2 gap-2">
          {([
            ["default", "Default"],
            ["custom", "Custom"],
          ] as const).map(([value, label]) => (
            <button
              key={value}
              type="button"
              onClick={() => previewMode(value)}
              disabled={loading || saving}
              className={`rounded-lg border px-3 py-2 text-xs font-medium transition-colors disabled:opacity-45 ${
                mode === value
                  ? "border-accent bg-accent/15 text-white"
                  : "border-border text-muted hover:text-white"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <ZoneBoundaryBar
        ariaLabel="Pace zone boundaries"
        boundaries={boundaries}
        disabled={loading || saving || !customMode}
        startLabel={`Slow ${formatPaceSeconds(domain.slow)}`}
        endLabel={`Fast ${formatPaceSeconds(domain.fast)}`}
        segments={segments}
        summaryGridClassName="grid-cols-2 sm:grid-cols-3 lg:grid-cols-6"
        valueToPercent={(value) => ((domain.slow - value) / (domain.slow - domain.fast)) * 100}
        percentToValue={(percent) => domain.slow - (percent / 100) * (domain.slow - domain.fast)}
        formatValue={(value) => `${formatPaceSeconds(value)} ${paceUnit}`}
        compactFormatValue={(value) => formatPaceSeconds(value)}
        getAriaBounds={(index) => ({
          min: index === boundaries.length - 1 ? domain.fast + PACE_ZONE_MIN_GAP : boundaries[index + 1] + PACE_ZONE_MIN_GAP,
          max: index === 0 ? domain.slow - PACE_ZONE_MIN_GAP : boundaries[index - 1] - PACE_ZONE_MIN_GAP,
        })}
        onChange={updateBoundary}
      />

      {suggestion && (
        <ZoneSuggestionBox
          detail={(() => {
            const suggestedBoundaries = paceUnitBoundariesFromZones(suggestion.zones, units);
            return (
              <ZoneSuggestionDetail
                confidence={suggestion.confidence}
                summary={suggestion.summary}
                currentLabel={`${formatBoundarySet(boundaries, formatPaceSeconds)} ${paceUnit}`}
                suggestedLabel={`${formatBoundarySet(suggestedBoundaries, formatPaceSeconds)} ${paceUnit}`}
                basis={`Threshold pace is estimated at ${formatPaceSeconds(paceSecondsPerKmToUnitSeconds(suggestion.basis.thresholdPaceSecondsPerKm, units))} ${paceUnit} from ${formatPaceSampleSources(suggestion.basis.bestEffortSamples, suggestion.basis.streamSamples)}.`}
                changes={boundaryChangeRows(
                  boundaries,
                  suggestedBoundaries,
                  formatPaceSeconds,
                  formatPaceDelta
                )}
              />
            );
          })()}
          disabled={loading || saving}
          onAccept={() => void acceptSuggestion()}
          onIgnore={() => void ignoreSuggestion()}
        />
      )}

      {(message || error) && (
        <div className={`text-xs ${error ? "text-red-400" : "text-green-400"}`}>
          {error ?? message}
        </div>
      )}

      <div className="flex flex-col gap-2 sm:flex-row">
        <button
          type="button"
          onClick={() => void savePaceSettings()}
          disabled={loading || saving}
          className="rounded-lg bg-accent px-3 py-2 text-xs font-medium text-white disabled:opacity-50"
        >
          {saving ? "Saving..." : hasUnsavedChanges ? "Save changes" : "Save settings"}
        </button>
      </div>
    </div>
  );
}

function muscleLabel(muscle: MuscleGroup): string {
  return muscle.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function isRestName(name: string): boolean {
  return name.trim().toLowerCase() === "rest";
}

function isRestDayType(dayType: DayType | undefined): boolean {
  return !dayType || isRestName(dayType.name);
}

function sortScheduleDayTypes(types: DayType[]): DayType[] {
  return [...types].sort((a, b) => {
    const aRest = isRestName(a.name);
    const bRest = isRestName(b.name);
    if (aRest !== bRest) return aRest ? -1 : 1;
    return a.name.localeCompare(b.name);
  });
}

function findRestTypeId(types: DayType[], category: DayType["category"]): string | undefined {
  return types.find((dt) => dt.category === category && isRestName(dt.name))?.id;
}

async function deleteAxisCaches() {
  if (!("caches" in window)) return 0;

  const keys = await caches.keys();
  const axisKeys = keys.filter((key) => key.startsWith("axis-pwa-"));
  await Promise.all(axisKeys.map((key) => caches.delete(key)));
  navigator.serviceWorker?.controller?.postMessage({ type: "CLEAR_AXIS_CACHE" });
  return axisKeys.length;
}

function rowsFromResult(data: unknown): PortableRow[] {
  return Array.isArray(data) ? data.filter((row): row is PortableRow => typeof row === "object" && row !== null && !Array.isArray(row)) : [];
}

function rowFromResult(data: unknown): PortableRow | null {
  return typeof data === "object" && data !== null && !Array.isArray(data) ? data as PortableRow : null;
}

function chunkRows<T>(rows: T[], size = 250): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < rows.length; i += size) chunks.push(rows.slice(i, i + size));
  return chunks;
}

function downloadFile(filename: string, contents: string, type: string) {
  const blob = new Blob([contents], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function SettingsClient({
  profile,
  schedule,
  dayTypes,
  notificationPreferences,
  notificationSubscriptionCount,
  stravaConnected,
  stravaStatus,
}: Props) {
  const supabase = createClient();
  const router = useRouter();
  const jsonImportInputRef = useRef<HTMLInputElement>(null);
  const csvImportInputRef = useRef<HTMLInputElement>(null);
  const workoutRestTypeId = findRestTypeId(dayTypes, "strength");
  const cardioRestTypeId = findRestTypeId(dayTypes, "run");
  const [saveStatus, setSaveStatus] = useState<{ saving: boolean; saved: boolean; error: string | null }>({ saving: false, saved: false, error: null });
  const [disconnecting, setDisconnecting] = useState(false);
  const [cacheStatus, setCacheStatus] = useState<{
    clearing: boolean;
    message: string | null;
    error: string | null;
  }>({ clearing: false, message: null, error: null });
  const [portableStatus, setPortableStatus] = useState<{
    exporting: PortableFormat | null;
    importing: PortableFormat | null;
    message: string | null;
    error: string | null;
  }>({ exporting: null, importing: null, message: null, error: null });
  const [notificationPrefs, setNotificationPrefs] = useState<NotificationPrefsState>(() => normalizeNotificationPrefs(notificationPreferences));
  const [notificationStatus, setNotificationStatus] = useState<{
    supported: boolean;
    checked: boolean;
    permission: NotificationPermission | "unsupported";
    saving: boolean;
    message: string | null;
    error: string | null;
  }>({
    supported: false,
    checked: false,
    permission: "unsupported",
    saving: false,
    message: null,
    error: null,
  });
  const [planMaps, setPlanMaps] = useState<{ strength: Record<number, string>; cardio: Record<number, string> }>(() => {
    const strength: Record<number, string> = {};
    const cardio: Record<number, string> = {};
    for (const r of schedule) {
      if (r.day_type_id) strength[r.day_of_week] = r.day_type_id;
      if (r.cardio_day_type_id) cardio[r.day_of_week] = r.cardio_day_type_id;
    }
    return { strength, cardio };
  });
  const [preferences, setPreferences] = useState<{ units: Units; accent: AccentColor }>({
    units: profile?.units ?? "imperial",
    accent: profile?.accent_color ?? "blue",
  });
  const [displayName, setDisplayName] = useState(profile?.display_name ?? "");
  const [displayNameDraft, setDisplayNameDraft] = useState(profile?.display_name ?? "");
  const [zoneSuggestions, setZoneSuggestions] = useState<ZoneSuggestionsResponse>({});
  const { units, accent } = preferences;
  const webPushPublicKey = process.env.NEXT_PUBLIC_WEB_PUSH_PUBLIC_KEY ?? "";

  const { saving, saved, error: saveError } = saveStatus;

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const supported = pushSupported(webPushPublicKey);

      setNotificationStatus((prev) => ({
        ...prev,
        supported,
        checked: true,
        permission: supported ? Notification.permission : "unsupported",
        error: supported ? null : webPushPublicKey ? null : "Web Push is not configured.",
      }));
    }, 0);

    return () => window.clearTimeout(timer);
  }, [webPushPublicKey]);

  useEffect(() => {
    let active = true;

    async function loadZoneSuggestions() {
      try {
        const response = await fetch("/api/zones/suggestions", { cache: "no-store" });
        const body = await response.json().catch(() => null) as ZoneSuggestionsResponse | null;
        if (!active || !response.ok) return;
        setZoneSuggestions(body ?? {});
      } catch {
        if (active) setZoneSuggestions({});
      }
    }

    void loadZoneSuggestions();
    return () => {
      active = false;
    };
  }, []);

  async function persistProfile(next: { units?: Units; accent?: AccentColor }) {
    setSaveStatus({ saving: true, saved: false, error: null });

    const nextUnits = next.units ?? units;
    const nextAccent = next.accent ?? accent;
    const { error } = await saveProfile({ units: nextUnits, accent_color: nextAccent });

    if (error) {
      setSaveStatus({ saving: false, saved: false, error: "Failed to save settings. Please try again." });
      return false;
    }

    setSaveStatus({ saving: false, saved: true, error: null });
    setTimeout(() => setSaveStatus((prev) => ({ ...prev, saved: false })), 2000);
    router.refresh();
    document.documentElement.style.setProperty("--accent", ACCENT_COLORS.find((c) => c.value === nextAccent)?.hex ?? "#3B82F6");
    return true;
  }

  async function handleDisplayNameSave() {
    if (saving) return;
    const normalized = displayNameDraft.trim();
    if (normalized === displayName) return;

    setSaveStatus({ saving: true, saved: false, error: null });
    const { error } = await saveProfile({ display_name: normalized || null });

    if (error) {
      setSaveStatus({ saving: false, saved: false, error: "Failed to save settings. Please try again." });
      return;
    }

    setDisplayName(normalized);
    setDisplayNameDraft(normalized);
    setSaveStatus({ saving: false, saved: true, error: null });
    setTimeout(() => setSaveStatus((prev) => ({ ...prev, saved: false })), 2000);
    router.refresh();
  }

  async function handleUnitsChange(nextUnits: Units) {
    if (nextUnits === units || saving) return;
    const previousUnits = units;
    setPreferences((prev) => ({ ...prev, units: nextUnits }));
    const ok = await persistProfile({ units: nextUnits });
    if (!ok) setPreferences((prev) => ({ ...prev, units: previousUnits }));
  }

  async function handleAccentChange(nextAccent: AccentColor) {
    if (nextAccent === accent || saving) return;
    const previousAccent = accent;
    setPreferences((prev) => ({ ...prev, accent: nextAccent }));
    document.documentElement.style.setProperty("--accent", ACCENT_COLORS.find((c) => c.value === nextAccent)?.hex ?? "#3B82F6");
    const ok = await persistProfile({ accent: nextAccent });
    if (!ok) {
      setPreferences((prev) => ({ ...prev, accent: previousAccent }));
      document.documentElement.style.setProperty("--accent", ACCENT_COLORS.find((c) => c.value === previousAccent)?.hex ?? "#3B82F6");
    }
  }

  async function handleDisconnectStrava() {
    if (!profile?.id || disconnecting) return;
    setDisconnecting(true);
    const { error } = await supabase
      .from("profiles")
      .update({ strava_access_token: null, strava_refresh_token: null, token_expires_at: null })
      .eq("id", profile.id);
    setDisconnecting(false);
    if (error) setSaveStatus((prev) => ({ ...prev, error: "Failed to disconnect Strava. Please try again." }));
    else window.location.reload();
  }

  async function persistScheduleRow(dayIndex: number, workoutVal: string | null, cardioVal: string | null) {
    setSaveStatus((prev) => ({ ...prev, error: null }));
    const { error } = await saveWeeklyScheduleDay({ day_of_week: dayIndex, day_type_id: workoutVal, cardio_day_type_id: cardioVal });
    if (error) {
      console.error("[settings] schedule save failed", error);
      setSaveStatus((prev) => ({ ...prev, error: "Failed to save schedule. Please try again." }));
      return false;
    }
    router.refresh();
    return true;
  }

  async function handleScheduleChange(dayIndex: number, val: string) {
    const previousWorkout = getWorkoutSelection(dayIndex);
    setPlanMaps((prev) => ({ ...prev, strength: { ...prev.strength, [dayIndex]: val } }));
    const ok = await persistScheduleRow(dayIndex, val || null, getCardioSelection(dayIndex) || null);
    if (!ok) setPlanMaps((prev) => ({ ...prev, strength: { ...prev.strength, [dayIndex]: previousWorkout } }));
  }

  async function handleCardioChange(dayIndex: number, val: string) {
    const previousCardio = getCardioSelection(dayIndex);
    setPlanMaps((prev) => ({ ...prev, cardio: { ...prev.cardio, [dayIndex]: val } }));
    const ok = await persistScheduleRow(dayIndex, getWorkoutSelection(dayIndex) || null, val || null);
    if (!ok) setPlanMaps((prev) => ({ ...prev, cardio: { ...prev.cardio, [dayIndex]: previousCardio } }));
  }

  async function buildPortableExport() {
    const { data: authData } = await supabase.auth.getUser();
    const userId = authData.user?.id;
    if (!userId) throw new Error("Not authenticated.");

    const [
      profileRes,
      notificationPreferencesRes,
      dayTypesRes,
      scheduleRes,
      overridesRes,
      plannedSlotsRes,
      activitiesRes,
      setsRes,
      checkinsRes,
    ] = await Promise.all([
      supabase
        .from("profiles")
        .select("id, units, accent_color, display_name, onboarding_completed_at, hr_zones, hr_zone_method, max_heart_rate, pace_zones, created_at")
        .eq("id", userId)
        .maybeSingle(),
      supabase
        .from("notification_preferences")
        .select("user_id, enabled, today_plan_enabled, today_plan_time, pending_strava_enabled, plan_nudge_enabled, plan_nudge_time, weekly_review_enabled, weekly_review_day, weekly_review_time, timezone, created_at, updated_at")
        .eq("user_id", userId)
        .maybeSingle(),
      supabase
        .from("day_types")
        .select("id, name, category, muscle_focus")
        .order("name"),
      supabase
        .from("weekly_schedule")
        .select("id, user_id, day_of_week, day_type_id, cardio_day_type_id, active")
        .eq("user_id", userId)
        .order("day_of_week"),
      supabase
        .from("schedule_overrides")
        .select("id, user_id, date, slot, day_type_id, created_at")
        .eq("user_id", userId)
        .order("date"),
      supabase
        .from("planned_slots")
        .select("id, user_id, week_start, date, day_of_week, slot, planned_day_type_id, effective_day_type_id, is_overridden, is_skipped, created_at, updated_at")
        .eq("user_id", userId)
        .order("date"),
      supabase
        .from("activities")
        .select("id, user_id, strava_activity_id, type, day_type_id, start_time, duration, source, distance, avg_heartrate, max_heartrate, suffer_score, calories, elevation_gain, avg_pace, tags, notes, created_at, name, summary_polyline, splits, best_efforts, avg_cadence, avg_watts, elapsed_time, max_speed, average_temp")
        .eq("user_id", userId)
        .order("start_time", { ascending: false }),
      supabase
        .from("session_sets")
        .select("id, activity_id, exercise_id, set_number, reps, weight, rpe, created_at")
        .order("created_at"),
      supabase
        .from("daily_checkins")
        .select("id, user_id, date, body_weight, notes, created_at")
        .eq("user_id", userId)
        .order("date", { ascending: false }),
    ]);

    const failed = [
      ["profile", profileRes.error],
      ["notification preferences", notificationPreferencesRes.error],
      ["day types", dayTypesRes.error],
      ["weekly schedule", scheduleRes.error],
      ["schedule overrides", overridesRes.error],
      ["planned slots", plannedSlotsRes.error],
      ["activities", activitiesRes.error],
      ["sets", setsRes.error],
      ["check-ins", checkinsRes.error],
    ].find(([, error]) => error);

    if (failed) throw new Error(`Could not export ${failed[0]}.`);

    return createPortableData({
      profile: rowFromResult(profileRes.data),
      notification_preferences: rowFromResult(notificationPreferencesRes.data),
      day_types: rowsFromResult(dayTypesRes.data),
      weekly_schedule: rowsFromResult(scheduleRes.data),
      schedule_overrides: rowsFromResult(overridesRes.data),
      planned_slots: rowsFromResult(plannedSlotsRes.data),
      activities: rowsFromResult(activitiesRes.data),
      session_sets: rowsFromResult(setsRes.data),
      daily_checkins: rowsFromResult(checkinsRes.data),
    });
  }

  async function exportData(format: PortableFormat) {
    if (portableStatus.exporting) return;
    setPortableStatus({ exporting: format, importing: null, message: null, error: null });

    try {
      const data = await buildPortableExport();
      const date = localDateKey(new Date());
      if (format === "json") {
        downloadFile(`axis-export-${date}.json`, JSON.stringify(data, null, 2), "application/json");
      } else {
        downloadFile(`axis-export-${date}.csv`, portableDataToCsv(data), "text/csv");
      }
      setPortableStatus({
        exporting: null,
        importing: null,
        message: `Exported ${countPortableRows(data)} records.`,
        error: null,
      });
    } catch (err) {
      console.error("[settings] export failed", err);
      setPortableStatus({
        exporting: null,
        importing: null,
        message: null,
        error: err instanceof Error ? err.message : "Failed to export data.",
      });
    }
  }

  async function upsertPortableRows(table: string, rows: PortableRow[], onConflict: string) {
    for (const chunk of chunkRows(rows)) {
      const { error } = await supabase.from(table).upsert(chunk, { onConflict });
      if (error) throw new Error(`${table}: ${error.message}`);
    }
  }

  async function insertPortableRows(table: string, rows: PortableRow[]) {
    for (const chunk of chunkRows(rows)) {
      const { error } = await supabase.from(table).insert(chunk);
      if (error) throw new Error(`${table}: ${error.message}`);
    }
  }

  async function insertMissingDayTypes(rows: PortableRow[]) {
    if (rows.length === 0) return;
    const ids = rows.map((row) => row.id).filter((id): id is string => typeof id === "string" && id.length > 0);
    if (ids.length === 0) {
      await insertPortableRows("day_types", rows);
      return;
    }

    const { data, error } = await supabase.from("day_types").select("id").in("id", ids);
    if (error) throw new Error(`day_types: ${error.message}`);

    const existing = new Set(rowsFromResult(data).map((row) => row.id).filter((id): id is string => typeof id === "string"));
    const missing = rows.filter((row) => typeof row.id !== "string" || !existing.has(row.id));
    if (missing.length > 0) await insertPortableRows("day_types", missing);
  }

  async function applyPortableImport(data: PreparedPortableImport) {
    if (data.profile) await upsertPortableRows("profiles", [data.profile], "id");
    if (data.notification_preferences) {
      await upsertPortableRows("notification_preferences", [data.notification_preferences], "user_id");
    }
    await insertMissingDayTypes(data.day_types);
    await upsertPortableRows("weekly_schedule", data.weekly_schedule, "user_id,day_of_week");
    await upsertPortableRows("schedule_overrides", data.schedule_overrides, "user_id,date,slot");
    await upsertPortableRows("planned_slots", data.planned_slots, "user_id,date,slot");
    await upsertPortableRows("activities", data.activities, "id");
    await upsertPortableRows("daily_checkins", data.daily_checkins, "user_id,date");

    if (data.session_sets.length > 0) {
      const activityIds = Array.from(
        new Set(data.session_sets.map((row) => row.activity_id).filter((id): id is string => typeof id === "string"))
      );
      for (const chunk of chunkRows(activityIds)) {
        const { error } = await supabase.from("session_sets").delete().in("activity_id", chunk);
        if (error) throw new Error(`session_sets: ${error.message}`);
      }
      await insertPortableRows("session_sets", data.session_sets);
    }
  }

  async function importData(format: PortableFormat, file: File | null) {
    if (!file || portableStatus.importing) return;
    setPortableStatus({ exporting: null, importing: format, message: null, error: null });

    try {
      const text = await file.text();
      const parsed = format === "csv" ? portableDataFromCsv(text) : parsePortableJson(text);
      const { data: authData } = await supabase.auth.getUser();
      const userId = authData.user?.id;
      if (!userId) throw new Error("Not authenticated.");

      const prepared = preparePortableImport(coercePortableData(parsed), userId);
      const recordCount = countPortableRows(prepared);
      if (recordCount === 0) throw new Error("No portable Axis records found.");
      if (!window.confirm(`Import ${recordCount} records into this account? Existing matching rows may be updated.`)) {
        setPortableStatus({ exporting: null, importing: null, message: null, error: null });
        return;
      }

      await applyPortableImport(prepared);
      setPortableStatus({
        exporting: null,
        importing: null,
        message: `Imported ${recordCount} records.`,
        error: null,
      });
      router.refresh();
    } catch (err) {
      console.error("[settings] import failed", err);
      setPortableStatus({
        exporting: null,
        importing: null,
        message: null,
        error: err instanceof Error ? err.message : "Failed to import data.",
      });
    }
  }

  function handleImportFile(format: PortableFormat, file: File | null) {
    void importData(format, file);
  }

  async function clearOfflineCache() {
    if (cacheStatus.clearing) return;
    if (!("caches" in window)) {
      setCacheStatus({ clearing: false, message: null, error: "Offline cache is not available in this browser." });
      return;
    }

    setCacheStatus({ clearing: true, message: null, error: null });

    try {
      const clearedCount = await deleteAxisCaches();
      setCacheStatus({
        clearing: false,
        message: clearedCount === 0 ? "Offline cache was already empty." : "Offline cache cleared.",
        error: null,
      });
      setTimeout(() => setCacheStatus((prev) => ({ ...prev, message: null })), 2500);
    } catch {
      setCacheStatus({ clearing: false, message: null, error: "Failed to clear offline cache. Please try again." });
    }
  }

  async function enableNotifications() {
    if (notificationStatus.saving) return;
    if (!notificationStatus.supported || !webPushPublicKey) {
      setNotificationStatus((prev) => ({ ...prev, error: "Notifications are not available here.", message: null }));
      return;
    }

    setNotificationStatus((prev) => ({ ...prev, saving: true, error: null, message: null }));

    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setNotificationStatus((prev) => ({
          ...prev,
          saving: false,
          permission,
          error: "Notification permission was not granted.",
        }));
        return;
      }

      const subscription = await getOrCreatePushSubscription(webPushPublicKey);
      const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
      const response = await savePushSubscription(subscription, { enable: true });

      if (!response.ok) throw new Error("Subscription save failed");

      setNotificationPrefs((prev) => ({ ...prev, enabled: true, timezone }));
      setNotificationStatus({
        supported: true,
        checked: true,
        permission,
        saving: false,
        message: "Notifications enabled.",
        error: null,
      });
      router.refresh();
    } catch (err) {
      setNotificationStatus((prev) => ({
        ...prev,
        saving: false,
        error: "Failed to enable notifications. Please try again.",
        message: null,
      }));
      console.error("[settings] enable notifications failed", String(err));
    }
  }

  async function disableNotifications() {
    if (notificationStatus.saving) return;
    setNotificationStatus((prev) => ({ ...prev, saving: true, error: null, message: null }));

    try {
      const registration = "serviceWorker" in navigator ? await navigator.serviceWorker.getRegistration("/") : null;
      const subscription = registration ? await registration.pushManager.getSubscription() : null;
      const endpoint = subscription?.endpoint;
      if (subscription) await subscription.unsubscribe();

      const response = await fetch("/api/notifications/subscriptions", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ endpoint }),
      });

      if (!response.ok) throw new Error("Subscription delete failed");

      setNotificationPrefs((prev) => ({ ...prev, enabled: false }));
      setNotificationStatus((prev) => ({
        ...prev,
        saving: false,
        message: "Notifications disabled.",
        error: null,
      }));
      router.refresh();
    } catch (err) {
      setNotificationStatus((prev) => ({
        ...prev,
        saving: false,
        error: "Failed to disable notifications. Please try again.",
        message: null,
      }));
      console.error("[settings] disable notifications failed", String(err));
    }
  }

  async function persistNotificationPatch(patch: Partial<NotificationPrefsState>) {
    if (notificationStatus.saving) return;
    const previous = notificationPrefs;
    const next = { ...previous, ...patch };
    setNotificationPrefs(next);
    setNotificationStatus((prev) => ({ ...prev, saving: true, error: null, message: null }));

    const { error } = await saveNotificationPreferences({
      ...next,
      timezone: next.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC",
    });

    if (error) {
      setNotificationPrefs(previous);
      setNotificationStatus((prev) => ({
        ...prev,
        saving: false,
        error: "Failed to save notification settings. Please try again.",
      }));
      return;
    }

    setNotificationStatus((prev) => ({
      ...prev,
      saving: false,
      message: "Notification settings saved.",
      error: null,
    }));
    setTimeout(() => setNotificationStatus((prev) => ({ ...prev, message: null })), 2000);
  }

  function getWorkoutSelection(dayIndex: number): string {
    return planMaps.strength[dayIndex] ?? workoutRestTypeId ?? "";
  }

  function getCardioSelection(dayIndex: number): string {
    return planMaps.cardio[dayIndex] ?? cardioRestTypeId ?? "";
  }

  const strengthTypes = sortScheduleDayTypes(dayTypes.filter((dt) => dt.category === "strength"));
  const runTypes = sortScheduleDayTypes(dayTypes.filter((dt) => dt.category === "run"));
  const dayTypeById = new Map(dayTypes.map((dt) => [dt.id, dt]));
  const weeklyPlan = DAY_DISPLAY_ORDER.reduce(
    (summary, dayIdx) => {
      const strengthType = dayTypeById.get(getWorkoutSelection(dayIdx));
      const cardioType = dayTypeById.get(getCardioSelection(dayIdx));
      const hasStrength = strengthType?.category === "strength" && !isRestDayType(strengthType);
      const hasCardio = cardioType?.category === "run" && !isRestDayType(cardioType);

      if (hasStrength) {
        summary.strengthDays += 1;
        for (const muscle of strengthType.muscle_focus ?? []) {
          summary.muscleCoverage[muscle] = (summary.muscleCoverage[muscle] ?? 0) + 1;
        }
      }
      if (hasCardio) summary.cardioDays += 1;
      if (!hasStrength && !hasCardio) summary.fullRestDays += 1;
      if (hasStrength || hasCardio) summary.activeDays += 1;

      return summary;
    },
    {
      strengthDays: 0,
      cardioDays: 0,
      fullRestDays: 0,
      activeDays: 0,
      muscleCoverage: {} as Partial<Record<MuscleGroup, number>>,
    }
  );
  const focusedMuscles = MUSCLE_GROUPS
    .map((muscle) => ({ muscle, count: weeklyPlan.muscleCoverage[muscle] ?? 0 }))
    .filter((item) => item.count > 0)
    .sort((a, b) => b.count - a.count || muscleLabel(a.muscle).localeCompare(muscleLabel(b.muscle)))
    .slice(0, 6);

  return (
    <div className="flex flex-col gap-5">
      {(stravaStatus.connected || stravaStatus.error || saved || saveError) && (
        <div className="flex flex-col gap-3">
          {stravaStatus.connected && (
            <div className="px-4 py-2.5 bg-green-900/30 border border-green-700/40 rounded-lg text-sm text-green-400">
              Strava connected.
            </div>
          )}
          {stravaStatus.error && (
            <div className="px-4 py-2.5 bg-red-900/30 border border-red-700/40 rounded-lg text-sm text-red-400">
              {getStravaStatusError(stravaStatus.error)}
              {stravaStatus.detail && (
                <span className="block text-xs opacity-70 mt-1">({stravaStatus.detail})</span>
              )}
            </div>
          )}
          {saved && (
            <div className="px-4 py-2.5 bg-green-900/30 border border-green-700/40 rounded-lg text-sm text-green-400">
              Settings saved.
            </div>
          )}
          {saveError && (
            <div className="px-4 py-2.5 bg-red-900/30 border border-red-700/40 rounded-lg text-sm text-red-400">
              {saveError}
            </div>
          )}
        </div>
      )}

      <div className="mobile-landscape-stack grid gap-5 xl:grid-cols-[minmax(0,1fr)_22rem] xl:items-start">
        <div className="flex min-w-0 flex-col gap-5">
          <Section title="Weekly Schedule">
          <div className="card overflow-hidden divide-y divide-border">
            <div className="hidden xl:grid grid-cols-[minmax(7rem,1fr)_minmax(9rem,10rem)_minmax(9rem,10rem)] items-center px-4 py-2 gap-4">
              <span className="text-xs text-muted" />
              <span className="text-xs text-muted text-center">Workout</span>
              <span className="text-xs text-muted text-center">Cardio</span>
            </div>
            {DAY_DISPLAY_ORDER.map((dayIdx) => (
              <div
                key={`schedule-day-${dayIdx}`}
                className="flex flex-col gap-3 px-4 py-3 xl:grid xl:grid-cols-[minmax(7rem,1fr)_minmax(9rem,10rem)_minmax(9rem,10rem)] xl:items-center xl:gap-4"
              >
                <span className="text-sm font-medium">{DAY_NAMES[dayIdx]}</span>
                <div className="grid grid-cols-2 gap-3 xl:contents">
                  <div className="flex min-w-0 flex-col gap-1.5 xl:w-auto">
                    <span className="text-[10px] uppercase tracking-[0.16em] text-muted xl:hidden">Workout</span>
                    <Select
                      value={getWorkoutSelection(dayIdx)}
                      options={strengthTypes.map((dt) => ({ value: dt.id, label: dt.name }))}
                      placeholder="Rest"
                      showEmptyOption={!strengthTypes.some((dt) => isRestName(dt.name))}
                      ariaLabel={`${DAY_NAMES[dayIdx]} workout plan`}
                      onChange={(val) => {
                        void handleScheduleChange(dayIdx, val);
                      }}
                    />
                  </div>
                  <div className="flex min-w-0 flex-col gap-1.5 xl:w-auto">
                    <span className="text-[10px] uppercase tracking-[0.16em] text-muted xl:hidden">Cardio</span>
                    <Select
                      value={getCardioSelection(dayIdx)}
                      options={runTypes.map((dt) => ({ value: dt.id, label: dt.name }))}
                      placeholder="Rest"
                      showEmptyOption={!runTypes.some((dt) => isRestName(dt.name))}
                      ariaLabel={`${DAY_NAMES[dayIdx]} cardio plan`}
                      onChange={(val) => {
                        void handleCardioChange(dayIdx, val);
                      }}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="flex flex-col gap-3">
            <div className="grid grid-cols-[max-content_max-content] justify-center gap-x-8 gap-y-1 px-1 text-xs text-muted sm:flex sm:flex-wrap sm:items-center sm:justify-start sm:gap-x-0 sm:text-sm">
              {[
                { label: "strength days", value: weeklyPlan.strengthDays },
                { label: "cardio days", value: weeklyPlan.cardioDays },
                { label: "active days", value: weeklyPlan.activeDays },
                { label: "full rest days", value: weeklyPlan.fullRestDays },
              ].map((item) => (
                <span key={item.label} className="whitespace-nowrap sm:border-l sm:border-border sm:px-3 sm:first:border-l-0 sm:first:pl-0">
                  <span className="font-medium text-white">{item.value}</span> {item.label}
                </span>
              ))}
            </div>
            <div className="card p-4 flex items-center gap-4 lg:items-start">
              <MiniHeatmap coverage={weeklyPlan.muscleCoverage} />
              <div className="min-w-0 flex-1">
                <div className="text-sm font-medium">Muscle focus</div>
                {focusedMuscles.length > 0 ? (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {focusedMuscles.map(({ muscle, count }) => (
                      <span
                        key={muscle}
                        className="rounded-full border border-border bg-white/[0.03] px-2 py-1 text-[11px] text-white/70"
                      >
                        {muscleLabel(muscle)} {count}x
                      </span>
                    ))}
                  </div>
                ) : (
                  <div className="mt-1 text-xs text-muted">No strength focus scheduled.</div>
                )}
              </div>
            </div>
          </div>
          </Section>

          <Section title="Heart Rate">
            <HRZonesSettings
              initialZones={profile?.hr_zones}
              initialMethod={profile?.hr_zone_method}
              initialMaxHeartRate={profile?.max_heart_rate}
              stravaConnected={stravaConnected}
              suggestion={zoneSuggestions.hr ?? null}
              onSuggestionHandled={() => setZoneSuggestions((current) => ({ ...current, hr: null }))}
            />
          </Section>

          <Section title="Pace">
            <PaceZonesSettings
              initialZones={profile?.pace_zones}
              units={units}
              suggestion={zoneSuggestions.pace ?? null}
              onSuggestionHandled={() => setZoneSuggestions((current) => ({ ...current, pace: null }))}
            />
          </Section>
        </div>

        <div className="flex min-w-0 flex-col gap-5">
          <div className="order-3 xl:order-1">
            <Section title="Profile">
              <div className="card p-4 flex flex-col gap-3">
                <div>
                  <div className="font-medium text-sm">Display name</div>
                  <div className="text-xs text-muted mt-0.5">
                    Leave blank to use your Google account name automatically.
                  </div>
                </div>
                <div className="flex flex-col gap-2 sm:flex-row">
                  <input
                    id="display-name"
                    type="text"
                    value={displayNameDraft}
                    onChange={(e) => setDisplayNameDraft(e.target.value)}
                    placeholder="Use Google name"
                    className="min-w-0 flex-1 rounded-xl border border-border bg-white/[0.03] px-3 py-2 text-sm text-white placeholder:text-white/25 focus:border-border-strong focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => void handleDisplayNameSave()}
                    disabled={saving || displayNameDraft.trim() === displayName}
                    className="rounded-xl border border-border px-3 py-2 text-sm text-white/80 transition-colors hover:border-border-strong hover:text-white disabled:opacity-50"
                  >
                    Save
                  </button>
                </div>
              </div>
            </Section>
          </div>

          <div className="order-4 xl:order-2">
            <Section title="Preferences">
              <div className="card p-4 flex flex-col gap-5">
                <div className="flex flex-col gap-3">
                  <div className="font-medium text-sm">Units</div>
                  <div className="grid grid-cols-2 gap-2" role="group" aria-label="Units">
                    {(["metric", "imperial"] as const).map((u) => (
                      <button
                        key={u}
                        type="button"
                        aria-pressed={units === u}
                        onClick={() => void handleUnitsChange(u)}
                        disabled={saving}
                        className={`py-2 rounded-lg text-sm font-medium border transition-colors capitalize ${
                          units === u ? "border-accent text-accent" : "border-border text-muted"
                        } disabled:opacity-50`}
                      >
                        {u}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="h-px bg-border" />

                <div className="flex flex-col gap-3">
                  <div className="font-medium text-sm">Accent color</div>
                  <div className="flex flex-wrap gap-3" role="group" aria-label="Accent color">
                    {ACCENT_COLORS.map((c) => (
                      <button
                        key={c.value}
                        type="button"
                        aria-label={`${c.label} accent color`}
                        aria-pressed={accent === c.value}
                        onClick={() => void handleAccentChange(c.value)}
                        disabled={saving}
                        style={{ background: c.hex }}
                        className={`w-10 h-10 rounded-full border-2 transition-all ${
                          accent === c.value ? "border-white scale-110" : "border-transparent"
                        } disabled:opacity-50`}
                        title={c.label}
                      />
                    ))}
                  </div>
                </div>
              </div>
            </Section>
          </div>

          <div className="order-5 xl:order-3">
            <Section title="Notifications">
              <div className="card p-4 flex flex-col gap-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <div className="font-medium text-sm">
                      {notificationPrefs.enabled ? "Enabled" : "Disabled"}
                    </div>
                    <div className="text-xs text-muted mt-0.5">
                      {notificationSubscriptionCount > 0
                        ? `${notificationSubscriptionCount} device${notificationSubscriptionCount === 1 ? "" : "s"} subscribed`
                        : notificationStatus.checked && !notificationStatus.supported
                        ? "Unavailable in this browser"
                        : "No subscribed devices"}
                    </div>
                  </div>
                  {notificationPrefs.enabled ? (
                    <button
                      type="button"
                      onClick={() => void disableNotifications()}
                      disabled={notificationStatus.saving}
                      className="text-xs text-red-400 border border-red-400/30 rounded-lg px-3 py-2 disabled:opacity-50"
                    >
                      {notificationStatus.saving ? "Saving…" : "Disable"}
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => void enableNotifications()}
                      disabled={notificationStatus.saving || !notificationStatus.supported}
                      className="text-xs bg-accent text-white rounded-lg px-3 py-2 font-medium disabled:opacity-50"
                    >
                      {notificationStatus.saving ? "Enabling…" : "Enable"}
                    </button>
                  )}
                </div>

                {(notificationStatus.message || notificationStatus.error) && (
                  <div className={`text-xs ${notificationStatus.error ? "text-red-400" : "text-green-400"}`}>
                    {notificationStatus.error ?? notificationStatus.message}
                  </div>
                )}

                <div className="h-px bg-border" />

                <div className="flex flex-col gap-3">
                  <NotificationToggle
                    label="Today’s plan"
                    checked={notificationPrefs.today_plan_enabled}
                    disabled={!notificationPrefs.enabled || notificationStatus.saving}
                    onChange={(checked) => void persistNotificationPatch({ today_plan_enabled: checked })}
                  >
                    <input
                      type="time"
                      value={notificationPrefs.today_plan_time}
                      disabled={!notificationPrefs.enabled || !notificationPrefs.today_plan_enabled || notificationStatus.saving}
                      onChange={(e) => void persistNotificationPatch({ today_plan_time: e.target.value })}
                      className="rounded-lg border border-border bg-white/[0.03] px-2 py-1.5 text-xs text-white disabled:opacity-40"
                    />
                  </NotificationToggle>

                  <NotificationToggle
                    label="Pending Strava links"
                    checked={notificationPrefs.pending_strava_enabled}
                    disabled={!notificationPrefs.enabled || notificationStatus.saving}
                    onChange={(checked) => void persistNotificationPatch({ pending_strava_enabled: checked })}
                  />

                  <NotificationToggle
                    label="Plan nudge"
                    checked={notificationPrefs.plan_nudge_enabled}
                    disabled={!notificationPrefs.enabled || notificationStatus.saving}
                    onChange={(checked) => void persistNotificationPatch({ plan_nudge_enabled: checked })}
                  >
                    <input
                      type="time"
                      value={notificationPrefs.plan_nudge_time}
                      disabled={!notificationPrefs.enabled || !notificationPrefs.plan_nudge_enabled || notificationStatus.saving}
                      onChange={(e) => void persistNotificationPatch({ plan_nudge_time: e.target.value })}
                      className="rounded-lg border border-border bg-white/[0.03] px-2 py-1.5 text-xs text-white disabled:opacity-40"
                    />
                  </NotificationToggle>

                  <NotificationToggle
                    label="Weekly review"
                    checked={notificationPrefs.weekly_review_enabled}
                    disabled={!notificationPrefs.enabled || notificationStatus.saving}
                    onChange={(checked) => void persistNotificationPatch({ weekly_review_enabled: checked })}
                  >
                    <div className="flex items-center gap-2">
                      <select
                        value={notificationPrefs.weekly_review_day}
                        disabled={!notificationPrefs.enabled || !notificationPrefs.weekly_review_enabled || notificationStatus.saving}
                        onChange={(e) => void persistNotificationPatch({ weekly_review_day: Number(e.target.value) })}
                        className="rounded-lg border border-border bg-[#0A0A0A] px-2 py-1.5 text-xs text-white disabled:opacity-40"
                      >
                        {NOTIFICATION_DAYS.map((day) => (
                          <option key={day.value} value={day.value}>{day.label}</option>
                        ))}
                      </select>
                      <input
                        type="time"
                        value={notificationPrefs.weekly_review_time}
                        disabled={!notificationPrefs.enabled || !notificationPrefs.weekly_review_enabled || notificationStatus.saving}
                        onChange={(e) => void persistNotificationPatch({ weekly_review_time: e.target.value })}
                        className="rounded-lg border border-border bg-white/[0.03] px-2 py-1.5 text-xs text-white disabled:opacity-40"
                      />
                    </div>
                  </NotificationToggle>
                </div>
              </div>
            </Section>
          </div>

          <div className="order-1 xl:order-4">
            <Section title="Strava">
              <div className="card p-4 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between xl:flex-col xl:items-stretch">
                <div>
                  <div className="font-medium text-sm">
                    {stravaConnected ? "Connected" : "Not connected"}
                  </div>
                  <div className="text-xs text-muted mt-0.5">
                    {stravaConnected
                      ? "Activities sync automatically via webhook"
                      : "Connect to sync runs automatically"}
                  </div>
                </div>
                {stravaConnected ? (
                  <button
                    type="button"
                    onClick={handleDisconnectStrava}
                    disabled={disconnecting}
                    className="text-xs text-red-400 border border-red-400/30 rounded-lg px-3 py-2 disabled:opacity-50"
                  >
                    {disconnecting ? "Disconnecting…" : "Disconnect"}
                  </button>
                ) : (
                  <a
                    href="/api/strava/connect"
                    className="text-center text-xs bg-[#FC4C02] text-white rounded-lg px-3 py-2 font-medium"
                  >
                    Connect Strava
                  </a>
                )}
              </div>
            </Section>
          </div>

          <div className="order-2 xl:order-5">
            <Section title="Data & Storage">
              <div className="card p-4 flex flex-col gap-3">
                <div>
                  <div className="font-medium text-sm">Export</div>
                  <div className="text-xs text-muted mt-0.5">
                    Includes profile preferences, schedule, overrides, planned slots, day types, activities, sets, and check-ins.
                  </div>
                </div>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  <button
                    type="button"
                    onClick={() => void exportData("json")}
                    disabled={!!portableStatus.exporting || !!portableStatus.importing}
                    className="w-full border border-border py-3 rounded-lg text-sm text-muted hover:text-white transition-colors disabled:opacity-50"
                  >
                    {portableStatus.exporting === "json" ? "Exporting…" : "Export JSON"}
                  </button>
                  <button
                    type="button"
                    onClick={() => void exportData("csv")}
                    disabled={!!portableStatus.exporting || !!portableStatus.importing}
                    className="w-full border border-border py-3 rounded-lg text-sm text-muted hover:text-white transition-colors disabled:opacity-50"
                  >
                    {portableStatus.exporting === "csv" ? "Exporting…" : "Export CSV"}
                  </button>
                </div>

                <div className="h-px bg-border" />

                <div>
                  <div className="font-medium text-sm">Import</div>
                  <div className="text-xs text-muted mt-0.5">
                    Merges an Axis JSON or CSV export into this account.
                  </div>
                </div>
                {(portableStatus.message || portableStatus.error) && (
                  <div className={`text-xs ${portableStatus.error ? "text-red-400" : "text-green-400"}`}>
                    {portableStatus.error ?? portableStatus.message}
                  </div>
                )}
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  <button
                    type="button"
                    onClick={() => jsonImportInputRef.current?.click()}
                    disabled={!!portableStatus.exporting || !!portableStatus.importing}
                    className="w-full border border-border py-3 rounded-lg text-sm text-muted hover:text-white transition-colors disabled:opacity-50"
                  >
                    {portableStatus.importing === "json" ? "Importing…" : "Import JSON"}
                  </button>
                  <button
                    type="button"
                    onClick={() => csvImportInputRef.current?.click()}
                    disabled={!!portableStatus.exporting || !!portableStatus.importing}
                    className="w-full border border-border py-3 rounded-lg text-sm text-muted hover:text-white transition-colors disabled:opacity-50"
                  >
                    {portableStatus.importing === "csv" ? "Importing…" : "Import CSV"}
                  </button>
                </div>
                <input
                  ref={jsonImportInputRef}
                  type="file"
                  accept="application/json,.json"
                  className="hidden"
                  onChange={(e) => {
                    handleImportFile("json", e.currentTarget.files?.[0] ?? null);
                    e.currentTarget.value = "";
                  }}
                />
                <input
                  ref={csvImportInputRef}
                  type="file"
                  accept="text/csv,.csv"
                  className="hidden"
                  onChange={(e) => {
                    handleImportFile("csv", e.currentTarget.files?.[0] ?? null);
                    e.currentTarget.value = "";
                  }}
                />

                <div className="h-px bg-border" />

                <div>
                  <div className="font-medium text-sm">Offline storage</div>
                  <div className="text-xs text-muted mt-0.5">
                    Clears offline pages, static assets, and cached read-only API responses.
                  </div>
                </div>
                {(cacheStatus.message || cacheStatus.error) && (
                  <div className={`text-xs ${cacheStatus.error ? "text-red-400" : "text-green-400"}`}>
                    {cacheStatus.error ?? cacheStatus.message}
                  </div>
                )}
                <button
                  type="button"
                  onClick={() => void clearOfflineCache()}
                  disabled={cacheStatus.clearing}
                  className="w-full border border-border py-3 rounded-lg text-sm text-muted hover:text-white transition-colors disabled:opacity-50"
                >
                  {cacheStatus.clearing ? "Clearing…" : "Clear offline cache"}
                </button>
              </div>
            </Section>
          </div>

          <div className="order-6">
            <Section title="Account">
              <button
                type="button"
                onClick={async () => {
                  await deleteAxisCaches();
                  await supabase.auth.signOut();
                  router.push("/login");
                }}
                className="w-full border border-red-400/30 py-3 rounded-lg text-sm text-red-400 hover:border-red-400/60 transition-colors"
              >
                Sign out
              </button>
            </Section>
          </div>
        </div>
      </div>
    </div>
  );
}

function getStravaStatusError(error: string): string {
  if (error === "invalid_state") return "Strava connection could not be verified. Please try again.";
  if (error === "access_denied") return "Strava connection was cancelled.";
  if (error === "token_exchange_failed") return "Strava did not return valid access tokens. Please try again.";
  if (error === "save_failed") return "Strava connected, but Axis could not save the connection. Please try again.";
  return "Strava connection failed. Please try again.";
}
