"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { saveProfile, saveWeeklyScheduleDay } from "@/app/(tabs)/settings/actions";
import { Select } from "@/components/ui/Select";
import type { AccentColor, DayType, Profile, Units, WeeklyScheduleRow } from "@/types";

const DAY_NAMES = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
const DAY_DISPLAY_ORDER = [6, 0, 1, 2, 3, 4, 5];

const ACCENT_COLORS: { value: AccentColor; label: string; hex: string }[] = [
  { value: "blue", label: "Blue", hex: "#3B82F6" },
  { value: "green", label: "Green", hex: "#22C55E" },
  { value: "orange", label: "Orange", hex: "#F97316" },
  { value: "purple", label: "Purple", hex: "#A855F7" },
];

interface Props {
  profile: Profile | null;
  schedule: WeeklyScheduleRow[];
  dayTypes: DayType[];
  stravaConnected: boolean;
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-xs font-medium text-muted uppercase tracking-wide">{title}</h2>
      {children}
    </section>
  );
}

export function SettingsClient({ profile, schedule, dayTypes, stravaConnected }: Props) {
  const supabase = createClient();
  const router = useRouter();
  const [saveStatus, setSaveStatus] = useState<{ saving: boolean; saved: boolean; error: string | null }>({ saving: false, saved: false, error: null });
  const [disconnecting, setDisconnecting] = useState(false);
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

  async function handleUnitsChange(nextUnits: Units) {
    if (nextUnits === units || saving) return;
    const previousUnits = units;
    setUnits(nextUnits);
    const ok = await persistProfile({ units: nextUnits });
    if (!ok) setUnits(previousUnits);
  }

  async function handleAccentChange(nextAccent: AccentColor) {
    if (nextAccent === accent || saving) return;
    const previousAccent = accent;
    setAccent(nextAccent);
    document.documentElement.style.setProperty("--accent", ACCENT_COLORS.find((c) => c.value === nextAccent)?.hex ?? "#3B82F6");
    const ok = await persistProfile({ accent: nextAccent });
    if (!ok) {
      setAccent(previousAccent);
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
    const previousWorkout = planMaps.strength[dayIndex] ?? "";
    setPlanMaps((prev) => ({ ...prev, strength: { ...prev.strength, [dayIndex]: val } }));
    const ok = await persistScheduleRow(dayIndex, val || null, planMaps.cardio[dayIndex] ?? null);
    if (!ok) setPlanMaps((prev) => ({ ...prev, strength: { ...prev.strength, [dayIndex]: previousWorkout } }));
  }

  async function handleCardioChange(dayIndex: number, val: string) {
    const previousCardio = planMaps.cardio[dayIndex] ?? "";
    setPlanMaps((prev) => ({ ...prev, cardio: { ...prev.cardio, [dayIndex]: val } }));
    const ok = await persistScheduleRow(dayIndex, planMaps.strength[dayIndex] ?? null, val || null);
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

  const strengthTypes = dayTypes.filter((dt) => dt.category === "strength" || dt.name === "Rest");
  const runTypes = dayTypes.filter((dt) => dt.category === "run");

  return (
    <div className="flex flex-col gap-8">
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

      <Section title="Strava">
        <div className="card p-4 flex items-center justify-between">
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
              onClick={handleDisconnectStrava}
              disabled={disconnecting}
              className="text-xs text-red-400 border border-red-400/30 rounded-lg px-3 py-1.5 disabled:opacity-50"
            >
              {disconnecting ? "Disconnecting…" : "Disconnect"}
            </button>
          ) : (
            <Link
              href="/api/strava/connect"
              className="text-xs bg-[#FC4C02] text-white rounded-lg px-3 py-1.5 font-medium"
            >
              Connect Strava
            </Link>
          )}
        </div>
      </Section>

      <Section title="Units">
        <div className="card p-4 flex gap-2">
          {(["metric", "imperial"] as const).map((u) => (
            <button
              key={u}
              onClick={() => void handleUnitsChange(u)}
              disabled={saving}
              className={`flex-1 py-2 rounded-lg text-sm font-medium border transition-colors capitalize ${
                units === u ? "border-accent text-accent" : "border-border text-muted"
              } disabled:opacity-50`}
            >
              {u}
            </button>
          ))}
        </div>
      </Section>

      <Section title="Accent Color">
        <div className="card p-4 flex gap-3">
          {ACCENT_COLORS.map((c) => (
            <button
              key={c.value}
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
      </Section>

      <Section title="Weekly Schedule">
        <div className="card divide-y divide-border">
          <div className="flex items-center px-4 py-2 gap-4">
            <span className="text-xs text-muted flex-1" />
            <span className="text-xs text-muted w-[120px] text-center">Workout</span>
            <span className="text-xs text-muted w-[120px] text-center">Cardio</span>
          </div>
          {DAY_DISPLAY_ORDER.map((dayIdx) => (
            <div key={`schedule-day-${dayIdx}`} className="flex items-center gap-4 px-4 py-3">
              <span className="text-sm flex-1">{DAY_NAMES[dayIdx]}</span>
              <Select
                value={planMaps.strength[dayIdx] ?? ""}
                options={strengthTypes.map((dt) => ({ value: dt.id, label: dt.name }))}
                onChange={(val) => {
                  void handleScheduleChange(dayIdx, val);
                }}
              />
              <Select
                value={planMaps.cardio[dayIdx] ?? ""}
                options={runTypes.map((dt) => ({ value: dt.id, label: dt.name }))}
                onChange={(val) => {
                  void handleCardioChange(dayIdx, val);
                }}
              />
            </div>
          ))}
        </div>
      </Section>

      <Section title="Data">
        <button
          onClick={exportData}
          className="w-full border border-border py-3 rounded-lg text-sm text-muted hover:text-white transition-colors"
        >
          Export all data as JSON
        </button>
      </Section>

      <Section title="Account">
        <button
          onClick={async () => {
            await supabase.auth.signOut();
            router.push("/login");
          }}
          className="w-full border border-red-400/30 py-3 rounded-lg text-sm text-red-400 hover:border-red-400/60 transition-colors"
        >
          Sign out
        </button>
      </Section>
    </div>
  );
}
