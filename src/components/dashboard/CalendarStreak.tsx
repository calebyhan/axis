"use client";

import { CalendarMonth } from "@/components/calendar/CalendarMonth";
import { buildCalendarActiveDays, type CalendarActivity } from "@/lib/calendar";
import { dateKeyToLocalDate } from "@/lib/time-zone";
import type { DayPlanEntry } from "@/lib/queries/dashboard";

interface Props {
  streak: number;
  activities: CalendarActivity[];
  dayPlans: DayPlanEntry[];
  skipOverrides: { date: string; slot: "workout" | "cardio" }[];
  todayKey: string;
}

export function CalendarStreak({ streak, activities, dayPlans, skipOverrides, todayKey }: Props) {
  const today = dateKeyToLocalDate(todayKey);
  const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
  const activeDays = buildCalendarActiveDays(activities, dayPlans, skipOverrides, today, monthStart);

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
