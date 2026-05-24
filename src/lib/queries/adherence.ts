import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { buildPlannedSlots, localDateStr, startOfWeek, WORKOUT_REST_DAY_TYPE, type PlannedSlot } from "@/lib/planner";
import { deriveAdherence, type AdherenceWeek } from "@/lib/adherence";
import { getUserTimeZone } from "@/lib/queries/profile";
import { addDateKeyDays, dateKeyToLocalDate, startOfWeekDateKey, zonedDateKey, zonedDateTimeToUtc } from "@/lib/time-zone";
import { getStatsRangeBounds, type TimeRange } from "@/lib/stats-ranges";
import type { Activity, DayType, PlannedSlotSnapshot, ScheduleOverride, WeeklyScheduleRow } from "@/types";

function getRangeStart(range: TimeRange, timeZone: string): Date | null {
  const startDateKey = getStatsRangeBounds(range, timeZone).startDateKey;
  return startDateKey ? dateKeyToLocalDate(startDateKey) : null;
}

function startOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function accountCreatedStart(createdAt: string | undefined, timeZone: string): Date | null {
  if (!createdAt) return null;
  const created = new Date(createdAt);
  if (Number.isNaN(created.getTime())) return null;
  return startOfDay(dateKeyToLocalDate(zonedDateKey(created, timeZone)));
}

function getVisibleStart(range: TimeRange, userCreatedAt: string | undefined, timeZone: string): Date {
  const rangeStart = getRangeStart(range, timeZone);
  const createdStart = accountCreatedStart(userCreatedAt, timeZone);
  if (rangeStart && createdStart) return createdStart > rangeStart ? createdStart : rangeStart;
  if (rangeStart) return rangeStart;
  if (createdStart) return createdStart;
  return dateKeyToLocalDate(getStatsRangeBounds(range, timeZone).endDateKey);
}

function weekStartsBetween(start: Date, end: Date): Date[] {
  const weeks: Date[] = [];
  const cursor = startOfWeek(start);
  const final = startOfWeek(end);
  while (cursor <= final) {
    weeks.push(new Date(cursor));
    cursor.setDate(cursor.getDate() + 7);
  }
  return weeks;
}

function firstRelation<T>(value: T | T[] | null | undefined): T | undefined {
  if (Array.isArray(value)) return value[0];
  return value ?? undefined;
}

function normalizeScheduleRows(rows: unknown): WeeklyScheduleRow[] {
  if (!Array.isArray(rows)) return [];
  return rows.map((row) => {
    const raw = row as WeeklyScheduleRow & {
      day_type?: DayType | DayType[] | null;
      cardio_day_type?: DayType | DayType[] | null;
    };
    return {
      ...raw,
      day_type: firstRelation(raw.day_type),
      cardio_day_type: firstRelation(raw.cardio_day_type),
    };
  });
}

const getBasePlannerData = cache(async function getBasePlannerData() {
  const supabase = await createClient();
  const [scheduleRes, dayTypesRes] = await Promise.all([
    supabase
      .from("weekly_schedule")
      .select("*, day_type:day_types!weekly_schedule_day_type_id_fkey(*), cardio_day_type:day_types!weekly_schedule_cardio_day_type_id_fkey(*)")
      .eq("active", true),
    supabase.from("day_types").select("*"),
  ]);

  if (scheduleRes.error) console.error("[query] adherence schedule failed", scheduleRes.error.message);
  if (dayTypesRes.error) console.error("[query] adherence day types failed", dayTypesRes.error.message);

  const dayTypes = (dayTypesRes.data ?? []) as DayType[];
  return {
    schedule: normalizeScheduleRows(scheduleRes.data),
    dayTypeMap: new Map(dayTypes.map((dayType) => [dayType.id, dayType])),
  };
});

function snapshotToPlannedSlot(snapshot: PlannedSlotSnapshot, dayTypeMap: Map<string, DayType>): PlannedSlot | null {
  const planned =
    snapshot.planned_day_type_id
      ? dayTypeMap.get(snapshot.planned_day_type_id)
      : snapshot.slot === "workout"
      ? WORKOUT_REST_DAY_TYPE
      : null;
  if (!planned) return null;

  const effective =
    snapshot.is_skipped
      ? null
      : snapshot.effective_day_type_id
      ? dayTypeMap.get(snapshot.effective_day_type_id) ?? null
      : snapshot.slot === "workout" && planned.id === WORKOUT_REST_DAY_TYPE.id
      ? WORKOUT_REST_DAY_TYPE
      : null;

  return {
    id: `${snapshot.slot}:${snapshot.id}`,
    scheduleId: snapshot.id,
    dayOfWeek: snapshot.day_of_week,
    date: snapshot.date,
    kind: snapshot.slot,
    planned,
    effective,
    isOverridden: snapshot.is_overridden,
  };
}

function plannedSlotToSnapshotInsert(slot: PlannedSlot, userId: string, weekStart: string) {
  return {
    user_id: userId,
    week_start: weekStart,
    date: slot.date,
    day_of_week: slot.dayOfWeek,
    slot: slot.kind,
    planned_day_type_id: slot.planned.id === WORKOUT_REST_DAY_TYPE.id ? null : slot.planned.id,
    effective_day_type_id: slot.effective && slot.effective.id !== WORKOUT_REST_DAY_TYPE.id ? slot.effective.id : null,
    is_overridden: slot.isOverridden,
    is_skipped: slot.effective === null,
  };
}

async function ensurePlannedSlotSnapshots(range: TimeRange, timeZone: string): Promise<{
  snapshots: PlannedSlotSnapshot[];
  dayTypeMap: Map<string, DayType>;
  visibleStart: Date;
  weekStarts: Date[];
}> {
  const supabase = await createClient();
  const [{ data: { user } }, { schedule, dayTypeMap }] = await Promise.all([
    supabase.auth.getUser(),
    getBasePlannerData(),
  ]);
  if (!user) {
    return {
      snapshots: [],
      dayTypeMap: new Map(),
      visibleStart: getVisibleStart(range, undefined, timeZone),
      weekStarts: [],
    };
  }

  const now = new Date();
  const todayKey = zonedDateKey(now, timeZone);
  const visibleStart = getVisibleStart(range, user.created_at, timeZone);
  const start = dateKeyToLocalDate(startOfWeekDateKey(localDateStr(visibleStart)));
  const end = dateKeyToLocalDate(startOfWeekDateKey(todayKey));
  end.setDate(end.getDate() + 6);
  const weekStarts = weekStartsBetween(start, end);
  const weekStartStrings = weekStarts.map(localDateStr);
  const visibleStartStr = localDateStr(visibleStart);

  const { data: existing, error: existingError } = await supabase
    .from("planned_slots")
    .select("*")
    .gte("week_start", localDateStr(start))
    .lte("week_start", localDateStr(end));

  if (existingError) console.error("[query] planned slot snapshots failed", existingError.message);

  const existingSnapshots = (existing ?? []) as PlannedSlotSnapshot[];
  const currentWeekStart = startOfWeekDateKey(todayKey);
  const existingWeeks = new Set(existingSnapshots.map((row) => row.week_start));
  const weeksToBackfill = weekStarts.filter((weekStart) => {
    const weekStartStr = localDateStr(weekStart);
    return weekStartStr >= currentWeekStart || !existingWeeks.has(weekStartStr);
  });

  if (weeksToBackfill.length > 0 && schedule.length > 0) {
    const firstBackfill = weeksToBackfill[0];
    const lastBackfill = new Date(weeksToBackfill[weeksToBackfill.length - 1]);
    lastBackfill.setDate(lastBackfill.getDate() + 6);

    const { data: overrides, error: overridesError } = await supabase
      .from("schedule_overrides")
      .select("*")
      .gte("date", localDateStr(firstBackfill))
      .lte("date", localDateStr(lastBackfill));

    if (overridesError) console.error("[query] planned slot override fetch failed", overridesError.message);

    const allOverrides = (overrides ?? []) as ScheduleOverride[];
    const inserts = weeksToBackfill.flatMap((weekStart) => {
      const weekStartStr = localDateStr(weekStart);
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekEnd.getDate() + 6);
      const weekEndStr = localDateStr(weekEnd);
      return buildPlannedSlots(
        schedule,
        allOverrides.filter((override) => override.date >= weekStartStr && override.date <= weekEndStr),
        weekStart,
        dayTypeMap
      )
        .flatMap((slot) => slot.date >= visibleStartStr ? [plannedSlotToSnapshotInsert(slot, user.id, weekStartStr)] : []);
    });

    if (inserts.length > 0) {
      const { error: insertError } = await supabase
        .from("planned_slots")
        .upsert(inserts, { onConflict: "user_id,date,slot", ignoreDuplicates: true });
      if (insertError) console.error("[query] planned slot snapshot insert failed", insertError.message);
    }
  }

  const { data: refreshed, error: refreshedError } = await supabase
    .from("planned_slots")
    .select("*")
    .in("week_start", weekStartStrings);

  if (refreshedError) console.error("[query] planned slot snapshot refresh failed", refreshedError.message);

  return {
    snapshots: ((refreshed ?? existingSnapshots) as PlannedSlotSnapshot[]).filter(
      (snapshot) => snapshot.date >= visibleStartStr
    ),
    dayTypeMap,
    visibleStart,
    weekStarts,
  };
}

export async function getAdherenceHistory(range: TimeRange): Promise<AdherenceWeek[]> {
  const [supabase, timeZone] = await Promise.all([createClient(), getUserTimeZone()]);
  const now = new Date();
  const todayKey = zonedDateKey(now, timeZone);
  const end = dateKeyToLocalDate(startOfWeekDateKey(todayKey));
  end.setDate(end.getDate() + 6);
  const { snapshots, dayTypeMap, visibleStart, weekStarts } = await ensurePlannedSlotSnapshots(range, timeZone);
  const visibleStartStr = localDateStr(visibleStart);
  const endExclusiveKey = addDateKeyDays(localDateStr(end), 1);

  if (weekStarts.length === 0) return [];

  const activitiesRes = await supabase
    .from("activities")
    .select("id, user_id, strava_activity_id, type, day_type_id, start_time, duration, source, distance, avg_heartrate, max_heartrate, suffer_score, calories, elevation_gain, avg_pace, tags, notes, name, summary_polyline, splits, best_efforts, avg_cadence, avg_watts, elapsed_time, max_speed, average_temp")
    .gte("start_time", zonedDateTimeToUtc(visibleStartStr, timeZone).toISOString())
    .lt("start_time", zonedDateTimeToUtc(endExclusiveKey, timeZone).toISOString());

  if (activitiesRes.error) console.error("[query] adherence activities failed", activitiesRes.error.message);

  const activities = (activitiesRes.data ?? []) as unknown as Activity[];

  return weekStarts.map((weekStart) => {
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekEnd.getDate() + 6);
    const weekStartStr = localDateStr(weekStart);
    const weekEndStr = localDateStr(weekEnd);
    const slots = snapshots
      .filter((snapshot) => snapshot.week_start === weekStartStr)
      .sort((a, b) => a.day_of_week - b.day_of_week || a.slot.localeCompare(b.slot))
      .flatMap((snapshot) => {
        const slot = snapshotToPlannedSlot(snapshot, dayTypeMap);
        return slot ? [slot] : [];
      });
    const weekActivities = activities.filter((activity) => {
      const date = zonedDateKey(activity.start_time, timeZone);
      return date >= visibleStartStr && date >= weekStartStr && date <= weekEndStr;
    });
    return { ...deriveAdherence(slots, weekActivities, now, timeZone), weekStart: weekStartStr };
  });
}

export async function getCurrentWeekAdherence(): Promise<AdherenceWeek> {
  const [history, timeZone] = await Promise.all([getAdherenceHistory("week"), getUserTimeZone()]);
  return history[history.length - 1] ?? {
    weekStart: startOfWeekDateKey(zonedDateKey(new Date(), timeZone)),
    slots: [],
    summary: { planned: 0, completed: 0, swapped: 0, missed: 0, skipped: 0, pending: 0, completionRate: null },
  };
}
