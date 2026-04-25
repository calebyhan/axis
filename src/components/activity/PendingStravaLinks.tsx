"use client";

import { useState } from "react";

interface Candidate {
  id: string;
  start_time: string;
  duration: number | null;
  name: string | null;
}

interface PendingLink {
  id: string;
  strava_data: {
    name: string | null;
    start_time: string;
    duration: number | null;
    avg_heartrate: number | null;
    max_heartrate: number | null;
    calories: number | null;
    suffer_score: number | null;
  };
  candidates: Candidate[];
}

interface Props {
  links: PendingLink[];
}

function formatDuration(secs: number | null): string {
  if (!secs) return "—";
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleString("en-US", {
    weekday: "short", month: "short", day: "numeric",
    hour: "numeric", minute: "2-digit",
  });
}

export function PendingStravaLinks({ links: initialLinks }: Props) {
  const [links, setLinks] = useState(initialLinks);
  const [resolving, setResolving] = useState<string | null>(null);

  if (links.length === 0) return null;

  async function resolve(pendingLinkId: string, activityId: string) {
    setResolving(pendingLinkId);
    try {
      await fetch("/api/strava/link-workout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pendingLinkId, activityId }),
      });
      setLinks((prev) => prev.filter((l) => l.id !== pendingLinkId));
    } finally {
      setResolving(null);
    }
  }

  async function dismiss(pendingLinkId: string) {
    setResolving(pendingLinkId);
    try {
      await fetch("/api/strava/link-workout/dismiss", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pendingLinkId }),
      });
      setLinks((prev) => prev.filter((l) => l.id !== pendingLinkId));
    } finally {
      setResolving(null);
    }
  }

  return (
    <div className="flex flex-col gap-3">
      {links.map((link) => (
        <div key={link.id} className="card p-4 border-amber-400/20 flex flex-col gap-3">
          <div className="flex items-start justify-between gap-2">
            <div>
              <div className="text-xs text-amber-400 uppercase tracking-[0.16em] mb-1">Watch Workout — Link?</div>
              <div className="text-sm font-medium">{link.strava_data.name ?? "Workout"}</div>
              <div className="text-xs text-white/45 mt-0.5">{formatTime(link.strava_data.start_time)}</div>
            </div>
            <div className="text-right shrink-0 text-sm text-white/60">
              {formatDuration(link.strava_data.duration)}
              {link.strava_data.avg_heartrate != null && (
                <div className="text-xs text-white/40">{Math.round(link.strava_data.avg_heartrate)} bpm avg</div>
              )}
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <div className="text-[10px] text-white/35 uppercase tracking-[0.16em]">Choose a session to link</div>
            {link.candidates.map((c) => (
              <button
                key={c.id}
                disabled={resolving === link.id}
                onClick={() => resolve(link.id, c.id)}
                className="flex items-center justify-between w-full card-soft px-3 py-2.5 text-sm hover:bg-white/5 transition-colors disabled:opacity-40 text-left"
              >
                <span>{c.name ?? "Workout"}</span>
                <span className="text-white/45 text-xs">{formatTime(c.start_time)} · {formatDuration(c.duration)}</span>
              </button>
            ))}
          </div>

          <button
            disabled={resolving === link.id}
            onClick={() => dismiss(link.id)}
            className="text-xs text-white/30 hover:text-white/50 transition-colors self-end disabled:opacity-40"
          >
            Dismiss
          </button>
        </div>
      ))}
    </div>
  );
}
