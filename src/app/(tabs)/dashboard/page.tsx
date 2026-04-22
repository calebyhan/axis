export const dynamic = "force-dynamic";

import {
  getWeeklyStats,
  getBodyWeightHistory,
  getActivityStreak,
  getWeekChecklistData,
} from "@/lib/queries/dashboard";
import { matchChecklist } from "@/lib/checklist";
import { WeeklyStatsSummary } from "@/components/dashboard/WeeklyStatsSummary";
import { CalendarStreak } from "@/components/dashboard/CalendarStreak";
import { WeekChecklist } from "@/components/dashboard/WeekChecklist";
import { BodyWeightSparkline } from "@/components/dashboard/BodyWeightSparkline";
import type { Activity, WeeklyScheduleRow } from "@/types";
import Link from "next/link";

export default async function DashboardPage() {
  const [weeklyStats, bodyWeightData, streak, checklistData] = await Promise.all([
    getWeeklyStats(),
    getBodyWeightHistory(30),
    getActivityStreak(),
    getWeekChecklistData(),
  ]);

  const checklistItems = matchChecklist(
    checklistData.schedule as WeeklyScheduleRow[],
    checklistData.activities as Activity[]
  );

  // Build active days set for calendar (last 60 days of activities)
  const activeDays = new Set<string>(
    (checklistData.activities as Activity[]).map((a) => a.start_time.split("T")[0])
  );

  return (
    <div className="px-4 py-6 max-w-2xl mx-auto flex flex-col gap-5">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Dashboard</h1>
        <Link
          href="/log"
          className="bg-accent text-white text-sm font-medium px-4 py-2 rounded-lg hover:opacity-90 transition-opacity"
        >
          + Session
        </Link>
      </div>

      <WeeklyStatsSummary {...weeklyStats} />

      <CalendarStreak streak={streak} activeDays={activeDays} />

      {checklistItems.length > 0 && (
        <div>
          <h2 className="text-sm font-medium text-muted mb-2 uppercase tracking-wide">This Week</h2>
          <WeekChecklist items={checklistItems} />
        </div>
      )}

      <div>
        <h2 className="text-sm font-medium text-muted mb-2 uppercase tracking-wide">Body Weight</h2>
        <BodyWeightSparkline data={bodyWeightData} />
      </div>
    </div>
  );
}
