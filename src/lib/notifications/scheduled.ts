import { createAdminClient } from "@/lib/supabase/server";
import { activityMatchesPlannedType } from "@/lib/adherence";
import { sendNotificationToUser, type AxisNotification } from "@/lib/notifications/send";
import { WORKOUT_REST_DAY_TYPE } from "@/lib/planner";
import type { Activity, DayType, NotificationPreferences, Units } from "@/types";

type ScheduledSlot = {
  kind: "workout" | "cardio";
  effective: DayType;
};

type MinimalActivity = Pick<Activity, "id" | "type" | "day_type_id" | "start_time" | "distance">;

type ZonedParts = {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  weekday: number;
  date: string;
};

const WEEKDAY_TO_NUMBER: Record<string, number> = {
  Sun: 0,
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6,
};

function safeTimeZone(timezone: string | null | undefined): string {
  const fallback = "UTC";
  if (!timezone) return fallback;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: timezone }).format(new Date());
    return timezone;
  } catch {
    return fallback;
  }
}

function zonedParts(date: Date, timeZone: string): ZonedParts {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    weekday: "short",
    hourCycle: "h23",
  }).formatToParts(date);

  const byType = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  const year = Number(byType.year);
  const month = Number(byType.month);
  const day = Number(byType.day);
  const weekday = WEEKDAY_TO_NUMBER[byType.weekday ?? ""] ?? 0;

  return {
    year,
    month,
    day,
    hour: Number(byType.hour),
    minute: Number(byType.minute),
    weekday,
    date: `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`,
  };
}

function parseTimeToMinutes(value: string): number {
  const [hours, minutes] = value.split(":").map(Number);
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return 0;
  return hours * 60 + minutes;
}

function addDays(date: string, days: number): string {
  const [year, month, day] = date.split("-").map(Number);
  const d = new Date(Date.UTC(year, month - 1, day + days, 12));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
}

function datesBetween(startDate: string, endDate: string): string[] {
  const dates: string[] = [];
  let cursor = startDate;
  while (cursor <= endDate) {
    dates.push(cursor);
    cursor = addDays(cursor, 1);
  }
  return dates;
}

function jsDayToISO(day: number): number {
  return (day + 6) % 7;
}

function isoDayFromDateString(date: string): number {
  const [year, month, day] = date.split("-").map(Number);
  return jsDayToISO(new Date(Date.UTC(year, month - 1, day, 12)).getUTCDay());
}

function getTimeZoneOffsetMs(date: Date, timeZone: string): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const byType = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  const asUTC = Date.UTC(
    Number(byType.year),
    Number(byType.month) - 1,
    Number(byType.day),
    Number(byType.hour),
    Number(byType.minute),
    Number(byType.second)
  );
  return asUTC - date.getTime();
}

function zonedDateTimeToUtc(date: string, timeZone: string): Date {
  const [year, month, day] = date.split("-").map(Number);
  const utcGuess = new Date(Date.UTC(year, month - 1, day, 0, 0, 0));
  const offset = getTimeZoneOffsetMs(utcGuess, timeZone);
  const firstPass = new Date(utcGuess.getTime() - offset);
  const correctedOffset = getTimeZoneOffsetMs(firstPass, timeZone);
  return new Date(utcGuess.getTime() - correctedOffset);
}

function localDateRangeUtc(date: string, timeZone: string): { start: Date; end: Date } {
  return {
    start: zonedDateTimeToUtc(date, timeZone),
    end: zonedDateTimeToUtc(addDays(date, 1), timeZone),
  };
}

function isRest(dayType: DayType | null): boolean {
  return !dayType || dayType.name.toLowerCase() === "rest";
}

function firstRelation<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

function resolveOverride(
  date: string,
  slot: "workout" | "cardio",
  fallback: DayType,
  overrides: { date: string; slot: "workout" | "cardio"; day_type_id: string | null }[],
  dayTypeMap: Map<string, DayType>
): DayType | null {
  const override = overrides.find((item) => item.date === date && item.slot === slot);
  if (!override) return fallback;
  return override.day_type_id ? (dayTypeMap.get(override.day_type_id) ?? null) : null;
}

async function getSlotsForDate(userId: string, date: string): Promise<ScheduledSlot[]> {
  const supabase = createAdminClient();
  const isoDay = isoDayFromDateString(date);
  const [scheduleRes, overridesRes, dayTypesRes] = await Promise.all([
    supabase
      .from("weekly_schedule")
      .select(
        "id, day_of_week, day_type_id, cardio_day_type_id, active, day_type:day_types!weekly_schedule_day_type_id_fkey(*), cardio_day_type:day_types!weekly_schedule_cardio_day_type_id_fkey(*)"
      )
      .eq("user_id", userId)
      .eq("day_of_week", isoDay)
      .eq("active", true),
    supabase
      .from("schedule_overrides")
      .select("date, slot, day_type_id")
      .eq("user_id", userId)
      .eq("date", date),
    supabase.from("day_types").select("*"),
  ]);

  if (scheduleRes.error) console.error("[notifications] schedule lookup failed", scheduleRes.error.message);
  if (overridesRes.error) console.error("[notifications] override lookup failed", overridesRes.error.message);
  if (dayTypesRes.error) console.error("[notifications] day type lookup failed", dayTypesRes.error.message);

  const dayTypes = (dayTypesRes.data ?? []) as DayType[];
  const dayTypeMap = new Map(dayTypes.map((dayType) => [dayType.id, dayType]));
  const overrides = (overridesRes.data ?? []) as { date: string; slot: "workout" | "cardio"; day_type_id: string | null }[];
  const slots: ScheduledSlot[] = [];

  for (const row of scheduleRes.data ?? []) {
    const raw = row as {
      day_type?: DayType | DayType[] | null;
      cardio_day_type?: DayType | DayType[] | null;
    };
    const plannedWorkout = firstRelation(raw.day_type) ?? WORKOUT_REST_DAY_TYPE;
    const effectiveWorkout = resolveOverride(date, "workout", plannedWorkout, overrides, dayTypeMap);
    if (effectiveWorkout && !isRest(effectiveWorkout)) {
      slots.push({ kind: "workout", effective: effectiveWorkout });
    }

    const plannedCardio = firstRelation(raw.cardio_day_type);
    if (plannedCardio) {
      const effectiveCardio = resolveOverride(date, "cardio", plannedCardio, overrides, dayTypeMap);
      if (effectiveCardio && !isRest(effectiveCardio)) {
        slots.push({ kind: "cardio", effective: effectiveCardio });
      }
    }
  }

  return slots;
}

async function getActivitiesForLocalRange(
  userId: string,
  startDate: string,
  endDate: string,
  timeZone: string
): Promise<MinimalActivity[]> {
  const supabase = createAdminClient();
  const start = localDateRangeUtc(startDate, timeZone).start;
  const end = localDateRangeUtc(endDate, timeZone).end;

  const { data, error } = await supabase
    .from("activities")
    .select("id, type, day_type_id, start_time, distance")
    .eq("user_id", userId)
    .gte("start_time", start.toISOString())
    .lt("start_time", end.toISOString());

  if (error) {
    console.error("[notifications] activity lookup failed", error.message);
    return [];
  }

  return (data ?? []) as MinimalActivity[];
}

function unmatchedSlots(slots: ScheduledSlot[], activities: MinimalActivity[]): ScheduledSlot[] {
  const availableById = new Map<string, Set<number>>();
  const availableByCategory = new Map<string, Set<number>>();
  slots.forEach((slot, index) => {
    if (slot.effective.name === "Rest") return;
    const idSet = availableById.get(slot.effective.id) ?? new Set<number>();
    idSet.add(index);
    availableById.set(slot.effective.id, idSet);
    const catSet = availableByCategory.get(slot.effective.category) ?? new Set<number>();
    catSet.add(index);
    availableByCategory.set(slot.effective.category, catSet);
  });

  const matchedSlotIndexes = new Set<number>();
  const sortedActivities = activities.toSorted(
    (a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime()
  );

  for (const activity of sortedActivities) {
    const available = activity.day_type_id
      ? availableById.get(activity.day_type_id)
      : availableByCategory.get(activity.type === "run" || activity.type === "manual_run" ? "run" : "strength");
    if (!available?.size) continue;
    const matchIdx = available.values().next().value as number;
    available.delete(matchIdx);
    matchedSlotIndexes.add(matchIdx);
  }

  return slots.filter((_, index) => !matchedSlotIndexes.has(index));
}

function formatSlotList(slots: ScheduledSlot[]): string {
  return [...new Set(slots.map((slot) => slot.effective.name))].join(" + ");
}

async function buildTodayPlanNotification(
  userId: string,
  localDate: string,
  timeZone: string
): Promise<AxisNotification | null> {
  const slots = await getSlotsForDate(userId, localDate);
  if (slots.length === 0) return null;

  const activities = await getActivitiesForLocalRange(userId, localDate, localDate, timeZone);
  const pendingSlots = unmatchedSlots(slots, activities);
  if (pendingSlots.length === 0) return null;

  return {
    kind: "today_plan",
    dedupeKey: localDate,
    title: "Today's plan",
    body: `Planned: ${formatSlotList(pendingSlots)}.`,
    url: "/log",
  };
}

async function buildPlanNudgeNotification(
  userId: string,
  localDate: string,
  timeZone: string
): Promise<AxisNotification | null> {
  const slots = await getSlotsForDate(userId, localDate);
  if (slots.length === 0) return null;

  const activities = await getActivitiesForLocalRange(userId, localDate, localDate, timeZone);
  const pendingSlots = unmatchedSlots(slots, activities);
  if (pendingSlots.length === 0) return null;

  return {
    kind: "plan_nudge",
    dedupeKey: localDate,
    title: "Still on the plan",
    body: `${formatSlotList(pendingSlots)} ${pendingSlots.length === 1 ? "is" : "are"} still pending today. Log it, move it, or skip it.`,
    url: "/dashboard",
  };
}

function activityLocalDate(activity: MinimalActivity, timeZone: string): string {
  return zonedParts(new Date(activity.start_time), timeZone).date;
}

function formatDistanceKm(km: number, units: Units): string {
  if (units === "imperial") {
    const miles = km * 0.621371;
    return `${Math.round(miles * 10) / 10} mi`;
  }
  return `${Math.round(km * 10) / 10} km`;
}

async function getUserUnits(userId: string): Promise<Units> {
  const supabase = createAdminClient();
  const { data } = await supabase.from("profiles").select("units").eq("id", userId).maybeSingle();
  return ((data?.units ?? "imperial") as Units);
}

async function buildWeeklyReviewNotification(
  userId: string,
  localDate: string,
  timeZone: string
): Promise<AxisNotification | null> {
  const endDate = addDays(localDate, -1);
  const startDate = addDays(endDate, -6);
  const dates = datesBetween(startDate, endDate);
  const [activities, units] = await Promise.all([
    getActivitiesForLocalRange(userId, startDate, endDate, timeZone),
    getUserUnits(userId),
  ]);

  let planned = 0;
  let done = 0;

  const slotsPerDate = await Promise.all(dates.map((date) => getSlotsForDate(userId, date)));
  for (const [i, date] of dates.entries()) {
    const slots = slotsPerDate[i];
    const dateActivities = activities.filter((activity) => activityLocalDate(activity, timeZone) === date);
    planned += slots.length;
    done += slots.length - unmatchedSlots(slots, dateActivities).length;
  }

  const workouts = activities.filter((activity) => activity.type === "workout").length;
  const runs = activities.filter((activity) => activity.type === "run" || activity.type === "manual_run").length;
  const distanceKm = activities
    .filter((activity) => activity.type === "run" || activity.type === "manual_run")
    .reduce((total, activity) => total + ((activity.distance ?? 0) / 1000), 0);

  if (planned === 0 && workouts === 0 && runs === 0) return null;

  const parts = [];
  if (planned > 0) parts.push(`${done}/${planned} planned sessions`);
  if (workouts > 0) parts.push(`${workouts} workout${workouts === 1 ? "" : "s"}`);
  if (runs > 0) parts.push(`${formatDistanceKm(distanceKm, units)} run`);

  return {
    kind: "weekly_review",
    dedupeKey: `${startDate}:${endDate}`,
    title: "Weekly review",
    body: parts.join(" · "),
    url: "/stats?range=week",
  };
}

export async function runScheduledNotifications(now = new Date()) {
  const supabase = createAdminClient();
  const { data: preferences, error } = await supabase
    .from("notification_preferences")
    .select("*")
    .eq("enabled", true);

  if (error) {
    console.error("[notifications] Scheduled preference lookup failed", error.message);
    return { checked: 0, sent: 0, skipped: 0 };
  }

  let sent = 0;
  let skipped = 0;
  const results: Array<{ kind: AxisNotification["kind"]; sent: number; skipped: string | null }> = [];

  for (const preference of (preferences ?? []) as NotificationPreferences[]) {
    const timeZone = safeTimeZone(preference.timezone);
    const local = zonedParts(now, timeZone);
    const minutesNow = local.hour * 60 + local.minute;
    const dueNotifications: AxisNotification[] = [];

    if (
      preference.today_plan_enabled &&
      minutesNow >= parseTimeToMinutes(preference.today_plan_time)
    ) {
      const notification = await buildTodayPlanNotification(preference.user_id, local.date, timeZone);
      if (notification) dueNotifications.push(notification);
    }

    if (
      preference.plan_nudge_enabled &&
      minutesNow >= parseTimeToMinutes(preference.plan_nudge_time)
    ) {
      const notification = await buildPlanNudgeNotification(preference.user_id, local.date, timeZone);
      if (notification) dueNotifications.push(notification);
    }

    if (
      preference.weekly_review_enabled &&
      local.weekday === preference.weekly_review_day &&
      minutesNow >= parseTimeToMinutes(preference.weekly_review_time)
    ) {
      const notification = await buildWeeklyReviewNotification(preference.user_id, local.date, timeZone);
      if (notification) dueNotifications.push(notification);
    }

    const notifResults = await Promise.all(dueNotifications.map((n) => sendNotificationToUser(preference.user_id, n)));
    for (const [i, result] of notifResults.entries()) {
      sent += result.sent;
      if (result.sent === 0) skipped += 1;
      results.push({ kind: dueNotifications[i].kind, sent: result.sent, skipped: result.skipped });
    }
  }

  return { checked: preferences?.length ?? 0, sent, skipped, results };
}
