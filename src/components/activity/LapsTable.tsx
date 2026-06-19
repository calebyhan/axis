"use client";

import type { Lap, Units } from "@/types";
import { formatPace, formatDistance, distanceUnit } from "@/lib/units";

function formatDuration(secs: number): string {
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

function isDefaultLapName(name: string, index: number): boolean {
  return name === `Lap ${index}` || name === `Lap${index}`;
}

export function LapsTable({ laps, units }: { laps: Lap[]; units: Units }) {
  if (!laps.length) return null;

  const hasHR = laps.some((l) => l.average_heartrate != null);
  const hasElev = laps.some((l) => l.total_elevation_gain != null && l.total_elevation_gain > 0);
  const hasCustomNames = laps.some((l) => l.name && !isDefaultLapName(l.name, l.lap_index));
  const unit = distanceUnit(units);

  const colCount = 2 + (hasHR ? 1 : 0) + (hasElev ? 1 : 0);
  const gridClass = `grid-cols-${colCount}`;

  return (
    <div>
      <div className="text-xs text-muted uppercase tracking-wider mb-2">Laps</div>
      <div className="card overflow-x-auto">
        <div className="min-w-[20rem]">
          <div className={`grid ${gridClass} text-[10px] text-muted uppercase tracking-wider px-3 py-2 border-b border-border`}>
            <span>Lap</span>
            <span>Pace</span>
            {hasHR && <span>Avg HR</span>}
            {hasElev && <span>Elev</span>}
          </div>
          {laps.map((lap) => {
            const paceSecsPerKm = lap.average_speed > 0 ? 1000 / lap.average_speed : null;
            const distKm = lap.distance / 1000;
            const distFormatted = formatDistance(distKm, units);
            const label = hasCustomNames && lap.name && !isDefaultLapName(lap.name, lap.lap_index)
              ? lap.name
              : `${lap.lap_index}`;

            return (
              <div
                key={lap.lap_index}
                className={`grid ${gridClass} text-sm px-3 py-2.5 border-b border-border/50 last:border-0 items-center`}
              >
                <div>
                  <span className="text-muted font-medium">{label}</span>
                  <div className="text-[11px] text-white/40">
                    {distFormatted} {unit} · {formatDuration(lap.moving_time)}
                  </div>
                </div>
                <span className="font-medium">
                  {paceSecsPerKm ? formatPace(paceSecsPerKm, units) : "—"}
                </span>
                {hasHR && (
                  <span>{lap.average_heartrate ? `${Math.round(lap.average_heartrate)}` : "—"}</span>
                )}
                {hasElev && (
                  <span className={lap.total_elevation_gain != null && lap.total_elevation_gain < 0 ? "text-green-400" : "text-white/60"}>
                    {lap.total_elevation_gain != null ? `+${Math.round(lap.total_elevation_gain)}m` : "—"}
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
