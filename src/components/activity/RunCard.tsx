import Link from "next/link";
import type { Activity } from "@/types";

function formatPace(secondsPerKm: number | null): string {
  if (!secondsPerKm) return "—";
  const m = Math.floor(secondsPerKm / 60);
  const s = Math.round(secondsPerKm % 60);
  return `${m}:${String(s).padStart(2, "0")}/km`;
}

function formatDuration(secs: number | null): string {
  if (!secs) return "—";
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

interface Props {
  activity: Activity;
}

export function RunCard({ activity }: Props) {
  const distanceKm = activity.distance ? (activity.distance / 1000).toFixed(2) : null;

  return (
    <Link href={`/activity/${activity.id}`} className="card p-4 flex flex-col gap-3 hover:border-[#2A2A2A] transition-colors block">
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted uppercase tracking-wide">
              {activity.type === "manual_run" ? "Manual Run" : "Run"}
            </span>
            {activity.suffer_score && (
              <span className="text-xs px-1.5 py-0.5 bg-red-900/30 text-red-400 rounded">
                Suffer {activity.suffer_score}
              </span>
            )}
          </div>
          <div className="text-sm text-muted mt-0.5">
            {new Date(activity.start_time).toLocaleDateString("en-US", {
              weekday: "short",
              month: "short",
              day: "numeric",
            })}
          </div>
        </div>
        {distanceKm && (
          <div className="text-right">
            <div className="text-xl font-semibold">{distanceKm}</div>
            <div className="text-xs text-muted">km</div>
          </div>
        )}
      </div>

      <div className="grid grid-cols-3 gap-2 text-sm">
        <div>
          <div className="text-muted text-xs">Time</div>
          <div className="font-medium">{formatDuration(activity.duration)}</div>
        </div>
        <div>
          <div className="text-muted text-xs">Pace</div>
          <div className="font-medium">{formatPace(activity.avg_pace)}</div>
        </div>
        <div>
          <div className="text-muted text-xs">Avg HR</div>
          <div className="font-medium">
            {activity.avg_heartrate ? `${Math.round(activity.avg_heartrate)} bpm` : "—"}
          </div>
        </div>
      </div>
    </Link>
  );
}
