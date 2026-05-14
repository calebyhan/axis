export const dynamic = "force-dynamic";

import {
  getWeeklyStats,
  getBodyWeightHistory,
  getActivityStreak,
  getWeekChecklistData,
  getMonthActiveDays,
  getWeeklyMuscleCoverageSummary,
} from "@/lib/queries/dashboard";
import { getCurrentWeekAdherence } from "@/lib/queries/adherence";
import { getUserDisplayName, getUserTimeZone, getUserUnits } from "@/lib/queries/profile";
import { matchChecklist } from "@/lib/checklist";
import { formatZonedDate } from "@/lib/time-zone";
import { WeeklyStatsSummary } from "@/components/dashboard/WeeklyStatsSummary";
import { CalendarStreak } from "@/components/dashboard/CalendarStreak";
import { WeekChecklist } from "@/components/dashboard/WeekChecklist";
import { BodyWeightSparkline } from "@/components/dashboard/BodyWeightSparkline";
import { WeeklyMuscleCoverage } from "@/components/dashboard/WeeklyMuscleCoverage";
import { WeeklyAdherence } from "@/components/dashboard/WeeklyAdherence";
import type { Activity, DayType, ScheduleOverride, WeeklyScheduleRow } from "@/types";

export default async function DashboardPage() {
  const [weeklyStats, weeklyMuscleCoverageSummary, bodyWeightData, streak, checklistData, units, activeDays, displayName, adherence, timeZone] = await Promise.all([
    getWeeklyStats(),
    getWeeklyMuscleCoverageSummary(),
    getBodyWeightHistory(30),
    getActivityStreak(),
    getWeekChecklistData(),
    getUserUnits(),
    getMonthActiveDays(),
    getUserDisplayName(),
    getCurrentWeekAdherence(),
    getUserTimeZone(),
  ]);

  const todayLabel = formatZonedDate(new Date(), timeZone, {
    weekday: "long",
    month: "long",
    day: "numeric",
  });

  const dayTypeMap = new Map(
    (checklistData.dayTypes as DayType[]).map((dt) => [dt.id, dt])
  );

  const checklistItems = matchChecklist(
    checklistData.schedule as WeeklyScheduleRow[],
    checklistData.activities as Activity[],
    checklistData.overrides as ScheduleOverride[],
    checklistData.weekStart,
    dayTypeMap,
    timeZone
  );

  return (
    <div className="page-shell flex flex-col gap-5">
      <div className="page-header">
        <div>
          <h1 className="page-title">Dashboard</h1>
          <p className="mt-2 text-sm text-white/55">
            Hello, {displayName}. Today is {todayLabel}.
          </p>
        </div>
      </div>

      <div className="mobile-landscape-stack grid gap-5 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="card p-5 sm:p-6">
          <div className="text-[11px] uppercase tracking-[0.24em] text-white/45 mb-3">This Week</div>
          <WeeklyStatsSummary {...weeklyStats} units={units} />
        </div>
        <div className="hidden lg:block">
          <WeeklyMuscleCoverage
            coverage={weeklyMuscleCoverageSummary.coverage}
            details={weeklyMuscleCoverageSummary.details}
            totalSets={weeklyMuscleCoverageSummary.totalSets}
            strengthBalance={weeklyMuscleCoverageSummary.strengthBalance}
          />
        </div>
      </div>

      <WeeklyAdherence adherence={adherence} />

      <div className="mobile-landscape-stack grid gap-5 lg:grid-cols-3">
        <div className="mobile-landscape-unspan lg:col-span-2">
          <CalendarStreak
            streak={streak}
            activities={activeDays.activities}
            dayPlans={activeDays.dayPlans}
            skipOverrides={activeDays.skipOverrides}
            todayKey={activeDays.todayKey}
          />
        </div>
        <WeekChecklist
          items={checklistItems}
          dayTypes={checklistData.dayTypes as DayType[]}
          todayKey={checklistData.todayKey}
        />
      </div>

      <div className="lg:hidden">
        <WeeklyMuscleCoverage
          coverage={weeklyMuscleCoverageSummary.coverage}
          details={weeklyMuscleCoverageSummary.details}
          totalSets={weeklyMuscleCoverageSummary.totalSets}
          strengthBalance={weeklyMuscleCoverageSummary.strengthBalance}
        />
      </div>

      <BodyWeightSparkline data={bodyWeightData} units={units} />
    </div>
  );
}
