export const dynamic = "force-dynamic";

import { getVolumeOverTime, getRunningStats, getBodyWeightStats, type TimeRange } from "@/lib/queries/stats";
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

  const [volumeData, runningData, bodyData] = await Promise.all([
    getVolumeOverTime(timeRange),
    getRunningStats(timeRange),
    getBodyWeightStats(timeRange),
  ]);

  return (
    <div className="px-4 py-6 max-w-2xl mx-auto">
      <h1 className="text-xl font-semibold mb-6">Stats</h1>
      <StatsClient
        timeRange={timeRange}
        initialVolumeData={volumeData}
        initialRunningData={runningData}
        initialBodyData={bodyData}
      />
    </div>
  );
}
