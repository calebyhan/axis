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
    <Link href={`/activity/${activity.id}`} className="card surface-hover p-4 sm:p-5 flex flex-col gap-4 block">
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-white/45 uppercase tracking-[0.18em]">
              {activity.type === "manual_run" ? "Manual Run" : "Run"}
            </span>
            {activity.suffer_score && (
              <span className="text-xs px-2 py-1 bg-red-900/20 border border-red-400/15 text-red-300 rounded-full">
                Suffer {activity.suffer_score}
              </span>
            )}
          </div>
          <div className="text-sm text-white/58 mt-1">
            {new Date(activity.start_time).toLocaleDateString("en-US", {
              weekday: "short",
              month: "short",
              day: "numeric",
            })}
          </div>
        </div>
        {distanceKm && (
          <div className="text-right">
            <div className="text-2xl font-semibold tracking-[-0.05em]">{distanceKm}</div>
            <div className="text-xs text-white/40 uppercase tracking-[0.16em]">km</div>
          </div>
        )}
      </div>

      <div className="grid grid-cols-3 gap-2 text-sm">
        <div className="card-soft p-3">
          <div className="text-white/38 text-[11px] uppercase tracking-[0.16em]">Time</div>
          <div className="font-medium">{formatDuration(activity.duration)}</div>
        </div>
        <div className="card-soft p-3">
          <div className="text-white/38 text-[11px] uppercase tracking-[0.16em]">Pace</div>
          <div className="font-medium">{formatPace(activity.avg_pace)}</div>
        </div>
        <div className="card-soft p-3">
          <div className="text-white/38 text-[11px] uppercase tracking-[0.16em]">Avg HR</div>
          <div className="font-medium">
            {activity.avg_heartrate ? `${Math.round(activity.avg_heartrate)} bpm` : "—"}
          </div>
        </div>
      </div>
    </Link>
  );
}
