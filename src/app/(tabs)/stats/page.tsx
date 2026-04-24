export const dynamic = "force-dynamic";

import { getVolumeOverTime, getRunningStats, getBodyWeightStats, getWorkoutSummary, getTrainingLoadHistory, type TimeRange } from "@/lib/queries/stats";
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

  const [volumeData, runningData, bodyData, workoutSummary, trainingLoad, units] = await Promise.all([
    getVolumeOverTime(timeRange),
    getRunningStats(timeRange),
    getBodyWeightStats(timeRange),
    getWorkoutSummary(timeRange),
    getTrainingLoadHistory(),
    getUserUnits(),
  ]);

  return (
    <div className="page-shell">
      <div className="page-header">
        <div>
          <h1 className="page-title">Stats</h1>
        </div>
      </div>
      <StatsClient
        timeRange={timeRange}
        initialVolumeData={volumeData}
        initialRunningData={runningData}
        initialBodyData={bodyData}
        workoutSummary={workoutSummary}
        trainingLoad={trainingLoad}
        units={units}
      />
    </div>
  );
}
