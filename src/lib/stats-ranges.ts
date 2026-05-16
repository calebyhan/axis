import {
  addDateKeyDays,
  monthStartDateKey,
  startOfWeekDateKey,
  zonedDateKey,
  zonedDateTimeToUtc,
} from "@/lib/time-zone";

export type TimeRange = "week" | "month" | "year" | "all";

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
  const endExclusiveDateKey = addDateKeyDays(todayKey, 1);

  return {
    startDateKey,
    endDateKey: todayKey,
    endExclusiveDateKey,
    startInstant: startDateKey ? zonedDateTimeToUtc(startDateKey, timeZone).toISOString() : null,
    endExclusiveInstant: zonedDateTimeToUtc(endExclusiveDateKey, timeZone).toISOString(),
  };
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
