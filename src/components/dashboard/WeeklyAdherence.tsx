import type { AdherenceWeek } from "@/lib/adherence";

interface Props {
  adherence: AdherenceWeek;
}

function pctLabel(value: number | null) {
  return value === null ? "—" : `${value}%`;
}

export function WeeklyAdherence({ adherence }: Props) {
  const { summary } = adherence;
  const done = summary.completed + summary.swapped;

  return (
    <div className="card p-5 sm:p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="text-[11px] uppercase tracking-[0.24em] text-white/45">Plan Adherence</div>
          <div className="mt-2 text-sm text-white/60">
            {summary.planned > 0 ? `${done} of ${summary.planned} planned sessions done` : "No planned sessions this week"}
          </div>
        </div>
        <div className="text-2xl font-semibold tracking-[-0.05em] text-white">
          {pctLabel(summary.completionRate)}
        </div>
      </div>

      <div className="mt-4 grid grid-cols-4 gap-2">
        <MiniStat label="Done" value={String(summary.completed)} />
        <MiniStat label="Swapped" value={String(summary.swapped)} />
        <MiniStat label="Missed" value={String(summary.missed)} />
        <MiniStat label="Pending" value={String(summary.pending)} />
      </div>
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-white/10 bg-white/[0.03] px-2 py-2 text-center">
      <div className="text-base font-semibold text-white">{value}</div>
      <div className="mt-0.5 text-[10px] uppercase tracking-[0.14em] text-white/40">{label}</div>
    </div>
  );
}
