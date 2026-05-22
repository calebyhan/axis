import {
  addDateKeyDays,
  dateKeyDayDiff,
  monthStartDateKey,
  startOfWeekDateKey,
  zonedDateKey,
  zonedDateTimeToUtc,
} from "@/lib/time-zone";

export type TimeRange = "week" | "month" | "year" | "all";

export const DEFAULT_TIME_RANGE: TimeRange = "week";

export const VALID_TIME_RANGES: TimeRange[] = ["week", "month", "year", "all"];

export const STATS_RANGE_LABELS: Record<TimeRange, string> = {
  week: "This week",
  month: "This month",
  year: "This year",
  all: "All time",
};

export const STATS_RANGE_CONTEXT_LABELS: Record<TimeRange, string> = {
  week: "this week",
  month: "this month",
  year: "this year",
  all: "all time",
};

export interface StatsRangeBounds {
  startDateKey: string | null;
  endDateKey: string;
  endExclusiveDateKey: string;
  startInstant: string | null;
  endExclusiveInstant: string;
}

function yearStartDateKey(dateKey: string): string {
  return `${dateKey.slice(0, 4)}-01-01`;
}

function dateKeyParts(dateKey: string): { year: number; month: number; day: number } {
  return {
    year: Number(dateKey.slice(0, 4)),
    month: Number(dateKey.slice(5, 7)),
    day: Number(dateKey.slice(8, 10)),
  };
}

function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0, 12)).getUTCDate();
}

function formatDateKey(year: number, month: number, day: number): string {
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function shiftDateKeyMonths(dateKey: string, delta: number): string {
  const { year, month, day } = dateKeyParts(dateKey);
  const targetMonthIndex = year * 12 + (month - 1) + delta;
  const targetYear = Math.floor(targetMonthIndex / 12);
  const targetMonth = (targetMonthIndex % 12) + 1;
  return formatDateKey(targetYear, targetMonth, Math.min(day, daysInMonth(targetYear, targetMonth)));
}

function boundsFromDateKeys(startDateKey: string | null, endDateKey: string, timeZone: string): StatsRangeBounds {
  const endExclusiveDateKey = addDateKeyDays(endDateKey, 1);

  return {
    startDateKey,
    endDateKey,
    endExclusiveDateKey,
    startInstant: startDateKey ? zonedDateTimeToUtc(startDateKey, timeZone).toISOString() : null,
    endExclusiveInstant: zonedDateTimeToUtc(endExclusiveDateKey, timeZone).toISOString(),
  };
}

export function getStatsRangeBounds(
  range: TimeRange,
  timeZone: string,
  now = new Date()
): StatsRangeBounds {
  const todayKey = zonedDateKey(now, timeZone);
  const startDateKey =
    range === "week"
      ? startOfWeekDateKey(todayKey)
      : range === "month"
      ? monthStartDateKey(todayKey)
      : range === "year"
      ? yearStartDateKey(todayKey)
      : null;

  return boundsFromDateKeys(startDateKey, todayKey, timeZone);
}

export function getPreviousStatsRangeBounds(
  range: TimeRange,
  timeZone: string,
  now = new Date()
): StatsRangeBounds | null {
  const current = getStatsRangeBounds(range, timeZone, now);
  if (!current.startDateKey) return null;

  if (range === "week") {
    return boundsFromDateKeys(
      addDateKeyDays(current.startDateKey, -7),
      addDateKeyDays(current.endDateKey, -7),
      timeZone
    );
  }

  if (range === "month") {
    const previousStart = shiftDateKeyMonths(current.startDateKey, -1);
    const previousMonthEnd = addDateKeyDays(current.startDateKey, -1);
    const elapsedDays = dateKeyDayDiff(current.startDateKey, current.endDateKey);
    const unclampedEnd = addDateKeyDays(previousStart, elapsedDays);
    return boundsFromDateKeys(
      previousStart,
      unclampedEnd > previousMonthEnd ? previousMonthEnd : unclampedEnd,
      timeZone
    );
  }

  const previousStart = shiftDateKeyMonths(current.startDateKey, -12);
  const previousEnd = shiftDateKeyMonths(current.endDateKey, -12);
  return boundsFromDateKeys(previousStart, previousEnd, timeZone);
}

export function getStatsChartBucketDateKey(
  range: TimeRange,
  dateKey: string,
  rangeStartDateKey: string | null = null
): string {
  if (range === "week") return dateKey;

  const weekStart = startOfWeekDateKey(dateKey);
  return rangeStartDateKey && weekStart < rangeStartDateKey ? rangeStartDateKey : weekStart;
}
