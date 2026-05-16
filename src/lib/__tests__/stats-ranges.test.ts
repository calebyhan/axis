import { describe, expect, it } from "vitest";
import {
  STATS_RANGE_CONTEXT_LABELS,
  STATS_RANGE_LABELS,
  getStatsChartBucketDateKey,
  getStatsRangeBounds,
} from "../stats-ranges";

describe("stats range bounds", () => {
  it("uses current calendar periods in the user's time zone", () => {
    const now = new Date("2026-05-16T16:00:00.000Z");

    expect(getStatsRangeBounds("week", "America/New_York", now)).toMatchObject({
      startDateKey: "2026-05-10",
      endDateKey: "2026-05-16",
      endExclusiveDateKey: "2026-05-17",
    });
    expect(getStatsRangeBounds("month", "America/New_York", now)).toMatchObject({
      startDateKey: "2026-05-01",
      endDateKey: "2026-05-16",
      endExclusiveDateKey: "2026-05-17",
    });
    expect(getStatsRangeBounds("year", "America/New_York", now)).toMatchObject({
      startDateKey: "2026-01-01",
      endDateKey: "2026-05-16",
      endExclusiveDateKey: "2026-05-17",
    });
    expect(getStatsRangeBounds("all", "America/New_York", now)).toMatchObject({
      startDateKey: null,
      endDateKey: "2026-05-16",
      endExclusiveDateKey: "2026-05-17",
    });
  });

  it("derives today from the requested time zone before computing the range", () => {
    const now = new Date("2026-05-16T02:00:00.000Z");

    expect(getStatsRangeBounds("month", "America/New_York", now)).toMatchObject({
      startDateKey: "2026-05-01",
      endDateKey: "2026-05-15",
      endExclusiveDateKey: "2026-05-16",
    });
  });

  it("keeps visible labels and tooltip context labels aligned", () => {
    expect(STATS_RANGE_LABELS.week).toBe("This week");
    expect(STATS_RANGE_CONTEXT_LABELS.week).toBe("this week");
    expect(STATS_RANGE_LABELS.all).toBe("All time");
    expect(STATS_RANGE_CONTEXT_LABELS.all).toBe("all time");
  });

  it("buckets week charts by day and longer charts by week", () => {
    expect(getStatsChartBucketDateKey("week", "2026-05-13", "2026-05-10")).toBe("2026-05-13");
    expect(getStatsChartBucketDateKey("month", "2026-05-04", "2026-05-01")).toBe("2026-05-03");
    expect(getStatsChartBucketDateKey("month", "2026-05-01", "2026-05-01")).toBe("2026-05-01");
    expect(getStatsChartBucketDateKey("all", "2026-05-13")).toBe("2026-05-10");
  });
});
