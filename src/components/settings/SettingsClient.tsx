"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { AccentColor, DayType, Profile, Units, WeeklyScheduleRow } from "@/types";

const DAY_NAMES = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

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
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [disconnecting, setDisconnecting] = useState(false);

  const [units, setUnits] = useState<Units>(profile?.units ?? "metric");
  const [accent, setAccent] = useState<AccentColor>(profile?.accent_color ?? "blue");
  const [incUpper, setIncUpper] = useState(profile?.weight_increment_upper ?? 2.5);
  const [incLower, setIncLower] = useState(profile?.weight_increment_lower ?? 5.0);
  const [ohpBench, setOhpBench] = useState(profile?.ohp_bench_ratio ?? 0.65);
  const [dlSquat, setDlSquat] = useState(profile?.dl_squat_ratio ?? 1.20);
  const [volCeiling, setVolCeiling] = useState(profile?.volume_ceiling ?? 10);

  async function handleSave() {
    if (!profile?.id) return;
    setSaving(true);
    setSaveError(null);
    const { error } = await supabase
      .from("profiles")
      .update({
        units,
        accent_color: accent,
        weight_increment_upper: incUpper,
        weight_increment_lower: incLower,
        ohp_bench_ratio: ohpBench,
        dl_squat_ratio: dlSquat,
        volume_ceiling: volCeiling,
      })
      .eq("id", profile.id);
    setSaving(false);
    if (error) {
      setSaveError("Failed to save settings. Please try again.");
      return;
    }
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
    document.documentElement.style.setProperty(
      "--accent",
      ACCENT_COLORS.find((c) => c.value === accent)?.hex ?? "#3B82F6"
    );
  }

  async function handleDisconnectStrava() {
    if (!profile?.id || disconnecting) return;
    setDisconnecting(true);
    const { error } = await supabase
      .from("profiles")
      .update({ strava_access_token: null, strava_refresh_token: null, token_expires_at: null })
      .eq("id", profile.id);
    setDisconnecting(false);
    if (error) {
      setSaveError("Failed to disconnect Strava. Please try again.");
    } else {
      window.location.reload();
    }
  }

  async function handleScheduleChange(row: WeeklyScheduleRow | undefined, dayIndex: number, val: string) {
    if (!val) {
      if (row?.id) {
        const { error } = await supabase.from("weekly_schedule").delete().eq("id", row.id);
        if (error) console.error("[settings] schedule delete failed", error.message);
      }
    } else if (row?.id) {
      const { error } = await supabase.from("weekly_schedule").update({ day_type_id: val }).eq("id", row.id);
      if (error) console.error("[settings] schedule update failed", error.message);
    } else {
      const { error } = await supabase.from("weekly_schedule").insert({ day_of_week: dayIndex, day_type_id: val });
      if (error) console.error("[settings] schedule insert failed", error.message);
    }
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
            <a
              href="/api/strava/connect"
              className="text-xs bg-[#FC4C02] text-white rounded-lg px-3 py-1.5 font-medium"
            >
              Connect Strava
            </a>
          )}
        </div>
      </Section>

      <Section title="Units">
        <div className="card p-4 flex gap-2">
          {(["metric", "imperial"] as const).map((u) => (
            <button
              key={u}
              onClick={() => setUnits(u)}
              className={`flex-1 py-2 rounded-lg text-sm font-medium border transition-colors capitalize ${
                units === u ? "border-accent text-accent" : "border-border text-muted"
              }`}
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
              onClick={() => setAccent(c.value)}
              style={{ background: c.hex }}
              className={`w-10 h-10 rounded-full border-2 transition-all ${
                accent === c.value ? "border-white scale-110" : "border-transparent"
              }`}
              title={c.label}
            />
          ))}
        </div>
      </Section>

      <Section title="Weight Increments">
        <div className="card p-4 flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <label className="text-sm">Upper body (kg)</label>
            <input
              type="number"
              step="0.5"
              min="0.5"
              value={incUpper}
              onChange={(e) => setIncUpper(parseFloat(e.target.value))}
              className="w-20 bg-background border border-border rounded px-2 py-1.5 text-sm text-center focus:outline-none focus:border-accent"
            />
          </div>
          <div className="flex items-center justify-between">
            <label className="text-sm">Lower body (kg)</label>
            <input
              type="number"
              step="0.5"
              min="0.5"
              value={incLower}
              onChange={(e) => setIncLower(parseFloat(e.target.value))}
              className="w-20 bg-background border border-border rounded px-2 py-1.5 text-sm text-center focus:outline-none focus:border-accent"
            />
          </div>
        </div>
      </Section>

      <Section title="Weekly Schedule">
        <div className="card divide-y divide-border">
          {DAY_NAMES.map((day, i) => {
            const row = schedule.find((s) => s.day_of_week === i);
            return (
              <div key={i} className="flex items-center justify-between px-4 py-3">
                <span className="text-sm">{day}</span>
                <select
                  defaultValue={row?.day_type_id ?? ""}
                  onChange={(e) => handleScheduleChange(row, i, e.target.value)}
                  className="bg-surface border border-border rounded-lg px-2 py-1 text-sm text-muted focus:outline-none focus:border-accent"
                >
                  <option value="">—</option>
                  {dayTypes.map((dt) => (
                    <option key={dt.id} value={dt.id}>{dt.name}</option>
                  ))}
                </select>
              </div>
            );
          })}
        </div>
      </Section>

      <Section title="Strength Ratios">
        <div className="card p-4 flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <label className="text-sm">OHP / Bench target</label>
            <div className="flex items-center gap-1">
              <input
                type="number"
                step="0.01"
                min="0"
                max="1"
                value={ohpBench}
                onChange={(e) => setOhpBench(parseFloat(e.target.value))}
                className="w-20 bg-background border border-border rounded px-2 py-1.5 text-sm text-center focus:outline-none"
              />
              <span className="text-muted text-xs">%</span>
            </div>
          </div>
          <div className="flex items-center justify-between">
            <label className="text-sm">Deadlift / Squat target</label>
            <div className="flex items-center gap-1">
              <input
                type="number"
                step="0.01"
                min="0"
                value={dlSquat}
                onChange={(e) => setDlSquat(parseFloat(e.target.value))}
                className="w-20 bg-background border border-border rounded px-2 py-1.5 text-sm text-center focus:outline-none"
              />
              <span className="text-muted text-xs">×</span>
            </div>
          </div>
        </div>
      </Section>

      <Section title="Volume Ceiling">
        <div className="card p-4 flex items-center justify-between">
          <label className="text-sm">Max sets per muscle per session</label>
          <input
            type="number"
            min="5"
            max="30"
            value={volCeiling}
            onChange={(e) => setVolCeiling(parseInt(e.target.value))}
            className="w-16 bg-background border border-border rounded px-2 py-1.5 text-sm text-center focus:outline-none"
          />
        </div>
      </Section>

      <button
        onClick={handleSave}
        disabled={saving}
        className="w-full bg-accent py-3 rounded-lg text-sm font-medium text-white hover:opacity-90 disabled:opacity-50 transition-opacity"
      >
        {saving ? "Saving…" : "Save Settings"}
      </button>

      <Section title="Data">
        <button
          onClick={exportData}
          className="w-full border border-border py-3 rounded-lg text-sm text-muted hover:text-white transition-colors"
        >
          Export all data as JSON
        </button>
      </Section>
    </div>
  );
}
