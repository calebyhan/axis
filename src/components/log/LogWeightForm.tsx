"use client";

import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { deleteBodyWeight, saveBodyWeight } from "@/app/(tabs)/log/actions";
import { displayWeightToKg, kgToDisplayWeight, weightUnit } from "@/lib/units";
import { localDateStr } from "@/lib/planner";
import type { Units } from "@/types";

interface FormData {
  value: string;
  units: Units;
  loaded: boolean;
  hasExisting: boolean;
  date: string | null;
}

type WeightMutation = "saved" | "deleted";

interface Props {
  onSave: (mutation: WeightMutation) => void;
  units?: Units;
  initialDate?: string;
}

function displayValue(kg: number, units: Units): string {
  return kgToDisplayWeight(kg, units).toFixed(1);
}

function parseLocalDate(date: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  if (!match) return null;
  const [, y, m, d] = match;
  const parsed = new Date(Number(y), Number(m) - 1, Number(d));
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function formatDateLabel(date: string): string {
  const parsed = parseLocalDate(date);
  if (!parsed) return "Select a date";
  return parsed.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });
}

export function LogWeightForm({ onSave, units: propUnits, initialDate }: Props) {
  const today = localDateStr(new Date());
  const [selectedDate, setSelectedDate] = useState(initialDate ?? today);
  const [formData, setFormData] = useState<FormData>({
    value: "70.0",
    units: propUnits ?? "imperial",
    loaded: false,
    hasExisting: false,
    date: null,
  });
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState("");
  const [editing, setEditing] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let canceled = false;
    const supabase = createClient();

    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) {
        if (!canceled) {
          setError("Not authenticated");
          setFormData((prev) => ({ ...prev, loaded: true, hasExisting: false, date: selectedDate }));
        }
        return;
      }

      const [profileRes, selectedRes, latestRes] = await Promise.all([
        propUnits ? null : supabase.from("profiles").select("units").eq("id", user.id).single(),
        supabase
          .from("daily_checkins")
          .select("body_weight")
          .eq("user_id", user.id)
          .eq("date", selectedDate)
          .maybeSingle(),
        supabase
          .from("daily_checkins")
          .select("body_weight")
          .eq("user_id", user.id)
          .not("body_weight", "is", null)
          .order("date", { ascending: false })
          .limit(1)
          .maybeSingle(),
      ]);

      if (canceled) return;

      const resolvedUnits = propUnits ?? ((profileRes?.data?.units ?? "imperial") as Units);
      const selectedKg = selectedRes.data?.body_weight;
      const seedKg = selectedKg ?? latestRes.data?.body_weight;
      setFormData({
        units: resolvedUnits,
        value: seedKg ? displayValue(seedKg, resolvedUnits) : "70.0",
        loaded: true,
        hasExisting: selectedKg != null,
        date: selectedDate,
      });
    });

    return () => {
      canceled = true;
    };
  }, [propUnits, selectedDate]);

  const step = formData.units === "imperial" ? 0.5 : 0.1;
  const busy = saving || deleting;
  const formLoaded = formData.loaded && formData.date === selectedDate;

  function handleDateChange(date: string) {
    setSelectedDate(date);
    setError("");
    setConfirmingDelete(false);
    setEditing(false);
  }

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
    if (!formLoaded) return;
    if (!selectedDate) {
      setError("Select a date");
      return;
    }
    const raw = parseFloat(formData.value);
    if (isNaN(raw) || raw <= 0) {
      setError("Enter a valid weight");
      return;
    }

    setSaving(true);
    setError("");
    const kg = displayWeightToKg(raw, formData.units);

    const result = await saveBodyWeight({ date: selectedDate, body_weight: kg });

    setSaving(false);
    if (result.error) setError(result.error);
    else onSave("saved");
  }

  async function handleDelete() {
    if (!formLoaded || !formData.hasExisting || !selectedDate) return;

    setDeleting(true);
    setError("");
    const result = await deleteBodyWeight(selectedDate);
    setDeleting(false);

    if (result.error) setError(result.error);
    else onSave("deleted");
  }

  return (
    <div className="flex flex-col gap-7 py-4">
      <label className="flex flex-col gap-2">
        <span className="text-xs text-muted">Date</span>
        <input
          type="date"
          value={selectedDate}
          max={today}
          onChange={(event) => handleDateChange(event.target.value)}
          disabled={busy}
          className="w-full rounded-xl border border-border bg-surface px-3 py-2 text-sm text-white focus:border-[var(--accent)] focus:outline-none disabled:opacity-50"
        />
      </label>

      <div className="flex flex-col items-center gap-8">
        <p className="text-sm text-white/40">{formatDateLabel(selectedDate)}</p>

        <div className="flex items-center gap-6">
          <button type="button" aria-label="Decrease body weight" onClick={() => nudge(-1)} disabled={!formLoaded || busy} className="size-12 flex items-center justify-center rounded-full border border-white/10 text-white/55 hover:text-white hover:border-white/20 active:scale-95 transition-all disabled:opacity-50">
            <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="size-5"><path d="M5 12h14" /></svg>
          </button>

          <div className="flex flex-col items-center">
            {editing ? (
              <input
                aria-label={`Body weight in ${weightUnit(formData.units)}`}
                ref={inputRef}
                type="number"
                step={step}
                value={formData.value}
                disabled={busy}
                onChange={(e) => setFormData((prev) => ({ ...prev, value: e.target.value }))}
                onBlur={() => {
                  setEditing(false);
                  const n = parseFloat(formData.value);
                  if (!isNaN(n) && n > 0) setFormData((prev) => ({ ...prev, value: n.toFixed(1) }));
                }}
                className="w-36 text-center text-5xl font-light tracking-tight bg-transparent border-b border-accent text-white focus:outline-none pb-1 disabled:opacity-50"
              />
            ) : (
              <button type="button" aria-label="Edit body weight" onClick={handleTapNumber} disabled={!formLoaded || busy} className="text-5xl font-light tracking-tight text-white leading-none disabled:opacity-50">
                {formLoaded ? formData.value : "…"}
              </button>
            )}
            <span className="text-base text-white/40 mt-2">{weightUnit(formData.units)}</span>
          </div>

          <button type="button" aria-label="Increase body weight" onClick={() => nudge(1)} disabled={!formLoaded || busy} className="size-12 flex items-center justify-center rounded-full border border-white/10 text-white/55 hover:text-white hover:border-white/20 active:scale-95 transition-all disabled:opacity-50">
            <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="size-5"><path d="M12 5v14M5 12h14" /></svg>
          </button>
        </div>
      </div>

      {error && <p className="text-red-400 text-xs">{error}</p>}

      <div className="flex flex-col gap-3">
        <button
          type="button"
          onClick={handleSubmit}
          disabled={!formLoaded || busy}
          className="w-full glass-button glass-button-primary py-3 rounded-2xl text-sm font-medium disabled:opacity-50"
        >
          {saving ? "Saving..." : formLoaded && formData.hasExisting ? "Save Changes" : "Log Weight"}
        </button>

        {formLoaded && formData.hasExisting && (
          confirmingDelete ? (
            <div className="flex items-center justify-between gap-3 rounded-xl border border-red-400/20 bg-red-500/10 px-3 py-2">
              <span className="text-xs text-red-200">Delete this weigh-in?</span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setConfirmingDelete(false)}
                  disabled={deleting}
                  className="text-xs text-white/55 hover:text-white disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleDelete}
                  disabled={deleting}
                  className="rounded-full bg-red-500/20 px-3 py-1.5 text-xs font-medium text-red-200 disabled:opacity-50"
                >
                  {deleting ? "Deleting..." : "Delete"}
                </button>
              </div>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setConfirmingDelete(true)}
              disabled={busy}
              className="w-full rounded-2xl border border-red-400/20 py-3 text-sm font-medium text-red-300 transition-colors hover:border-red-300/40 hover:text-red-200 disabled:opacity-50"
            >
              Delete Weigh-in
            </button>
          )
        )}
      </div>
    </div>
  );
}
