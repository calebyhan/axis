export const dynamic = "force-dynamic";

import { getVolumeOverTime, getRunningStats, getBodyWeightStats, type TimeRange } from "@/lib/queries/stats";
import { getUserUnits } from "@/lib/queries/profile";
import { StatsClient } from "@/components/stats/StatsClient";

const VALID_RANGES: TimeRange[] = ["week", "month", "year", "all"];

function parseRange(raw: string | undefined): TimeRange {
  return VALID_RANGES.includes(raw as TimeRange) ? (raw as TimeRange) : "month";
}

export default async function StatsPage({
  searchParams,
}: {
  searchParams: Promise<{ range?: string }>;
}) {
  const { range } = await searchParams;
  const timeRange = parseRange(range);

  const [volumeData, runningData, bodyData, units] = await Promise.all([
    getVolumeOverTime(timeRange),
    getRunningStats(timeRange),
    getBodyWeightStats(timeRange),
    getUserUnits(),
  ]);

  return (
    <div className="page-shell">
      <div className="page-header">
        <div>
          <div className="page-kicker">Trends</div>
          <h1 className="page-title">Stats</h1>
          <p className="page-subtitle">Performance trends and body signals, framed with softer contrast and better readability.</p>
        </div>
      </div>
      <StatsClient
        timeRange={timeRange}
        initialVolumeData={volumeData}
        initialRunningData={runningData}
        initialBodyData={bodyData}
        units={units}
      />
    </div>
  );
}
