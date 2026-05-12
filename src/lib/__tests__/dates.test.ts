import { describe, expect, it } from "vitest";
import { formatRelativeCalendarDate, localCalendarDayDiff } from "../dates";

describe("relative calendar dates", () => {
  it("uses local calendar days instead of elapsed 24-hour windows", () => {
    const now = new Date(2025, 0, 2, 8, 0);
    const lateYesterday = new Date(2025, 0, 1, 23, 30);

    expect(localCalendarDayDiff(lateYesterday, now)).toBe(1);
    expect(formatRelativeCalendarDate(lateYesterday, now)).toBe("Yesterday");
  });

  it("treats date-only strings as local dates", () => {
    const now = new Date(2025, 0, 2, 8, 0);

    expect(formatRelativeCalendarDate("2025-01-01", now)).toBe("Yesterday");
  });

  it("formats dates within the previous week with a configurable weekday label", () => {
    const now = new Date(2025, 0, 7, 8, 0);

    expect(formatRelativeCalendarDate("2025-01-03", now, { weekday: "short" })).toBe("Fri");
    expect(
      formatRelativeCalendarDate("2025-01-03", now, {
        weekday: false,
        fallback: { weekday: "short", month: "short", day: "numeric" },
      })
    ).toBe("Fri, Jan 3");
  });
});
