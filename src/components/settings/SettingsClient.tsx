"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { saveNotificationPreferences, saveProfile, saveWeeklyScheduleDay } from "@/app/(tabs)/settings/actions";
import { Select } from "@/components/ui/Select";
import { MiniHeatmap } from "@/components/heatmap/MiniHeatmap";
import { ACCENT_COLORS } from "@/lib/accent-colors";
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

function urlBase64ToUint8Array(base64String: string): ArrayBuffer {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = `${base64String}${padding}`.replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  const buffer = new ArrayBuffer(rawData.length);
  const outputArray = new Uint8Array(buffer);

  for (let i = 0; i < rawData.length; i += 1) {
    outputArray[i] = rawData.charCodeAt(i);
  }

  return buffer;
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
    <div className="flex items-center justify-between gap-3 rounded-xl border border-border bg-white/[0.025] px-3 py-2.5">
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
      {children && <div className="shrink-0">{children}</div>}
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
  const { units, accent } = preferences;
  const webPushPublicKey = process.env.NEXT_PUBLIC_WEB_PUSH_PUBLIC_KEY ?? "";

  const { saving, saved, error: saveError } = saveStatus;

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const supported =
        "serviceWorker" in navigator &&
        "PushManager" in window &&
        "Notification" in window &&
        !!webPushPublicKey;

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
        .select("id, units, accent_color, display_name, onboarding_completed_at, created_at")
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
      const date = new Date().toISOString().split("T")[0];
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

  async function ensurePushRegistration(): Promise<ServiceWorkerRegistration> {
    const existing = await navigator.serviceWorker.getRegistration("/");
    if (existing) return existing;
    return navigator.serviceWorker.register("/sw.js", {
      scope: "/",
      updateViaCache: "none",
    });
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

      const registration = await ensurePushRegistration();
      const existingSubscription = await registration.pushManager.getSubscription();
      const subscription =
        existingSubscription ??
        await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(webPushPublicKey),
        });

      const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
      const response = await fetch("/api/notifications/subscriptions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          subscription: subscription.toJSON(),
          timezone,
          userAgent: navigator.userAgent,
        }),
      });

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

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_22rem] lg:items-start">
        <Section title="Weekly Schedule">
          <div className="card overflow-hidden divide-y divide-border">
            <div className="hidden md:grid grid-cols-[minmax(7rem,1fr)_minmax(9rem,10rem)_minmax(9rem,10rem)] items-center px-4 py-2 gap-4">
              <span className="text-xs text-muted" />
              <span className="text-xs text-muted text-center">Workout</span>
              <span className="text-xs text-muted text-center">Cardio</span>
            </div>
            {DAY_DISPLAY_ORDER.map((dayIdx) => (
              <div
                key={`schedule-day-${dayIdx}`}
                className="flex flex-col gap-3 px-4 py-3 md:grid md:grid-cols-[minmax(7rem,1fr)_minmax(9rem,10rem)_minmax(9rem,10rem)] md:items-center md:gap-4"
              >
                <span className="text-sm font-medium">{DAY_NAMES[dayIdx]}</span>
                <div className="grid grid-cols-2 gap-3 md:contents">
                  <div className="flex min-w-0 flex-col gap-1.5 md:w-auto">
                    <span className="text-[10px] uppercase tracking-[0.16em] text-muted md:hidden">Workout</span>
                    <Select
                      value={getWorkoutSelection(dayIdx)}
                      options={strengthTypes.map((dt) => ({ value: dt.id, label: dt.name }))}
                      placeholder="Rest"
                      showEmptyOption={!strengthTypes.some((dt) => isRestName(dt.name))}
                      onChange={(val) => {
                        void handleScheduleChange(dayIdx, val);
                      }}
                    />
                  </div>
                  <div className="flex min-w-0 flex-col gap-1.5 md:w-auto">
                    <span className="text-[10px] uppercase tracking-[0.16em] text-muted md:hidden">Cardio</span>
                    <Select
                      value={getCardioSelection(dayIdx)}
                      options={runTypes.map((dt) => ({ value: dt.id, label: dt.name }))}
                      placeholder="Rest"
                      showEmptyOption={!runTypes.some((dt) => isRestName(dt.name))}
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
            <div className="card p-4 flex items-center gap-4 md:items-start">
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

        <div className="flex flex-col gap-5">
          <Section title="Profile">
            <div className="card p-4 flex flex-col gap-3">
              <div>
                <div className="font-medium text-sm">Display name</div>
                <div className="text-xs text-muted mt-0.5">
                  Leave blank to use your Google account name automatically.
                </div>
              </div>
              <div className="flex flex-col gap-2 sm:flex-row lg:flex-col xl:flex-row">
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

          <Section title="Notifications">
            <div className="card p-4 flex flex-col gap-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between lg:flex-col lg:items-stretch xl:flex-row xl:items-center">
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

          <Section title="Strava">
            <div className="card p-4 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between lg:flex-col lg:items-stretch xl:flex-row xl:items-center">
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
  );
}

function getStravaStatusError(error: string): string {
  if (error === "invalid_state") return "Strava connection could not be verified. Please try again.";
  if (error === "access_denied") return "Strava connection was cancelled.";
  if (error === "token_exchange_failed") return "Strava did not return valid access tokens. Please try again.";
  if (error === "save_failed") return "Strava connected, but Axis could not save the connection. Please try again.";
  return "Strava connection failed. Please try again.";
}
