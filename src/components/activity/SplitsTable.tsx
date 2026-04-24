"use client";

import type { Split, Units } from "@/types";
import { formatPace } from "@/lib/units";

function formatElevDiff(m: number): string {
  const sign = m >= 0 ? "+" : "";
  return `${sign}${Math.round(m)}m`;
}

export function SplitsTable({ splits, units }: { splits: Split[]; units: Units }) {
  if (!splits.length) return null;

  const hasGAP = splits.some(
    (s) => s.average_grade_adjusted_speed != null && s.average_grade_adjusted_speed > 0
  );

  return (
    <div>
      <div className="text-xs text-muted uppercase tracking-wider mb-2">Splits</div>
      <div className="card overflow-hidden">
        <div
          className={`grid text-[10px] text-muted uppercase tracking-wider px-3 py-2 border-b border-border ${
            hasGAP ? "grid-cols-5" : "grid-cols-4"
          }`}
        >
          <span>#</span>
          <span>Pace</span>
          {hasGAP && <span>GAP</span>}
          <span>Avg HR</span>
          <span>Elev</span>
        </div>
        {splits.map((s) => {
          const paceSecsPerKm = s.average_speed > 0 ? 1000 / s.average_speed : null;
          const gapSecsPerKm =
            s.average_grade_adjusted_speed && s.average_grade_adjusted_speed > 0
              ? 1000 / s.average_grade_adjusted_speed
              : null;
          return (
            <div
              key={s.split}
              className={`grid text-sm px-3 py-2.5 border-b border-border/50 last:border-0 ${
                hasGAP ? "grid-cols-5" : "grid-cols-4"
              }`}
            >
              <span className="text-muted font-medium">{s.split}</span>
              <span className="font-medium">
                {paceSecsPerKm ? formatPace(paceSecsPerKm, units) : "—"}
              </span>
              {hasGAP && (
                <span className="text-muted">
                  {gapSecsPerKm ? formatPace(gapSecsPerKm, units) : "—"}
                </span>
              )}
              <span>{s.average_heartrate ? `${Math.round(s.average_heartrate)}` : "—"}</span>
              <span className={s.elevation_difference < 0 ? "text-green-400" : "text-white/60"}>
                {formatElevDiff(s.elevation_difference)}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
