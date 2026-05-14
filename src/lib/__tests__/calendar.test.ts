import { describe, expect, it } from "vitest";
import { buildCalendarActiveDays } from "../calendar";

describe("buildCalendarActiveDays", () => {
  it("uses server-provided activity date keys instead of recalculating from runtime local time", () => {
    const activeDays = buildCalendarActiveDays(
      [
        {
          start_time: "2026-05-14T01:00:00.000Z",
          type: "manual_run",
          date: "2026-05-13",
        },
      ],
      [],
      [],
      new Date(2026, 4, 14)
    );

    expect(activeDays.get("2026-05-13")).toBe(1);
    expect(activeDays.has("2026-05-14")).toBe(false);
  });
});
