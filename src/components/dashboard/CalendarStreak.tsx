"use client";

import { CalendarMonth } from "@/components/calendar/CalendarMonth";
import { buildCalendarActiveDays } from "@/lib/calendar";
import type { DayPlanEntry } from "@/lib/queries/dashboard";

interface Props {
  streak: number;
  activities: { start_time: string; type: string }[];
  dayPlans: DayPlanEntry[];
  skipOverrides: { date: string; slot: "workout" | "cardio" }[];
}

export function CalendarStreak({ streak, activities, dayPlans, skipOverrides }: Props) {
  const today = new Date();
  const activeDays = buildCalendarActiveDays(activities, dayPlans, skipOverrides, today);

  return (
    <CalendarMonth
      year={today.getFullYear()}
      month={today.getMonth()}
      activeDays={activeDays}
      badge={streak > 0 ? `${streak} day streak` : null}
      today={today}
    />
  );
}
