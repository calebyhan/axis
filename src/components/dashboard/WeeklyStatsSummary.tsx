interface Props {
  runDistance: number;
  sessionCount: number;
  totalVolume: number;
  weightDelta: number | null;
}

export function WeeklyStatsSummary({
  runDistance,
  sessionCount,
  totalVolume,
  weightDelta,
}: Props) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      <Stat
        value={runDistance > 0 ? `${runDistance.toFixed(1)}` : "—"}
        unit="km"
        label="Distance"
      />
      <Stat value={String(sessionCount)} label="Sessions" />
      <Stat
        value={totalVolume >= 1000 ? `${(totalVolume / 1000).toFixed(0)}k` : String(Math.round(totalVolume))}
        unit="kg"
        label="Volume"
      />
      <Stat
        value={weightDelta !== null ? (weightDelta >= 0 ? `+${weightDelta.toFixed(1)}` : weightDelta.toFixed(1)) : "—"}
        unit={weightDelta !== null ? "kg" : ""}
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
    <div className="card-soft p-3.5 text-center">
      <div className={`text-lg font-semibold tracking-[-0.04em] ${valueClass}`}>
        {value}
        {unit && <span className="text-xs font-normal text-muted ml-1">{unit}</span>}
      </div>
      <div className="text-[11px] text-white/45 mt-1 uppercase tracking-[0.18em]">{label}</div>
    </div>
  );
}
