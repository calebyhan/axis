export const dynamic = "force-dynamic";
export const metadata = { title: "Stats — Axis", description: "Training trends and performance charts" };

import {
  getVolumeOverTime,
  getRunningStats,
  getBodyWeightStats,
  getWorkoutSummary,
  getTrainingLoadHistory,
  getHistoricalPlanCalendarData,
  type TimeRange,
} from "@/lib/queries/stats";
import { getAdherenceHistory } from "@/lib/queries/adherence";
import { getUserUnits } from "@/lib/queries/profile";
import { StatsClient } from "@/components/stats/StatsClient";

const VALID_RANGES: TimeRange[] = ["week", "month", "year", "all"];
const EMPTY_PLAN_CALENDAR_DATA = { activities: [], dayPlans: [], skipOverrides: [] };

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

  const [volumeData, runningData, bodyData, workoutSummary, trainingLoad, adherence, planCalendarData, units] = await Promise.all([
    getVolumeOverTime(timeRange),
    getRunningStats(timeRange),
    getBodyWeightStats(timeRange),
    getWorkoutSummary(timeRange),
    getTrainingLoadHistory(timeRange),
    getAdherenceHistory(timeRange),
    timeRange === "all" ? getHistoricalPlanCalendarData(timeRange) : Promise.resolve(EMPTY_PLAN_CALENDAR_DATA),
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
        adherence={adherence}
        planCalendarData={planCalendarData}
        units={units}
      />
    </div>
  );
}
