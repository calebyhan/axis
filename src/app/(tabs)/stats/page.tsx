export const dynamic = "force-dynamic";
export const metadata = { title: "Stats — Axis", description: "Training trends and performance charts" };

import {
  getVolumeOverTime,
  getRunningStats,
  getBodyWeightStats,
  getWorkoutSummary,
  getTrainingLoadHistory,
  getHistoricalPlanCalendarData,
} from "@/lib/queries/stats";
import { getAdherenceHistory } from "@/lib/queries/adherence";
import { getUserTimeZone, getUserUnits } from "@/lib/queries/profile";
import { zonedDateKey } from "@/lib/time-zone";
import { VALID_TIME_RANGES, type TimeRange } from "@/lib/stats-ranges";
import { StatsClient } from "@/components/stats/StatsClient";

function parseRange(raw: string | undefined): TimeRange {
  return VALID_TIME_RANGES.includes(raw as TimeRange) ? (raw as TimeRange) : "month";
}

export default async function StatsPage({
  searchParams,
}: {
  searchParams: Promise<{ range?: string }>;
}) {
  const { range } = await searchParams;
  const timeRange = parseRange(range);

  const [volumeData, runningData, bodyData, workoutSummary, trainingLoad, adherence, planCalendarData, units, timeZone] = await Promise.all([
    getVolumeOverTime(timeRange),
    getRunningStats(timeRange),
    getBodyWeightStats(timeRange),
    getWorkoutSummary(timeRange),
    getTrainingLoadHistory(timeRange),
    getAdherenceHistory(timeRange),
    timeRange === "all" ? getHistoricalPlanCalendarData(timeRange) : Promise.resolve(null),
    getUserUnits(),
    getUserTimeZone(),
  ]);
  const resolvedPlanCalendarData = planCalendarData ?? {
    activities: [],
    dayPlans: [],
    skipOverrides: [],
    todayKey: zonedDateKey(new Date(), timeZone),
  };

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
        adherence={adherence}
        planCalendarData={resolvedPlanCalendarData}
        units={units}
      />
    </div>
  );
}
