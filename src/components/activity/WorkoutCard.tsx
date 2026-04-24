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
  dayTypeName?: string;
  units: Units;
}

export function WorkoutCard({ activity, coverage = {}, exerciseCount, totalVolume, dayTypeName, units }: Props) {
  return (
    <Link href={`/activity/${activity.id}`} className="card surface-hover p-4 sm:p-5 flex gap-4 items-center block">
      <div className="shrink-0">
        <MiniHeatmap coverage={coverage} />
      </div>

      <div className="flex flex-col gap-3 flex-1 min-w-0">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-white/40 uppercase tracking-[0.18em]">Workout</span>
            {dayTypeName && (
              <span className="text-[10px] text-white/55 uppercase tracking-[0.14em] px-1.5 py-0.5 rounded bg-white/6 border border-white/8">
                {dayTypeName}
              </span>
            )}
          </div>
          <div className="text-sm font-medium mt-0.5">
            {new Date(activity.start_time).toLocaleDateString("en-US", {
              weekday: "short",
              month: "short",
              day: "numeric",
            })}
          </div>
        </div>

        <div className="flex gap-5 text-sm">
          <div>
            <div className="text-[10px] text-white/38 uppercase tracking-[0.14em]">Time</div>
            <div className="font-medium mt-0.5">{formatDuration(activity.duration)}</div>
          </div>
          <div>
            <div className="text-[10px] text-white/38 uppercase tracking-[0.14em]">Exercises</div>
            <div className="font-medium mt-0.5">{exerciseCount ?? "—"}</div>
          </div>
          <div>
            <div className="text-[10px] text-white/38 uppercase tracking-[0.14em]">Volume</div>
            <div className="font-medium mt-0.5">
              {totalVolume ? `${formatWeight(totalVolume, units)} ${weightUnit(units)}` : "—"}
            </div>
          </div>
        </div>
      </div>
    </Link>
  );
}
