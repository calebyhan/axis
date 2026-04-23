import Link from "next/link";
import { MiniHeatmap } from "@/components/heatmap/MiniHeatmap";
import type { Activity, MuscleGroup, Units } from "@/types";
import { formatWeight, weightUnit } from "@/lib/units";

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
  units: Units;
}

export function WorkoutCard({ activity, coverage = {}, exerciseCount, totalVolume, units }: Props) {
  return (
    <Link href={`/activity/${activity.id}`} className="card surface-hover p-4 sm:p-5 flex gap-4 block">
      <div className="shrink-0">
        <MiniHeatmap coverage={coverage} />
      </div>

      <div className="flex flex-col justify-between flex-1 min-w-0">
        <div>
          <div className="text-xs text-white/45 uppercase tracking-[0.18em]">Workout</div>
          <div className="text-sm text-white/58 mt-1">
            {new Date(activity.start_time).toLocaleDateString("en-US", {
              weekday: "short",
              month: "short",
              day: "numeric",
            })}
          </div>
        </div>

        <div className="grid grid-cols-3 gap-2 text-sm">
          <div className="card-soft p-3">
            <div className="text-white/38 text-[11px] uppercase tracking-[0.16em]">Time</div>
            <div className="font-medium">{formatDuration(activity.duration)}</div>
          </div>
          {exerciseCount !== undefined && (
            <div className="card-soft p-3">
              <div className="text-white/38 text-[11px] uppercase tracking-[0.16em]">Exercises</div>
              <div className="font-medium">{exerciseCount}</div>
            </div>
          )}
          {totalVolume !== undefined && (
            <div className="card-soft p-3">
              <div className="text-white/38 text-[11px] uppercase tracking-[0.16em]">Volume</div>
              <div className="font-medium">
                {formatWeight(totalVolume, units)}{" "}
                {weightUnit(units)}
              </div>
            </div>
          )}
        </div>
      </div>
    </Link>
  );
}
