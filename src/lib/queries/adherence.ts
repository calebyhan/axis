import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { buildPlannedSlots, localDateStr, startOfWeek, WORKOUT_REST_DAY_TYPE, type PlannedSlot } from "@/lib/planner";
import { deriveAdherence, type AdherenceWeek } from "@/lib/adherence";
import type { Activity, DayType, PlannedSlotSnapshot, ScheduleOverride, WeeklyScheduleRow } from "@/types";
import type { TimeRange } from "@/lib/queries/stats";

function getRangeStart(range: TimeRange): Date {
  const now = new Date();
  if (range === "week") return startOfWeek(now);
  if (range === "month") {
    const d = new Date(now);
    d.setDate(d.getDate() - 28);
    return startOfWeek(d);
  }
  if (range === "year") {
    const d = new Date(now);
    d.setFullYear(d.getFullYear() - 1);
    return startOfWeek(d);
  }
  const d = new Date(now);
  d.setFullYear(d.getFullYear() - 2);
  return startOfWeek(d);
}

function startOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function accountCreatedStart(createdAt: string | undefined): Date | null {
  if (!createdAt) return null;
  const created = new Date(createdAt);
  if (Number.isNaN(created.getTime())) return null;
  return startOfDay(created);
}

function getVisibleStart(range: TimeRange, userCreatedAt: string | undefined): Date {
  const rangeStart = getRangeStart(range);
  const createdStart = accountCreatedStart(userCreatedAt);
  return createdStart && createdStart > rangeStart ? createdStart : rangeStart;
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

async function ensurePlannedSlotSnapshots(range: TimeRange): Promise<{
  snapshots: PlannedSlotSnapshot[];
  dayTypeMap: Map<string, DayType>;
  visibleStart: Date;
  weekStarts: Date[];
}> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { snapshots: [], dayTypeMap: new Map(), visibleStart: getRangeStart(range), weekStarts: [] };

  const now = new Date();
  const visibleStart = getVisibleStart(range, user.created_at);
  const start = startOfWeek(visibleStart);
  const end = new Date(startOfWeek(now));
  end.setDate(end.getDate() + 6);
  const weekStarts = weekStartsBetween(start, now);
  const weekStartStrings = weekStarts.map(localDateStr);
  const visibleStartStr = localDateStr(visibleStart);
  const { schedule, dayTypeMap } = await getBasePlannerData();

  const { data: existing, error: existingError } = await supabase
    .from("planned_slots")
    .select("*")
    .gte("week_start", localDateStr(start))
    .lte("week_start", localDateStr(end));

  if (existingError) console.error("[query] planned slot snapshots failed", existingError.message);

  const existingSnapshots = (existing ?? []) as PlannedSlotSnapshot[];
  const currentWeekStart = localDateStr(startOfWeek(now));
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
        .filter((slot) => slot.date >= visibleStartStr)
        .map((slot) => plannedSlotToSnapshotInsert(slot, user.id, weekStartStr));
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
  const supabase = await createClient();
  const now = new Date();
  const end = new Date(startOfWeek(now));
  end.setDate(end.getDate() + 6);
  const { snapshots, dayTypeMap, visibleStart, weekStarts } = await ensurePlannedSlotSnapshots(range);
  const visibleStartStr = localDateStr(visibleStart);

  if (weekStarts.length === 0) return [];

  const activitiesRes = await supabase
    .from("activities")
    .select("id, user_id, strava_activity_id, type, day_type_id, start_time, duration, source, distance, avg_heartrate, max_heartrate, suffer_score, calories, elevation_gain, avg_pace, tags, notes, name, summary_polyline, splits, best_efforts, avg_cadence, avg_watts, elapsed_time, max_speed, average_temp")
    .gte("start_time", visibleStart.toISOString())
    .lt("start_time", new Date(end.getTime() + 24 * 60 * 60 * 1000).toISOString());

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
      const date = activity.start_time.split("T")[0];
      return date >= visibleStartStr && date >= weekStartStr && date <= weekEndStr;
    });
    return { ...deriveAdherence(slots, weekActivities, now), weekStart: weekStartStr };
  });
}

export async function getCurrentWeekAdherence(): Promise<AdherenceWeek> {
  const history = await getAdherenceHistory("week");
  return history[history.length - 1] ?? {
    weekStart: localDateStr(startOfWeek()),
    slots: [],
    summary: { planned: 0, completed: 0, swapped: 0, missed: 0, skipped: 0, pending: 0, completionRate: null },
  };
}
