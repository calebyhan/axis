"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

export function LogWeightForm({ onSave }: { onSave: () => void }) {
  const [weight, setWeight] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const val = parseFloat(weight);
    if (isNaN(val) || val <= 0) {
      setError("Enter a valid weight");
      return;
    }

    setSaving(true);
    setError("");
    const supabase = createClient();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setError("Not authenticated. Please reload and try again.");
      setSaving(false);
      return;
    }

    const now = new Date();
    const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;

    const { error: dbError } = await supabase.from("daily_checkins").upsert(
      { user_id: user.id, date: today, body_weight: val, notes: null },
      { onConflict: "user_id,date" }
    );

    setSaving(false);
    if (dbError) {
      setError(dbError.message);
    } else {
      setWeight("");
      onSave();
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div>
        <label className="block text-xs text-muted mb-1.5">Body Weight (kg)</label>
        <input
          type="number"
          step="0.1"
          value={weight}
          onChange={(e) => setWeight(e.target.value)}
          placeholder="75.0"
          className="w-full bg-background border border-border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-[var(--accent)]"
          required
        />
      </div>

      {error && <p className="text-red-400 text-xs">{error}</p>}

      <button
        type="submit"
        disabled={saving}
        className="w-full bg-accent py-3 rounded-lg text-sm font-medium text-white hover:opacity-90 disabled:opacity-50 transition-opacity"
      >
        {saving ? "Saving…" : "Log Weight"}
      </button>
    </form>
  );
}
