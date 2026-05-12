"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { saveProfile, saveWeeklyScheduleDay } from "@/app/(tabs)/settings/actions";
import { Select } from "@/components/ui/Select";
import { MiniHeatmap } from "@/components/heatmap/MiniHeatmap";
import { ACCENT_COLORS } from "@/lib/accent-colors";
import { MUSCLE_GROUPS, type AccentColor, type DayType, type MuscleGroup, type Profile, type Units, type WeeklyScheduleRow } from "@/types";

const DAY_NAMES = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
const DAY_DISPLAY_ORDER = [6, 0, 1, 2, 3, 4, 5];

interface Props {
  profile: Profile | null;
  schedule: WeeklyScheduleRow[];
  dayTypes: DayType[];
  stravaConnected: boolean;
  stravaStatus: {
    connected: boolean;
    error: string | null;
    detail?: string | null;
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

export function SettingsClient({ profile, schedule, dayTypes, stravaConnected, stravaStatus }: Props) {
  const supabase = createClient();
  const router = useRouter();
  const workoutRestTypeId = findRestTypeId(dayTypes, "strength");
  const cardioRestTypeId = findRestTypeId(dayTypes, "run");
  const [saveStatus, setSaveStatus] = useState<{ saving: boolean; saved: boolean; error: string | null }>({ saving: false, saved: false, error: null });
  const [disconnecting, setDisconnecting] = useState(false);
  const [cacheStatus, setCacheStatus] = useState<{
    clearing: boolean;
    message: string | null;
    error: string | null;
  }>({ clearing: false, message: null, error: null });
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

  const { saving, saved, error: saveError } = saveStatus;

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

  async function exportData() {
    const [activities, sets, checkins] = await Promise.all([
      supabase.from("activities").select("*"),
      supabase.from("session_sets").select("*"),
      supabase.from("daily_checkins").select("*"),
    ]);
    const blob = new Blob(
      [JSON.stringify({ activities: activities.data, sets: sets.data, checkins: checkins.data }, null, 2)],
      { type: "application/json" }
    );
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `axis-export-${new Date().toISOString().split("T")[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
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
              <button
                type="button"
                onClick={exportData}
                className="w-full border border-border py-3 rounded-lg text-sm text-muted hover:text-white transition-colors"
              >
                Export all data as JSON
              </button>

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
