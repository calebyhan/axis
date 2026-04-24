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
import type { Activity, WeeklyScheduleRow } from "@/types";
import type { ChecklistDay } from "@/lib/checklist";

export default async function DashboardPage() {
  const [weeklyStats, bodyWeightData, streak, checklistData, units, activeDays] = await Promise.all([
    getWeeklyStats(),
    getBodyWeightHistory(30),
    getActivityStreak(),
    getWeekChecklistData(),
    getUserUnits(),
    getMonthActiveDays(),
  ]);

  const checklistItems: ChecklistDay[] = matchChecklist(
    checklistData.schedule as WeeklyScheduleRow[],
    checklistData.activities as Activity[]
  );

  return (
    <div className="page-shell flex flex-col gap-5">
      <div className="page-header">
        <div>
          <div className="page-kicker">Overview</div>
          <h1 className="page-title">Dashboard</h1>
          <p className="page-subtitle">
            Your week at a glance, with the cleanest view of training momentum, streaks, and recovery trends.
          </p>
        </div>
      </div>

      <div className="card p-5 sm:p-6">
        <div className="text-[11px] uppercase tracking-[0.24em] text-white/45 mb-3">This Week</div>
        <WeeklyStatsSummary {...weeklyStats} units={units} />
      </div>

      <CalendarStreak streak={streak} activeDays={activeDays} />

      {checklistItems.length > 0 && (
        <div>
          <h2 className="section-label">Planned sessions</h2>
          <WeekChecklist items={checklistItems} />
        </div>
      )}

      <div>
        <h2 className="section-label">Body weight</h2>
        <BodyWeightSparkline data={bodyWeightData} />
      </div>
    </div>
  );
}
