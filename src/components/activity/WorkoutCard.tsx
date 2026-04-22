import Link from "next/link";
import { MiniHeatmap } from "@/components/heatmap/MiniHeatmap";
import type { Activity, MuscleGroup } from "@/types";

function formatDuration(secs: number | null): string {
  if (!secs) return "—";
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

interface Props {
  activity: Activity;
  coverage?: Partial<Record<MuscleGroup, number>>;
  exerciseCount?: number;
  totalVolume?: number;
}

export function WorkoutCard({ activity, coverage = {}, exerciseCount, totalVolume }: Props) {
  return (
    <Link href={`/activity/${activity.id}`} className="card p-4 flex gap-4 hover:border-[#2A2A2A] transition-colors block">
      <div className="shrink-0">
        <MiniHeatmap coverage={coverage} />
      </div>

      <div className="flex flex-col justify-between flex-1 min-w-0">
        <div>
          <div className="text-xs text-muted uppercase tracking-wide">Workout</div>
          <div className="text-sm text-muted mt-0.5">
            {new Date(activity.start_time).toLocaleDateString("en-US", {
              weekday: "short",
              month: "short",
              day: "numeric",
            })}
          </div>
        </div>

        <div className="grid grid-cols-3 gap-2 text-sm">
          <div>
            <div className="text-muted text-xs">Time</div>
            <div className="font-medium">{formatDuration(activity.duration)}</div>
          </div>
          {exerciseCount !== undefined && (
            <div>
              <div className="text-muted text-xs">Exercises</div>
              <div className="font-medium">{exerciseCount}</div>
            </div>
          )}
          {totalVolume !== undefined && (
            <div>
              <div className="text-muted text-xs">Volume</div>
              <div className="font-medium">
                {totalVolume >= 1000
                  ? `${(totalVolume / 1000).toFixed(1)}k`
                  : Math.round(totalVolume)}{" "}
                kg
              </div>
            </div>
          )}
        </div>
      </div>
    </Link>
  );
}
