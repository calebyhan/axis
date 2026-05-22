import type { Units } from "@/types";
import { formatDistance, formatWeight, distanceUnit, weightUnit } from "@/lib/units";

interface Props {
  runDistance: number;
  sessionCount: number;
  totalVolume: number;
  weightDelta: number | null;
  units: Units;
}

export function WeeklyStatsSummary({
  runDistance,
  sessionCount,
  totalVolume,
  weightDelta,
  units,
}: Props) {
  const wDeltaDisplay = weightDelta !== null
    ? (weightDelta >= 0 ? `+${formatWeight(weightDelta, units)}` : `-${formatWeight(Math.abs(weightDelta), units)}`)
    : "—";

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      <Stat
        value={runDistance > 0 ? formatDistance(runDistance, units) : "—"}
        unit={distanceUnit(units)}
        label="Distance"
      />
      <Stat value={String(sessionCount)} label="Sessions" />
      <Stat
        value={formatWeight(totalVolume, units)}
        unit={weightUnit(units)}
        label="Volume"
      />
      <Stat
        value={wDeltaDisplay}
        unit={weightDelta !== null ? weightUnit(units) : ""}
        label="Weight Δ"
        highlight={weightDelta !== null ? (weightDelta > 0 ? "green" : weightDelta < 0 ? "red" : undefined) : undefined}
      />
    </div>
  );
}

function Stat({
  value,
  unit,
  label,
  highlight,
}: {
  value: string;
  unit?: string;
  label: string;
  highlight?: "green" | "red";
}) {
  const valueClass =
    highlight === "green"
      ? "text-green-400"
      : highlight === "red"
      ? "text-red-400"
      : "text-white";

  return (
    <div className="card-soft min-w-0 p-3.5 text-center">
      <div className={`whitespace-nowrap text-lg font-semibold tracking-normal ${valueClass}`}>
        {value}
        {unit && <span className="text-xs font-normal text-muted ml-1">{unit}</span>}
      </div>
      <div className="mt-1 whitespace-nowrap text-[11px] uppercase tracking-[0.18em] text-white/45">{label}</div>
    </div>
  );
}
