import { formatBalanceCount, type StrengthBalanceSummary } from "@/lib/strength-balance";

interface Props {
  balance: StrengthBalanceSummary;
  contextLabel?: string;
  compact?: boolean;
  showInactiveAxes?: boolean;
}

function scoreTone(score: number | null): string {
  if (score === null) return "text-white/45";
  if (score >= 80) return "text-emerald-300";
  if (score >= 60) return "text-yellow-300";
  return "text-red-300";
}

function barTone(score: number | null): string {
  if (score === null) return "bg-white/15";
  if (score >= 80) return "bg-emerald-300";
  if (score >= 60) return "bg-yellow-300";
  return "bg-red-300";
}

export function BalanceScoreCard({
  balance,
  contextLabel = "this week",
  compact = false,
  showInactiveAxes = true,
}: Props) {
  const axes = showInactiveAxes ? balance.axes : balance.axes.filter((axis) => axis.score !== null);
  const topNudge = balance.nudges[0];

  return (
    <div className="card p-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="text-sm font-medium">Balance Score</h3>
          <p className="mt-1 text-xs text-muted">{contextLabel}</p>
        </div>
        <div className="text-right">
          <div className={`text-2xl font-semibold leading-none ${scoreTone(balance.score)}`}>
            {balance.score ?? "—"}
          </div>
          <div className="mt-1 text-[11px] text-muted">{balance.label}</div>
        </div>
      </div>

      {topNudge && (
        <div className="mt-4 rounded-lg border border-yellow-300/20 bg-yellow-300/[0.06] px-3 py-2 text-xs text-yellow-100">
          {topNudge.message}
        </div>
      )}

      <div className={`mt-4 flex flex-col ${compact ? "gap-2.5" : "gap-3"}`}>
        {axes.map((axis) => {
          const total = axis.left + axis.right;
          const leftPct = total > 0 ? Math.max(8, Math.round((axis.left / total) * 100)) : 50;
          const rightPct = total > 0 ? Math.max(8, 100 - leftPct) : 50;
          const scoreLabel = axis.score === null ? "—" : String(axis.score);

          return (
            <div key={axis.id} className="min-w-0">
              <div className="flex items-center justify-between gap-3 text-xs">
                <span className="min-w-0 truncate text-white/75">{axis.label}</span>
                <span className={`shrink-0 font-medium ${scoreTone(axis.score)}`}>{scoreLabel}</span>
              </div>
              <div className="mt-1.5 flex h-1.5 overflow-hidden rounded-full bg-white/10">
                <div
                  className={axis.score === null ? "bg-white/15" : "bg-accent"}
                  style={{ width: `${leftPct}%` }}
                />
                <div
                  className={barTone(axis.score)}
                  style={{ width: `${rightPct}%` }}
                />
              </div>
              <div className="mt-1 flex justify-between gap-2 text-[11px] text-muted">
                <span className="min-w-0 truncate">
                  {axis.leftLabel} {formatBalanceCount(axis.left)}
                </span>
                <span className="min-w-0 truncate text-right">
                  {axis.rightLabel} {formatBalanceCount(axis.right)}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
