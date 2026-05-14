export const DEFAULT_TIME_ZONE = "UTC";
export const TIME_ZONE_COOKIE = "axis-time-zone";

const DATE_KEY_RE = /^(\d{4})-(\d{2})-(\d{2})$/;
const DAY_MS = 24 * 60 * 60 * 1000;

export function normalizeTimeZone(timeZone: string | null | undefined): string | null {
  if (!timeZone) return null;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone }).format(new Date());
    return timeZone;
  } catch {
    return null;
  }
}

export function safeTimeZone(
  timeZone: string | null | undefined,
  fallback = DEFAULT_TIME_ZONE
): string {
  return normalizeTimeZone(timeZone) ?? fallback;
}

function dateFromInput(value: string | Date): Date {
  return value instanceof Date ? value : new Date(value);
}

function dateKeyParts(dateKey: string): { year: number; month: number; day: number } {
  const match = DATE_KEY_RE.exec(dateKey);
  if (!match) throw new Error(`Invalid date key: ${dateKey}`);
  return {
    year: Number(match[1]),
    month: Number(match[2]),
    day: Number(match[3]),
  };
}

export function zonedDateKey(value: string | Date, timeZone: string): string {
  const date = dateFromInput(value);
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: safeTimeZone(timeZone),
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const lookup = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${lookup.year}-${lookup.month}-${lookup.day}`;
}

export function formatZonedDate(
  value: string | Date,
  timeZone: string,
  options: Intl.DateTimeFormatOptions
): string {
  return new Intl.DateTimeFormat("en-US", {
    ...options,
    timeZone: safeTimeZone(timeZone),
  }).format(dateFromInput(value));
}

export function addDateKeyDays(dateKey: string, days: number): string {
  const { year, month, day } = dateKeyParts(dateKey);
  const date = new Date(Date.UTC(year, month - 1, day + days, 12));
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}-${String(date.getUTCDate()).padStart(2, "0")}`;
}

export function dateKeyToLocalDate(dateKey: string): Date {
  const { year, month, day } = dateKeyParts(dateKey);
  return new Date(year, month - 1, day);
}

export function jsDayFromDateKey(dateKey: string): number {
  const { year, month, day } = dateKeyParts(dateKey);
  return new Date(Date.UTC(year, month - 1, day, 12)).getUTCDay();
}

export function isoDayFromDateKey(dateKey: string): number {
  return (jsDayFromDateKey(dateKey) + 6) % 7;
}

export function startOfWeekDateKey(dateKey: string): string {
  return addDateKeyDays(dateKey, -jsDayFromDateKey(dateKey));
}

export function monthStartDateKey(dateKey: string): string {
  const { year, month } = dateKeyParts(dateKey);
  return `${year}-${String(month).padStart(2, "0")}-01`;
}

export function dateKeyDayDiff(value: string, now: string): number {
  const valueParts = dateKeyParts(value);
  const nowParts = dateKeyParts(now);
  const valueTime = Date.UTC(valueParts.year, valueParts.month - 1, valueParts.day, 12);
  const nowTime = Date.UTC(nowParts.year, nowParts.month - 1, nowParts.day, 12);
  return Math.round((nowTime - valueTime) / DAY_MS);
}

function getTimeZoneOffsetMs(date: Date, timeZone: string): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: safeTimeZone(timeZone),
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const lookup = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  const asUTC = Date.UTC(
    Number(lookup.year),
    Number(lookup.month) - 1,
    Number(lookup.day),
    Number(lookup.hour),
    Number(lookup.minute),
    Number(lookup.second)
  );
  return asUTC - date.getTime();
}

export function zonedDateTimeToUtc(
  dateKey: string,
  timeZone: string,
  hour = 0,
  minute = 0,
  second = 0
): Date {
  const { year, month, day } = dateKeyParts(dateKey);
  const utcGuess = new Date(Date.UTC(year, month - 1, day, hour, minute, second));
  const offset = getTimeZoneOffsetMs(utcGuess, timeZone);
  const firstPass = new Date(utcGuess.getTime() - offset);
  const correctedOffset = getTimeZoneOffsetMs(firstPass, timeZone);
  return new Date(utcGuess.getTime() - correctedOffset);
}

export function dateKeyRangeUtc(
  startDateKey: string,
  endExclusiveDateKey: string,
  timeZone: string
): { start: Date; end: Date } {
  return {
    start: zonedDateTimeToUtc(startDateKey, timeZone),
    end: zonedDateTimeToUtc(endExclusiveDateKey, timeZone),
  };
}
