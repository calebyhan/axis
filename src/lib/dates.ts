const DAY_MS = 24 * 60 * 60 * 1000;
const DATE_ONLY_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

type RelativeCalendarDateOptions = {
  weekday?: "long" | "short" | false;
  fallback?: Intl.DateTimeFormatOptions;
};

function parseDate(value: string | Date): Date {
  if (value instanceof Date) return value;

  const dateOnlyMatch = DATE_ONLY_RE.exec(value);
  if (dateOnlyMatch) {
    const [, year, month, day] = dateOnlyMatch;
    return new Date(Number(year), Number(month) - 1, Number(day));
  }

  return new Date(value);
}

function startOfLocalDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

export function localCalendarDayDiff(value: string | Date, now = new Date()): number {
  const target = startOfLocalDay(parseDate(value));
  const today = startOfLocalDay(now);
  return Math.round((today.getTime() - target.getTime()) / DAY_MS);
}

export function formatRelativeCalendarDate(
  value: string | Date,
  now = new Date(),
  options: RelativeCalendarDateOptions = {}
): string {
  const date = parseDate(value);
  const diffDays = localCalendarDayDiff(date, now);

  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  if (diffDays > 1 && diffDays < 7 && options.weekday !== false) {
    return date.toLocaleDateString("en-US", { weekday: options.weekday ?? "long" });
  }

  return date.toLocaleDateString("en-US", options.fallback ?? { month: "short", day: "numeric" });
}
