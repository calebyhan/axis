"use client";

import { useState } from "react";
import { z } from "zod";
import { createClient } from "@/lib/supabase/client";

const schema = z.object({
  distance: z.number().positive("Distance must be positive"),
  hours: z.number().min(0),
  minutes: z.number().min(0).max(59),
  effort: z.number().min(1).max(5),
  notes: z.string().optional(),
});

export function LogRunForm({ onSave }: { onSave: () => void }) {
  const [distance, setDistance] = useState("");
  const [hours, setHours] = useState("0");
  const [minutes, setMinutes] = useState("30");
  const [effort, setEffort] = useState(3);
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    const parsed = schema.safeParse({
      distance: parseFloat(distance),
      hours: parseInt(hours) || 0,
      minutes: parseInt(minutes) || 0,
      effort,
      notes,
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

    const durationSecs =
      parsed.data.hours * 3600 + parsed.data.minutes * 60;
    const distanceM = parsed.data.distance * 1000;

    const { error: dbError } = await supabase.from("activities").insert({
      user_id: user.id,
      type: "manual_run",
      source: "manual",
      start_time: new Date().toISOString(),
      duration: durationSecs,
      distance: distanceM,
      suffer_score: (effort - 1) * 50,
      notes: parsed.data.notes ?? null,
    });

    setSaving(false);
    if (dbError) {
      setError(dbError.message);
    } else {
      onSave();
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div>
        <label className="block text-xs text-muted mb-1.5">Distance (km)</label>
        <input
          type="number"
          step="0.01"
          value={distance}
          onChange={(e) => setDistance(e.target.value)}
          placeholder="5.0"
          className="w-full bg-background border border-border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-[var(--accent)]"
          required
        />
      </div>

      <div>
        <label className="block text-xs text-muted mb-1.5">Duration</label>
        <div className="flex gap-2">
          <input
            type="number"
            min="0"
            value={hours}
            onChange={(e) => setHours(e.target.value)}
            placeholder="0"
            className="flex-1 bg-background border border-border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-[var(--accent)] text-center"
          />
          <span className="text-muted self-center">h</span>
          <input
            type="number"
            min="0"
            max="59"
            value={minutes}
            onChange={(e) => setMinutes(e.target.value)}
            placeholder="30"
            className="flex-1 bg-background border border-border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-[var(--accent)] text-center"
          />
          <span className="text-muted self-center">m</span>
        </div>
      </div>

      <div>
        <label className="block text-xs text-muted mb-1.5">Perceived Effort</label>
        <div className="flex gap-2">
          {[1, 2, 3, 4, 5].map((v) => (
            <button
              key={v}
              type="button"
              onClick={() => setEffort(v)}
              className={`flex-1 py-2 rounded-lg text-sm font-medium border transition-colors ${
                effort === v
                  ? "border-accent text-accent"
                  : "border-border text-muted hover:text-white"
              }`}
            >
              {v}
            </button>
          ))}
        </div>
      </div>

      <div>
        <label className="block text-xs text-muted mb-1.5">Notes (optional)</label>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={2}
          className="w-full bg-background border border-border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-[var(--accent)] resize-none"
          placeholder="Felt good, new route…"
        />
      </div>

      {error && <p className="text-red-400 text-xs">{error}</p>}

      <button
        type="submit"
        disabled={saving}
        className="w-full bg-accent py-3 rounded-lg text-sm font-medium text-white hover:opacity-90 disabled:opacity-50 transition-opacity"
      >
        {saving ? "Saving…" : "Save Run"}
      </button>
    </form>
  );
}
