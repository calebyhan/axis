"use client";

import { useState } from "react";
import { z } from "zod";
import { createClient } from "@/lib/supabase/client";
import { distanceUnit } from "@/lib/units";
import type { Units } from "@/types";

const schema = z.object({
  distance: z.number().positive("Distance must be positive"),
  hours: z.number().min(0),
  minutes: z.number().min(0).max(59),
  effort: z.number().min(1).max(5),
  notes: z.string().optional(),
});

interface FormFields {
  distance: string;
  hours: string;
  minutes: string;
  effort: number;
  notes: string;
}

export function LogRunForm({ onSave, units = "metric" }: { onSave: () => void; units?: Units }) {
  const [form, setForm] = useState<FormFields>({ distance: "", hours: "0", minutes: "30", effort: 3, notes: "" });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  function setField<K extends keyof FormFields>(key: K, value: FormFields[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    const parsed = schema.safeParse({
      distance: parseFloat(form.distance),
      hours: parseInt(form.hours) || 0,
      minutes: parseInt(form.minutes) || 0,
      effort: form.effort,
      notes: form.notes,
    });

    if (!parsed.success) {
      setError(parsed.error.errors[0].message);
      return;
    }

    setSaving(true);
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setError("Not authenticated. Please reload and try again.");
      setSaving(false);
      return;
    }

    const durationSecs = parsed.data.hours * 3600 + parsed.data.minutes * 60;
    const distanceM = units === "imperial" ? parsed.data.distance * 1609.344 : parsed.data.distance * 1000;

    const { error: dbError } = await supabase.from("activities").insert({
      user_id: user.id,
      type: "manual_run",
      source: "manual",
      start_time: new Date().toISOString(),
      duration: durationSecs,
      distance: distanceM,
      suffer_score: (parsed.data.effort - 1) * 50,
      notes: parsed.data.notes ?? null,
    });

    setSaving(false);
    if (dbError) setError(dbError.message);
    else onSave();
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div>
        <label htmlFor="log-run-distance" className="block text-xs text-muted mb-1.5">Distance ({distanceUnit(units)})</label>
        <input
          id="log-run-distance"
          type="number"
          step="0.01"
          value={form.distance}
          onChange={(e) => setField("distance", e.target.value)}
          placeholder="5.0"
          className="w-full bg-background border border-border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-[var(--accent)]"
          required
        />
      </div>

      <div>
        <div className="block text-xs text-muted mb-1.5">Duration</div>
        <div className="flex gap-2">
          <input
            type="number"
            min="0"
            id="log-run-hours"
            value={form.hours}
            onChange={(e) => setField("hours", e.target.value)}
            placeholder="0"
            className="flex-1 bg-background border border-border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-[var(--accent)] text-center"
          />
          <span className="text-muted self-center">h</span>
          <input
            type="number"
            min="0"
            max="59"
            id="log-run-minutes"
            value={form.minutes}
            onChange={(e) => setField("minutes", e.target.value)}
            placeholder="30"
            className="flex-1 bg-background border border-border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-[var(--accent)] text-center"
          />
          <span className="text-muted self-center">m</span>
        </div>
      </div>

      <div>
        <div className="block text-xs text-muted mb-1.5">Perceived Effort</div>
        <div className="flex gap-2">
          {[1, 2, 3, 4, 5].map((v) => (
            <button
              key={v}
              type="button"
              onClick={() => setField("effort", v)}
              className={`flex-1 py-2 rounded-lg text-sm font-medium border transition-colors ${
                form.effort === v ? "border-accent text-accent" : "border-border text-muted hover:text-white"
              }`}
            >
              {v}
            </button>
          ))}
        </div>
      </div>

      <div>
        <label htmlFor="log-run-notes" className="block text-xs text-muted mb-1.5">Notes (optional)</label>
        <textarea
          id="log-run-notes"
          value={form.notes}
          onChange={(e) => setField("notes", e.target.value)}
          rows={2}
          className="w-full bg-background border border-border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-[var(--accent)] resize-none"
          placeholder="Felt good, new route..."
        />
      </div>

      {error && <p className="text-red-400 text-xs">{error}</p>}

      <button
        type="submit"
        disabled={saving}
        className="w-full bg-accent py-3 rounded-lg text-sm font-medium text-white hover:opacity-90 disabled:opacity-50 transition-opacity"
      >
        {saving ? "Saving..." : "Save Run"}
      </button>
    </form>
  );
}
