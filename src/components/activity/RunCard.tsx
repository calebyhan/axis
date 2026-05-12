import Link from "next/link";
import type { Activity, BestEffort, Units } from "@/types";
import { formatDistance, formatPace, distanceUnit } from "@/lib/units";
import { PolylinePreview } from "./PolylinePreview";

function formatDuration(secs: number | null): string {
  if (!secs) return "—";
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

function medalCount(efforts: BestEffort[] | null): number {
  return efforts?.filter((effort) => effort.pr_rank != null && effort.pr_rank >= 1 && effort.pr_rank <= 3).length ?? 0;
}

interface Props {
  activity: Activity;
  units: Units;
}

export function RunCard({ activity, units }: Props) {
  const distanceKm = activity.distance ? activity.distance / 1000 : null;
  const distanceDisplay = distanceKm !== null ? formatDistance(distanceKm, units) : null;
  const medals = medalCount(activity.best_efforts);

  return (
    <Link href={`/activity/${activity.id}`} className="card surface-hover flex flex-col block overflow-hidden">
      {activity.summary_polyline && (
        <div className="w-full h-28 bg-white/[0.02] border-b border-border pointer-events-none">
          <PolylinePreview polyline={activity.summary_polyline} />
        </div>
      )}

      <div className="p-4 sm:p-5 flex flex-col gap-3">
        <div className="flex items-start gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 min-w-0">
              <span className="truncate text-[10px] text-white/40 uppercase tracking-[0.18em]">
                {activity.type === "manual_run" ? "Manual Run" : activity.name ?? "Run"}
              </span>
              {activity.suffer_score != null && (
                <span className="shrink-0 text-[10px] text-red-300 uppercase tracking-[0.14em] px-1.5 py-0.5 rounded bg-red-400/8 border border-red-400/12">
                  Suffer {activity.suffer_score}
                </span>
              )}
            </div>
            <div className="text-sm font-medium mt-0.5" suppressHydrationWarning>
              {new Date(activity.start_time).toLocaleDateString("en-US", {
                weekday: "short",
                month: "short",
                day: "numeric",
              })}
            </div>
          </div>
          {medals > 0 && (
            <div className="flex shrink-0 items-center gap-1.5 rounded-md border border-amber-300/20 bg-amber-300/[0.06] px-2 py-1 text-xs text-amber-200">
              <span className="flex items-center gap-0.5" aria-hidden="true">
                <span className="size-1.5 rounded-full bg-amber-300" />
                <span className="size-1.5 rounded-full bg-zinc-300" />
                <span className="size-1.5 rounded-full bg-orange-400" />
              </span>
              <span className="font-medium">{medals}</span>
              <span className="hidden text-amber-200/70 min-[430px]:inline">{medals === 1 ? "medal" : "medals"}</span>
            </div>
          )}
          {distanceDisplay && (
            <div className="text-right shrink-0">
              <div className="text-xl font-semibold tracking-tight sm:text-2xl">{distanceDisplay}</div>
              <div className="text-[10px] text-white/40 uppercase tracking-[0.16em]">{distanceUnit(units)}</div>
            </div>
          )}
        </div>

        <div className="flex flex-wrap gap-x-5 gap-y-3 text-sm">
          <div>
            <div className="text-[10px] text-white/38 uppercase tracking-[0.14em]">Time</div>
            <div className="font-medium mt-0.5">{formatDuration(activity.duration)}</div>
          </div>
          <div>
            <div className="text-[10px] text-white/38 uppercase tracking-[0.14em]">Pace</div>
            <div className="font-medium mt-0.5">{formatPace(activity.avg_pace, units)}</div>
          </div>
          <div>
            <div className="text-[10px] text-white/38 uppercase tracking-[0.14em]">Avg HR</div>
            <div className="font-medium mt-0.5">
              {activity.avg_heartrate ? `${Math.round(activity.avg_heartrate)} bpm` : "—"}
            </div>
          </div>
        </div>
      </div>
    </Link>
  );
}
