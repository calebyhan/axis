export const PORTABLE_SCHEMA_VERSION = 2;

export const PORTABLE_TABLES = [
  "profile",
  "notification_preferences",
  "day_types",
  "weekly_schedule",
  "schedule_overrides",
  "planned_slots",
  "activities",
  "session_sets",
  "daily_checkins",
] as const;

export type PortableTable = (typeof PORTABLE_TABLES)[number];
export type PortableFormat = "json" | "csv";
export type PortableRow = Record<string, unknown>;

export interface PortableData {
  schema_version: number;
  exported_at: string;
  profile: PortableRow | null;
  notification_preferences: PortableRow | null;
  day_types: PortableRow[];
  weekly_schedule: PortableRow[];
  schedule_overrides: PortableRow[];
  planned_slots: PortableRow[];
  activities: PortableRow[];
  session_sets: PortableRow[];
  daily_checkins: PortableRow[];
}

export interface PreparedPortableImport {
  profile: PortableRow | null;
  notification_preferences: PortableRow | null;
  day_types: PortableRow[];
  weekly_schedule: PortableRow[];
  schedule_overrides: PortableRow[];
  planned_slots: PortableRow[];
  activities: PortableRow[];
  session_sets: PortableRow[];
  daily_checkins: PortableRow[];
}

const PROFILE_COLUMNS = [
  "id",
  "units",
  "accent_color",
  "display_name",
  "onboarding_completed_at",
  "created_at",
] as const;

const NOTIFICATION_PREFERENCES_COLUMNS = [
  "user_id",
  "enabled",
  "today_plan_enabled",
  "today_plan_time",
  "pending_strava_enabled",
  "plan_nudge_enabled",
  "plan_nudge_time",
  "weekly_review_enabled",
  "weekly_review_day",
  "weekly_review_time",
  "timezone",
  "created_at",
  "updated_at",
] as const;

const DAY_TYPE_COLUMNS = [
  "id",
  "name",
  "category",
  "muscle_focus",
] as const;

const WEEKLY_SCHEDULE_COLUMNS = [
  "id",
  "user_id",
  "day_of_week",
  "day_type_id",
  "cardio_day_type_id",
  "active",
] as const;

const SCHEDULE_OVERRIDE_COLUMNS = [
  "id",
  "user_id",
  "date",
  "slot",
  "day_type_id",
  "created_at",
] as const;

const PLANNED_SLOT_COLUMNS = [
  "id",
  "user_id",
  "week_start",
  "date",
  "day_of_week",
  "slot",
  "planned_day_type_id",
  "effective_day_type_id",
  "is_overridden",
  "is_skipped",
  "created_at",
  "updated_at",
] as const;

const ACTIVITY_COLUMNS = [
  "id",
  "user_id",
  "strava_activity_id",
  "type",
  "day_type_id",
  "start_time",
  "duration",
  "source",
  "distance",
  "avg_heartrate",
  "max_heartrate",
  "suffer_score",
  "calories",
  "elevation_gain",
  "avg_pace",
  "tags",
  "notes",
  "created_at",
  "name",
  "summary_polyline",
  "splits",
  "best_efforts",
  "avg_cadence",
  "avg_watts",
  "elapsed_time",
  "max_speed",
  "average_temp",
] as const;

const SESSION_SET_COLUMNS = [
  "id",
  "activity_id",
  "exercise_id",
  "set_number",
  "reps",
  "weight",
  "rpe",
  "created_at",
] as const;

const DAILY_CHECKIN_COLUMNS = [
  "id",
  "user_id",
  "date",
  "body_weight",
  "notes",
  "created_at",
] as const;

const EXPORT_COLUMNS: Record<PortableTable, readonly string[]> = {
  profile: PROFILE_COLUMNS,
  notification_preferences: NOTIFICATION_PREFERENCES_COLUMNS,
  day_types: DAY_TYPE_COLUMNS,
  weekly_schedule: WEEKLY_SCHEDULE_COLUMNS,
  schedule_overrides: SCHEDULE_OVERRIDE_COLUMNS,
  planned_slots: PLANNED_SLOT_COLUMNS,
  activities: ACTIVITY_COLUMNS,
  session_sets: SESSION_SET_COLUMNS,
  daily_checkins: DAILY_CHECKIN_COLUMNS,
};

const IMPORT_COLUMNS: Record<PortableTable, readonly string[]> = {
  ...EXPORT_COLUMNS,
  profile: PROFILE_COLUMNS.filter((column) => column !== "created_at"),
  weekly_schedule: WEEKLY_SCHEDULE_COLUMNS.filter((column) => column !== "id"),
  schedule_overrides: SCHEDULE_OVERRIDE_COLUMNS.filter((column) => column !== "id"),
  planned_slots: PLANNED_SLOT_COLUMNS.filter((column) => column !== "id"),
  session_sets: SESSION_SET_COLUMNS.filter((column) => column !== "id"),
  daily_checkins: DAILY_CHECKIN_COLUMNS.filter((column) => column !== "id"),
};

const CSV_COLUMNS = [
  "table",
  "schema_version",
  "exported_at",
  ...Array.from(new Set(PORTABLE_TABLES.flatMap((table) => EXPORT_COLUMNS[table]))),
];

function isRecord(value: unknown): value is PortableRow {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function rowsFrom(value: PortableRow, key: string, legacyKey?: string): PortableRow[] {
  const rows = value[key] ?? (legacyKey ? value[legacyKey] : undefined);
  return Array.isArray(rows) ? rows.filter(isRecord) : [];
}

function rowFrom(value: PortableRow, key: string): PortableRow | null {
  const row = value[key];
  if (isRecord(row)) return row;
  if (Array.isArray(row) && isRecord(row[0])) return row[0];
  return null;
}

function pickRow(row: PortableRow | null, columns: readonly string[]): PortableRow | null {
  if (!row) return null;
  const picked: PortableRow = {};
  for (const column of columns) {
    if (Object.prototype.hasOwnProperty.call(row, column)) {
      picked[column] = row[column];
    }
  }
  return Object.keys(picked).length > 0 ? picked : null;
}

function pickRows(rows: PortableRow[], columns: readonly string[]): PortableRow[] {
  return rows.map((row) => pickRow(row, columns)).filter(isRecord);
}

function withUserId(rows: PortableRow[], userId: string): PortableRow[] {
  return rows.map((row) => ({ ...row, user_id: userId }));
}

function escapeCsvCell(value: string): string {
  if (!/[",\r\n]/.test(value)) return value;
  return `"${value.replace(/"/g, '""')}"`;
}

function encodeCsvValue(value: unknown): string {
  if (value === undefined) return "";
  return JSON.stringify(value);
}

function decodeCsvValue(value: string): unknown {
  if (value === "") return undefined;
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
}

function parseCsvRows(csv: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let inQuotes = false;

  for (let i = 0; i < csv.length; i += 1) {
    const char = csv[i];
    const next = csv[i + 1];

    if (inQuotes) {
      if (char === '"' && next === '"') {
        cell += '"';
        i += 1;
      } else if (char === '"') {
        inQuotes = false;
      } else {
        cell += char;
      }
      continue;
    }

    if (char === '"') {
      inQuotes = true;
    } else if (char === ",") {
      row.push(cell);
      cell = "";
    } else if (char === "\n") {
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
    } else if (char !== "\r") {
      cell += char;
    }
  }

  if (cell || row.length > 0) {
    row.push(cell);
    rows.push(row);
  }

  return rows;
}

export function createPortableData(input: {
  profile?: PortableRow | null;
  notification_preferences?: PortableRow | null;
  day_types?: PortableRow[] | null;
  weekly_schedule?: PortableRow[] | null;
  schedule_overrides?: PortableRow[] | null;
  planned_slots?: PortableRow[] | null;
  activities?: PortableRow[] | null;
  session_sets?: PortableRow[] | null;
  daily_checkins?: PortableRow[] | null;
}): PortableData {
  return {
    schema_version: PORTABLE_SCHEMA_VERSION,
    exported_at: new Date().toISOString(),
    profile: pickRow(input.profile ?? null, EXPORT_COLUMNS.profile),
    notification_preferences: pickRow(input.notification_preferences ?? null, EXPORT_COLUMNS.notification_preferences),
    day_types: pickRows(input.day_types ?? [], EXPORT_COLUMNS.day_types),
    weekly_schedule: pickRows(input.weekly_schedule ?? [], EXPORT_COLUMNS.weekly_schedule),
    schedule_overrides: pickRows(input.schedule_overrides ?? [], EXPORT_COLUMNS.schedule_overrides),
    planned_slots: pickRows(input.planned_slots ?? [], EXPORT_COLUMNS.planned_slots),
    activities: pickRows(input.activities ?? [], EXPORT_COLUMNS.activities),
    session_sets: pickRows(input.session_sets ?? [], EXPORT_COLUMNS.session_sets),
    daily_checkins: pickRows(input.daily_checkins ?? [], EXPORT_COLUMNS.daily_checkins),
  };
}

export function coercePortableData(value: unknown): PortableData {
  const source = isRecord(value) ? value : {};
  return {
    schema_version: typeof source.schema_version === "number" ? source.schema_version : 1,
    exported_at: typeof source.exported_at === "string" ? source.exported_at : new Date().toISOString(),
    profile: pickRow(rowFrom(source, "profile"), EXPORT_COLUMNS.profile),
    notification_preferences: pickRow(rowFrom(source, "notification_preferences"), EXPORT_COLUMNS.notification_preferences),
    day_types: pickRows(rowsFrom(source, "day_types"), EXPORT_COLUMNS.day_types),
    weekly_schedule: pickRows(rowsFrom(source, "weekly_schedule"), EXPORT_COLUMNS.weekly_schedule),
    schedule_overrides: pickRows(rowsFrom(source, "schedule_overrides"), EXPORT_COLUMNS.schedule_overrides),
    planned_slots: pickRows(rowsFrom(source, "planned_slots"), EXPORT_COLUMNS.planned_slots),
    activities: pickRows(rowsFrom(source, "activities"), EXPORT_COLUMNS.activities),
    session_sets: pickRows(rowsFrom(source, "session_sets", "sets"), EXPORT_COLUMNS.session_sets),
    daily_checkins: pickRows(rowsFrom(source, "daily_checkins", "checkins"), EXPORT_COLUMNS.daily_checkins),
  };
}

export function parsePortableJson(text: string): PortableData {
  return coercePortableData(JSON.parse(text));
}

export function portableDataToCsv(data: PortableData): string {
  const rows: PortableRow[] = [
    {
      table: "metadata",
      schema_version: data.schema_version,
      exported_at: data.exported_at,
    },
  ];

  if (data.profile) rows.push({ table: "profile", ...data.profile });
  if (data.notification_preferences) {
    rows.push({ table: "notification_preferences", ...data.notification_preferences });
  }

  for (const table of PORTABLE_TABLES) {
    if (table === "profile" || table === "notification_preferences") continue;
    for (const row of data[table]) rows.push({ table, ...row });
  }

  return [
    CSV_COLUMNS.join(","),
    ...rows.map((row) =>
      CSV_COLUMNS
        .map((column) => {
          if (column === "table") return escapeCsvCell(String(row.table ?? ""));
          return escapeCsvCell(encodeCsvValue(row[column]));
        })
        .join(",")
    ),
  ].join("\r\n");
}

export function portableDataFromCsv(text: string): PortableData {
  const rows = parseCsvRows(text.trim());
  const [header, ...body] = rows;
  if (!header?.includes("table")) throw new Error("CSV is missing a table column.");

  const tableIndex = header.indexOf("table");
  const grouped: Record<string, PortableRow[]> = {};
  const metadata: PortableRow = {};

  for (const cells of body) {
    const table = cells[tableIndex];
    if (!table) continue;

    const row: PortableRow = {};
    for (let i = 0; i < header.length; i += 1) {
      const column = header[i];
      if (column === "table") continue;
      const decoded = decodeCsvValue(cells[i] ?? "");
      if (decoded !== undefined) row[column] = decoded;
    }

    if (table === "metadata") {
      Object.assign(metadata, row);
    } else {
      grouped[table] = [...(grouped[table] ?? []), row];
    }
  }

  return coercePortableData({
    schema_version: metadata.schema_version,
    exported_at: metadata.exported_at,
    profile: grouped.profile?.[0] ?? null,
    notification_preferences: grouped.notification_preferences?.[0] ?? null,
    day_types: grouped.day_types ?? [],
    weekly_schedule: grouped.weekly_schedule ?? [],
    schedule_overrides: grouped.schedule_overrides ?? [],
    planned_slots: grouped.planned_slots ?? [],
    activities: grouped.activities ?? [],
    session_sets: grouped.session_sets ?? [],
    daily_checkins: grouped.daily_checkins ?? [],
  });
}

export function preparePortableImport(data: PortableData, userId: string): PreparedPortableImport {
  const profile = pickRow(data.profile, IMPORT_COLUMNS.profile);
  if (profile) profile.id = userId;

  const notificationPreferences = pickRow(data.notification_preferences, IMPORT_COLUMNS.notification_preferences);
  if (notificationPreferences) notificationPreferences.user_id = userId;

  return {
    profile,
    notification_preferences: notificationPreferences,
    day_types: pickRows(data.day_types, IMPORT_COLUMNS.day_types),
    weekly_schedule: withUserId(pickRows(data.weekly_schedule, IMPORT_COLUMNS.weekly_schedule), userId),
    schedule_overrides: withUserId(pickRows(data.schedule_overrides, IMPORT_COLUMNS.schedule_overrides), userId),
    planned_slots: withUserId(pickRows(data.planned_slots, IMPORT_COLUMNS.planned_slots), userId),
    activities: withUserId(pickRows(data.activities, IMPORT_COLUMNS.activities), userId),
    session_sets: pickRows(data.session_sets, IMPORT_COLUMNS.session_sets),
    daily_checkins: withUserId(pickRows(data.daily_checkins, IMPORT_COLUMNS.daily_checkins), userId),
  };
}

export function countPortableRows(data: PortableData | PreparedPortableImport): number {
  return PORTABLE_TABLES.reduce((total, table) => {
    const value = data[table];
    if (Array.isArray(value)) return total + value.length;
    return value ? total + 1 : total;
  }, 0);
}
