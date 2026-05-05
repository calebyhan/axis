export const dynamic = "force-dynamic";

import {
  getWeeklyStats,
  getBodyWeightHistory,
  getActivityStreak,
  getWeekChecklistData,
  getMonthActiveDays,
} from "@/lib/queries/dashboard";
import { getUserUnits } from "@/lib/queries/profile";
import { matchChecklist } from "@/lib/checklist";
import { WeeklyStatsSummary } from "@/components/dashboard/WeeklyStatsSummary";
import { CalendarStreak } from "@/components/dashboard/CalendarStreak";
import { WeekChecklist } from "@/components/dashboard/WeekChecklist";
import { BodyWeightSparkline } from "@/components/dashboard/BodyWeightSparkline";
import type { Activity, DayType, ScheduleOverride, WeeklyScheduleRow } from "@/types";

export default async function DashboardPage() {
  const [weeklyStats, bodyWeightData, streak, checklistData, units, activeDays] = await Promise.all([
    getWeeklyStats(),
    getBodyWeightHistory(30),
    getActivityStreak(),
    getWeekChecklistData(),
    getUserUnits(),
    getMonthActiveDays(),
  ]);

  const dayTypeMap = new Map(
    (checklistData.dayTypes as DayType[]).map((dt) => [dt.id, dt])
  );

  const checklistItems = matchChecklist(
    checklistData.schedule as WeeklyScheduleRow[],
    checklistData.activities as Activity[],
    checklistData.overrides as ScheduleOverride[],
    checklistData.weekStart,
    dayTypeMap
  );

  return (
    <div className="page-shell flex flex-col gap-5">
      <div className="page-header">
        <div>
          <h1 className="page-title">Dashboard</h1>
        </div>
      </div>

      <div className="card p-5 sm:p-6">
        <div className="text-[11px] uppercase tracking-[0.24em] text-white/45 mb-3">This Week</div>
        <WeeklyStatsSummary {...weeklyStats} units={units} />
      </div>

      <div className={`grid gap-5 ${checklistItems.length > 0 ? "md:grid-cols-3" : "grid-cols-1"}`}>
        <div className={checklistItems.length > 0 ? "md:col-span-2" : ""}>
          <CalendarStreak
            streak={streak}
            activities={activeDays.activities}
            dayPlans={activeDays.dayPlans}
            skipOverrides={activeDays.skipOverrides}
          />
        </div>
        {checklistItems.length > 0 && (
          <WeekChecklist items={checklistItems} dayTypes={checklistData.dayTypes as DayType[]} />
        )}
      </div>

      <BodyWeightSparkline data={bodyWeightData} units={units} />
    </div>
  );
}
