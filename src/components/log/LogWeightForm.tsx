"use client";

import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { weightUnit } from "@/lib/units";
import type { Units } from "@/types";

interface FormData {
  value: string;
  units: Units;
  loaded: boolean;
}

export function LogWeightForm({ onSave }: { onSave: () => void }) {
  const [formData, setFormData] = useState<FormData>({ value: "70.0", units: "metric", loaded: false });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [editing, setEditing] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) return;
      const [{ data: profile }, { data: lastCheckin }] = await Promise.all([
        supabase.from("profiles").select("units").eq("id", user.id).single(),
        supabase.from("daily_checkins").select("body_weight").eq("user_id", user.id).not("body_weight", "is", null).order("date", { ascending: false }).limit(1).single(),
      ]);
      const resolvedUnits = (profile?.units ?? "metric") as Units;
      const kg = lastCheckin?.body_weight;
      setFormData({
        units: resolvedUnits,
        value: kg ? (resolvedUnits === "imperial" ? (kg * 2.20462).toFixed(1) : kg.toFixed(1)) : "70.0",
        loaded: true,
      });
    });
  }, []);

  const step = formData.units === "imperial" ? 0.5 : 0.1;

  function nudge(dir: 1 | -1) {
    const current = parseFloat(formData.value) || 0;
    const next = Math.max(0, current + dir * step);
    setFormData((prev) => ({ ...prev, value: next.toFixed(1) }));
  }

  function handleTapNumber() {
    setEditing(true);
    setTimeout(() => inputRef.current?.select(), 0);
  }

  async function handleSubmit() {
    if (!formData.loaded) return;
    const raw = parseFloat(formData.value);
    if (isNaN(raw) || raw <= 0) {
      setError("Enter a valid weight");
      return;
    }

    setSaving(true);
    setError("");
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setError("Not authenticated");
      setSaving(false);
      return;
    }

    const kg = formData.units === "imperial" ? raw / 2.20462 : raw;
    const now = new Date();
    const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;

    const { error: dbError } = await supabase.from("daily_checkins").upsert(
      { user_id: user.id, date: today, body_weight: kg, notes: null },
      { onConflict: "user_id,date" }
    );

    setSaving(false);
    if (dbError) setError(dbError.message);
    else onSave();
  }

  const today = new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });

  return (
    <div className="flex flex-col items-center gap-8 py-4">
      <p className="text-sm text-white/40">{today}</p>

      <div className="flex items-center gap-6">
        <button type="button" onClick={() => nudge(-1)} className="w-12 h-12 flex items-center justify-center rounded-full border border-white/10 text-white/55 hover:text-white hover:border-white/20 active:scale-95 transition-all">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-5 h-5"><path d="M5 12h14" /></svg>
        </button>

        <div className="flex flex-col items-center">
          {editing ? (
            <input
              ref={inputRef}
              type="number"
              step={step}
              value={formData.value}
              onChange={(e) => setFormData((prev) => ({ ...prev, value: e.target.value }))}
              onBlur={() => {
                setEditing(false);
                const n = parseFloat(formData.value);
                if (!isNaN(n) && n > 0) setFormData((prev) => ({ ...prev, value: n.toFixed(1) }));
              }}
              className="w-36 text-center text-5xl font-light tracking-tight bg-transparent border-b border-accent text-white focus:outline-none pb-1"
            />
          ) : (
            <button type="button" onClick={handleTapNumber} className="text-5xl font-light tracking-tight text-white leading-none">
              {formData.value}
            </button>
          )}
          <span className="text-base text-white/40 mt-2">{weightUnit(formData.units)}</span>
        </div>

        <button type="button" onClick={() => nudge(1)} className="w-12 h-12 flex items-center justify-center rounded-full border border-white/10 text-white/55 hover:text-white hover:border-white/20 active:scale-95 transition-all">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-5 h-5"><path d="M12 5v14M5 12h14" /></svg>
        </button>
      </div>

      {error && <p className="text-red-400 text-xs">{error}</p>}

      <button
        type="button"
        onClick={handleSubmit}
        disabled={!formData.loaded || saving}
        className="w-full glass-button glass-button-primary py-3 rounded-2xl text-sm font-medium disabled:opacity-50"
      >
        {saving ? "Saving..." : "Log Weight"}
      </button>
    </div>
  );
}
