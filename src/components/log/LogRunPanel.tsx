"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { formatDistance, distanceUnit } from "@/lib/units";
import { LogRunForm } from "./LogRunForm";
import type { Units } from "@/types";

type StravaActivity = {
  id: number;
  name: string;
  sport_type: string;
  start_date: string;
  moving_time: number;
  distance: number;
};

function formatDuration(secs: number): string {
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

function formatRelativeDate(isoDate: string): string {
  const date = new Date(isoDate);
  const diffMs = Date.now() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  return date.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
}

const RECENT_MS = 48 * 60 * 60 * 1000;

function ActivityRow({
  activity,
  units,
  importing,
  imported,
  onImport,
}: {
  activity: StravaActivity;
  units: Units;
  importing: boolean;
  imported: boolean;
  onImport: (id: number) => void;
}) {
  const distKm = activity.distance / 1000;
  return (
    <div className="card p-3 flex items-center justify-between gap-3">
      <div className="min-w-0">
        <div className="text-sm font-medium truncate">{activity.name}</div>
        <div className="text-xs text-muted mt-0.5">
          {formatRelativeDate(activity.start_date)} ·{" "}
          {formatDistance(distKm, units)} {distanceUnit(units)} ·{" "}
          {formatDuration(activity.moving_time)}
        </div>
      </div>
      <button
        onClick={() => onImport(activity.id)}
        disabled={importing || imported}
        className={`shrink-0 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
          imported
            ? "bg-green-900/30 text-green-400 border border-green-400/20"
            : "bg-accent/10 text-[var(--accent)] border border-accent/20 hover:bg-accent/20 disabled:opacity-50"
        }`}
      >
        {importing ? "Importing…" : imported ? "Imported ✓" : "Import"}
      </button>
    </div>
  );
}

export function LogRunPanel({ onSave }: { onSave: () => void }) {
  const [activities, setActivities] = useState<StravaActivity[]>([]);
  const [connected, setConnected] = useState(true);
  const [loading, setLoading] = useState(true);
  const [importing, setImporting] = useState<number | null>(null);
  const [imported, setImported] = useState<Set<number>>(new Set());
  const [showHistory, setShowHistory] = useState(false);
  const [showManual, setShowManual] = useState(false);
  const [units, setUnits] = useState<Units>("imperial");
  const [now] = useState(() => Date.now());

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return;
      supabase
        .from("profiles")
        .select("units")
        .eq("id", user.id)
        .single()
        .then(({ data }) => {
          if (data?.units) setUnits(data.units as Units);
        });
    });

    fetch("/api/strava/sync")
      .then((r) => r.json())
      .then((data) => {
        setConnected(data.connected !== false);
        setActivities(data.activities ?? []);
      })
      .catch(() => setConnected(false))
      .finally(() => setLoading(false));
  }, []);

  async function importActivity(id: number) {
    setImporting(id);
    const res = await fetch("/api/strava/sync", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ activityId: id }),
    });
    setImporting(null);
    if (res.ok) {
      setImported((prev) => new Set([...prev, id]));
      setTimeout(() => onSave(), 600);
    }
  }

  const recentActivities = activities.filter(
    (a) => now - new Date(a.start_date).getTime() < RECENT_MS
  );
  const olderActivities = activities.filter(
    (a) => now - new Date(a.start_date).getTime() >= RECENT_MS
  );
  const hasStravaContent = connected && activities.length > 0;

  if (loading) {
    return <div className="py-8 text-center text-sm text-muted">Loading…</div>;
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Recent Strava activities (< 48h) */}
      {recentActivities.length > 0 && (
        <div>
          <div className="text-xs text-muted uppercase tracking-wider mb-2">
            Recent Strava Activity
          </div>
          <div className="flex flex-col gap-2">
            {recentActivities.map((a) => (
              <ActivityRow
                key={a.id}
                activity={a}
                units={units}
                importing={importing === a.id}
                imported={imported.has(a.id)}
                onImport={importActivity}
              />
            ))}
          </div>
        </div>
      )}

      {/* Older Strava history */}
      {olderActivities.length > 0 && (
        <div>
          <button
            onClick={() => setShowHistory((v) => !v)}
            className="w-full flex items-center justify-between text-sm text-muted py-1"
          >
            <span>
              Strava history ({olderActivities.length} unimported)
            </span>
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={1.5}
              className={`w-4 h-4 transition-transform ${showHistory ? "rotate-90" : ""}`}
            >
              <path d="M9 18l6-6-6-6" />
            </svg>
          </button>
          {showHistory && (
            <div className="flex flex-col gap-2 mt-2">
              {olderActivities.map((a) => (
                <ActivityRow
                  key={a.id}
                  activity={a}
                  units={units}
                  importing={importing === a.id}
                  imported={imported.has(a.id)}
                  onImport={importActivity}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Empty / disconnected states */}
      {connected && activities.length === 0 && (
        <p className="text-sm text-muted text-center py-1">
          No new Strava runs to import.
        </p>
      )}
      {!connected && (
        <p className="text-sm text-muted text-center py-1">
          Connect Strava in Settings to import runs automatically.
        </p>
      )}

      {/* Manual log section */}
      {hasStravaContent ? (
        <div>
          <button
            onClick={() => setShowManual((v) => !v)}
            className="w-full flex items-center gap-3 text-xs text-muted py-1"
          >
            <div className="flex-1 h-px bg-border" />
            <span>Log manually {showManual ? "▲" : "▼"}</span>
            <div className="flex-1 h-px bg-border" />
          </button>
          {showManual && (
            <div className="mt-4">
              <LogRunForm onSave={onSave} />
            </div>
          )}
        </div>
      ) : (
        <LogRunForm onSave={onSave} />
      )}
    </div>
  );
}
