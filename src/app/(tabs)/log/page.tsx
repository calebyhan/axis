"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { formatRelativeCalendarDate } from "@/lib/dates";
import { getTodayPlannedSlots, localDateStr, toISODayOfWeek, type PlannedSlot } from "@/lib/planner";
import { formatSessionTimer } from "@/lib/session-timer";
import { distanceUnit, formatDistance, formatWeight, weightUnit } from "@/lib/units";
import { useSession } from "@/context/SessionContext";
import { useSessionElapsedSeconds } from "@/hooks/useSessionElapsedSeconds";
import type { Activity, DailyCheckin, DayType, ScheduleOverride, SessionState, Units, WeeklyScheduleRow } from "@/types";

type Panel = null | "session" | "run" | "weight";
type Relation<T> = T | T[] | null | undefined;
type RecentActivity = Pick<Activity, "id" | "type" | "day_type_id" | "start_time" | "duration" | "distance" | "name" | "source">;
type RecentWeight = Pick<DailyCheckin, "date" | "body_weight">;

type LogOverview = {
  loading: boolean;
  units: Units;
  dateLabel: string;
  todaySlots: PlannedSlot[];
  dayTypeNames: Record<string, string>;
  recentWorkout: RecentActivity | null;
  recentRun: RecentActivity | null;
  recentWeight: RecentWeight | null;
};

type StravaActivity = {
  id: number;
  name: string;
  sport_type: string;
  start_date: string;
  moving_time: number;
  distance: number;
};

type StravaPreviewState = {
  loading: boolean;
  connected: boolean;
  activities: StravaActivity[];
  importing: number | null;
  error: string | null;
};

const PanelLoading = () => (
  <div className="py-8 text-center text-sm text-muted">Loading…</div>
);

function firstRelation<T>(value: Relation<T>): T | undefined {
  if (Array.isArray(value)) return value[0];
  return value ?? undefined;
}

function normalizeScheduleRows(rows: unknown): WeeklyScheduleRow[] {
  if (!Array.isArray(rows)) return [];
  return rows.map((row) => {
    const raw = row as WeeklyScheduleRow & {
      day_type?: Relation<DayType>;
      cardio_day_type?: Relation<DayType>;
    };
    return {
      ...raw,
      day_type: firstRelation(raw.day_type),
      cardio_day_type: firstRelation(raw.cardio_day_type),
    };
  });
}

function formatDuration(secs: number): string {
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

function formatRelativeDate(value: string | Date): string {
  return formatRelativeCalendarDate(value, new Date(), { weekday: "long" });
}

function isRestPlan(dayType: DayType | null | undefined): boolean {
  return !dayType || dayType.name.toLowerCase() === "rest";
}

function slotLabel(slot: PlannedSlot | undefined): string {
  if (!slot) return "Not scheduled";
  if (!slot.effective) return "Skipped";
  return slot.effective.name;
}

function activityTitle(activity: RecentActivity | null, dayTypeNames: Record<string, string>): string {
  if (!activity) return "No activity yet";
  if (activity.type === "workout") return activity.day_type_id ? (dayTypeNames[activity.day_type_id] ?? "Workout") : "Workout";
  if (activity.name) return activity.name;
  return activity.type === "manual_run" ? "Manual run" : "Run";
}

function runMeta(activity: RecentActivity, units: Units): string {
  const parts = [formatRelativeDate(activity.start_time)];
  if (activity.distance) {
    parts.push(`${formatDistance(activity.distance / 1000, units)} ${distanceUnit(units)}`);
  }
  parts.push(formatDuration(activity.duration));
  return parts.join(" · ");
}

function sessionCounts(session: SessionState): { exercises: number; sets: number } {
  const loggedExercises = session.exercises.filter((exercise) => exercise.sets.length > 0);
  return {
    exercises: loggedExercises.length,
    sets: loggedExercises.reduce((total, exercise) => total + exercise.sets.length, 0),
  };
}

function ActionArrow({ className = "" }: { className?: string }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      className={className}
    >
      <path d="M9 18l6-6-6-6" />
    </svg>
  );
}

function LogAction({
  title,
  description,
  onClick,
  className = "",
  primary = false,
}: {
  title: string;
  description: string;
  onClick: () => void;
  className?: string;
  primary?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`group w-full card surface-hover text-left flex items-center justify-between gap-4 ${
        primary ? "h-32 p-5 lg:h-auto lg:min-h-[18rem] lg:items-end lg:p-6" : "h-32 p-5 lg:h-auto lg:min-h-[8.5rem]"
      } ${className}`}
    >
        <div className="min-w-0">
        <div className={primary ? "font-semibold text-lg lg:text-2xl" : "font-medium text-base"}>
          {title}
        </div>
        <div className={`text-muted mt-2 ${primary ? "max-w-md text-sm lg:text-base" : "text-sm"}`}>
          {description}
        </div>
      </div>
      <span className="shrink-0 flex size-10 items-center justify-center rounded-full border border-white/20 bg-white/[0.08] text-white/80 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)] transition-colors group-hover:border-white/30 group-hover:bg-white/[0.12]">
        <ActionArrow className="size-5" />
      </span>
    </button>
  );
}

function LookupLink() {
  return (
    <Link
      href="/log/muscles"
      className="group card surface-hover flex w-full items-center justify-between gap-4 p-5 text-left"
    >
      <div className="min-w-0">
        <div className="font-medium text-base">Muscle Lookup</div>
        <div className="mt-2 text-sm text-muted">
          See what each exercise hits and review your history.
        </div>
      </div>
      <span className="shrink-0 flex size-10 items-center justify-center rounded-full border border-white/20 bg-white/[0.08] text-white/80 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)] transition-colors group-hover:border-white/30 group-hover:bg-white/[0.12]">
        <ActionArrow className="size-5" />
      </span>
    </Link>
  );
}

function ResumeDraftCard({
  session,
  active,
  onResume,
}: {
  session: SessionState;
  active: boolean;
  onResume: () => void;
}) {
  const counts = sessionCounts(session);
  const elapsedSeconds = useSessionElapsedSeconds(session);
  const loggedExercises = session.exercises.filter((exercise) => exercise.sets.length > 0);
  const latestExercise = loggedExercises[loggedExercises.length - 1]?.name ?? "No sets logged yet";
  const detail = [
    session.dayType?.name ?? "Workout",
    `${counts.exercises} exercise${counts.exercises === 1 ? "" : "s"}`,
    formatRelativeDate(session.startTime),
  ].join(" · ");

  return (
    <div className="card p-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        <div className="text-sm font-medium">{active ? "Workout in progress" : "Resume workout draft"}</div>
        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
          <time dateTime={`PT${elapsedSeconds}S`} className="font-mono tabular-nums text-white" aria-label={`Elapsed ${formatSessionTimer(elapsedSeconds)}`}>
            {formatSessionTimer(elapsedSeconds)}
          </time>
          <span className="text-muted">{latestExercise}</span>
          <span className="text-muted">{counts.sets} set{counts.sets === 1 ? "" : "s"}</span>
        </div>
        <div className="mt-1 truncate text-xs text-muted">{detail}</div>
      </div>
      <button
        type="button"
        onClick={onResume}
        className="shrink-0 rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white"
      >
        {active ? "Continue" : "Resume"}
      </button>
    </div>
  );
}

function TodayPlanCard({
  loading,
  dateLabel,
  slots,
  onStartWorkout,
  onLogRun,
}: {
  loading: boolean;
  dateLabel: string;
  slots: PlannedSlot[];
  onStartWorkout: () => void;
  onLogRun: () => void;
}) {
  const workoutSlot = slots.find((slot) => slot.kind === "workout");
  const cardioSlot = slots.find((slot) => slot.kind === "cardio");
  const canStartWorkout = workoutSlot?.effective && !isRestPlan(workoutSlot.effective);
  const canLogRun = cardioSlot?.effective && !isRestPlan(cardioSlot.effective);

  return (
    <div className="card p-4 flex flex-col gap-4">
      <div>
        <div className="text-xs uppercase tracking-[0.18em] text-muted">Today&apos;s Plan</div>
        <div className="mt-1 text-sm text-white/80">{dateLabel}</div>
      </div>

      {loading ? (
        <div className="text-sm text-muted">Loading plan…</div>
      ) : (
        <div className="grid gap-2 sm:grid-cols-2">
          <div className="rounded-xl border border-border bg-white/[0.025] p-3">
            <div className="text-[11px] uppercase tracking-[0.16em] text-muted">Workout</div>
            <div className="mt-1 text-sm font-medium">{slotLabel(workoutSlot)}</div>
            {canStartWorkout && (
              <button type="button" onClick={onStartWorkout} className="mt-3 text-xs text-accent">
                Start workout
              </button>
            )}
          </div>
          <div className="rounded-xl border border-border bg-white/[0.025] p-3">
            <div className="text-[11px] uppercase tracking-[0.16em] text-muted">Cardio</div>
            <div className="mt-1 text-sm font-medium">{slotLabel(cardioSlot)}</div>
            {canLogRun && (
              <button type="button" onClick={onLogRun} className="mt-3 text-xs text-accent">
                Log run
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function StravaImportPreview({
  state,
  units,
  onImport,
}: {
  state: StravaPreviewState;
  units: Units;
  onImport: (id: number) => void;
}) {
  const activity = state.activities[0];

  return (
    <div className="card p-4 flex flex-col gap-3">
      <div className="flex items-center justify-between gap-3">
        <div className="text-sm font-medium">Strava import</div>
        {state.activities.length > 1 && (
          <div className="text-xs text-muted">+{state.activities.length - 1} more</div>
        )}
      </div>

      {state.loading && <div className="text-sm text-muted">Checking for new runs…</div>}

      {!state.loading && state.error && <div className="text-sm text-red-400">{state.error}</div>}

      {!state.loading && !state.error && !state.connected && (
        <div className="flex flex-col gap-3">
          <div className="text-sm text-muted">Connect Strava to import recent runs.</div>
          <Link href="/api/strava/connect" className="text-sm text-accent">
            Connect Strava
          </Link>
        </div>
      )}

      {!state.loading && !state.error && state.connected && !activity && (
        <div className="text-sm text-muted">No new Strava runs to import.</div>
      )}

      {!state.loading && !state.error && activity && (
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <div className="truncate text-sm font-medium">{activity.name}</div>
            <div className="mt-1 text-xs text-muted">
              {formatRelativeDate(activity.start_date)} · {formatDistance(activity.distance / 1000, units)}{" "}
              {distanceUnit(units)} · {formatDuration(activity.moving_time)}
            </div>
          </div>
          <button
            type="button"
            onClick={() => onImport(activity.id)}
            disabled={state.importing === activity.id}
            className="shrink-0 rounded-lg border border-accent/30 px-3 py-2 text-xs font-medium text-accent disabled:opacity-50"
          >
            {state.importing === activity.id ? "Importing…" : "Import"}
          </button>
        </div>
      )}
    </div>
  );
}

function RecentItem({
  label,
  title,
  meta,
  onClick,
}: {
  label: string;
  title: string;
  meta: string;
  onClick?: () => void;
}) {
  const className = "flex items-start justify-between gap-3 border-t border-border pt-3 first:border-t-0 first:pt-0";
  const content = (
    <>
      <div className="min-w-0">
        <div className="text-[11px] uppercase tracking-[0.16em] text-muted">{label}</div>
        <div className="mt-1 truncate text-sm font-medium">{title}</div>
      </div>
      <div className="shrink-0 pt-5 text-right text-xs text-muted">{meta}</div>
    </>
  );

  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        className={`${className} w-full text-left transition-colors hover:text-white`}
      >
        {content}
      </button>
    );
  }

  return (
    <div className={className}>
      {content}
    </div>
  );
}

function RecentActivityContext({
  loading,
  units,
  dayTypeNames,
  workout,
  run,
  weight,
  onEditWeight,
}: {
  loading: boolean;
  units: Units;
  dayTypeNames: Record<string, string>;
  workout: RecentActivity | null;
  run: RecentActivity | null;
  weight: RecentWeight | null;
  onEditWeight: (date: string) => void;
}) {
  return (
    <div className="card p-4 flex flex-col gap-3">
      <div className="text-sm font-medium">Recent context</div>
      {loading ? (
        <div className="text-sm text-muted">Loading recent activity…</div>
      ) : (
        <div className="flex flex-col gap-3">
          <RecentItem
            label="Workout"
            title={activityTitle(workout, dayTypeNames)}
            meta={workout ? `${formatRelativeDate(workout.start_time)} · ${formatDuration(workout.duration)}` : "—"}
          />
          <RecentItem
            label="Run"
            title={activityTitle(run, dayTypeNames)}
            meta={run ? runMeta(run, units) : "—"}
          />
          <RecentItem
            label="Weight"
            title={weight ? `${formatWeight(weight.body_weight, units)} ${weightUnit(units)}` : "No weigh-in yet"}
            meta={weight ? formatRelativeDate(weight.date) : "—"}
            onClick={weight ? () => onEditWeight(weight.date) : undefined}
          />
        </div>
      )}
    </div>
  );
}

const LogRunPanel = dynamic(
  () => import("@/components/log/LogRunPanel").then((module) => module.LogRunPanel),
  { ssr: false, loading: PanelLoading }
);
const LogWeightForm = dynamic(
  () => import("@/components/log/LogWeightForm").then((module) => module.LogWeightForm),
  { ssr: false, loading: PanelLoading }
);
const SessionFlow = dynamic(
  () => import("@/components/session/SessionFlow").then((module) => module.SessionFlow),
  { ssr: false, loading: PanelLoading }
);

export default function LogPage() {
  const { refresh } = useRouter();
  const { session, isActive, hasDraft, draft, resumeDraft } = useSession();
  const [panel, setPanel] = useState<Panel>(null);
  const [weightInitialDate, setWeightInitialDate] = useState(() => localDateStr(new Date()));
  const [saved, setSaved] = useState<string | null>(null);
  const [overview, setOverview] = useState<LogOverview>({
    loading: true,
    units: "imperial",
    dateLabel: new Date().toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" }),
    todaySlots: [],
    dayTypeNames: {},
    recentWorkout: null,
    recentRun: null,
    recentWeight: null,
  });
  const [stravaPreview, setStravaPreview] = useState<StravaPreviewState>({
    loading: true,
    connected: true,
    activities: [],
    importing: null,
    error: null,
  });

  const loadLogContext = useCallback(async () => {
    const supabase = createClient();
    const today = new Date();
    const todayStr = localDateStr(today);
    const isoDay = toISODayOfWeek(today);

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      setOverview((prev) => ({ ...prev, loading: false }));
      return;
    }

    const [profileRes, dayTypesRes, scheduleRes, overridesRes, workoutRes, runRes, weightRes] = await Promise.all([
      supabase.from("profiles").select("units").eq("id", user.id).single(),
      supabase.from("day_types").select("id, name, category, muscle_focus"),
      supabase
        .from("weekly_schedule")
        .select("id, day_of_week, day_type_id, cardio_day_type_id, active, day_type:day_types!weekly_schedule_day_type_id_fkey(id, name, category, muscle_focus), cardio_day_type:day_types!weekly_schedule_cardio_day_type_id_fkey(id, name, category, muscle_focus)")
        .eq("user_id", user.id)
        .eq("day_of_week", isoDay)
        .eq("active", true),
      supabase.from("schedule_overrides").select("*").eq("user_id", user.id).eq("date", todayStr),
      supabase
        .from("activities")
        .select("id, type, day_type_id, start_time, duration, distance, name, source")
        .eq("user_id", user.id)
        .eq("type", "workout")
        .order("start_time", { ascending: false })
        .limit(1),
      supabase
        .from("activities")
        .select("id, type, day_type_id, start_time, duration, distance, name, source")
        .eq("user_id", user.id)
        .in("type", ["run", "manual_run"])
        .order("start_time", { ascending: false })
        .limit(1),
      supabase
        .from("daily_checkins")
        .select("date, body_weight")
        .eq("user_id", user.id)
        .not("body_weight", "is", null)
        .order("date", { ascending: false })
        .limit(1),
    ]);

    const dayTypes = (dayTypesRes.data ?? []) as DayType[];
    const dayTypeMap = new Map(dayTypes.map((dayType) => [dayType.id, dayType]));
    const todaySlots = getTodayPlannedSlots(
      normalizeScheduleRows(scheduleRes.data),
      (overridesRes.data ?? []) as ScheduleOverride[],
      dayTypeMap,
      today
    );

    setOverview({
      loading: false,
      units: ((profileRes.data?.units ?? "imperial") as Units),
      dateLabel: today.toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" }),
      todaySlots,
      dayTypeNames: Object.fromEntries(dayTypes.map((dayType) => [dayType.id, dayType.name])),
      recentWorkout: ((workoutRes.data ?? [])[0] ?? null) as RecentActivity | null,
      recentRun: ((runRes.data ?? [])[0] ?? null) as RecentActivity | null,
      recentWeight: ((weightRes.data ?? [])[0] ?? null) as RecentWeight | null,
    });
  }, []);

  const loadStravaPreview = useCallback(async () => {
    try {
      const response = await fetch("/api/strava/sync");
      if (!response.ok) throw new Error("Strava preview failed");
      const data = await response.json() as { connected?: boolean; activities?: StravaActivity[] };
      const activities = (data.activities ?? []).sort(
        (a, b) => new Date(b.start_date).getTime() - new Date(a.start_date).getTime()
      );
      setStravaPreview({
        loading: false,
        connected: data.connected !== false,
        activities,
        importing: null,
        error: null,
      });
    } catch {
      setStravaPreview({
        loading: false,
        connected: true,
        activities: [],
        importing: null,
        error: "Could not check Strava right now.",
      });
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadLogContext();
      void loadStravaPreview();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [loadLogContext, loadStravaPreview]);

  function onSaved(msg: string) {
    setSaved(msg);
    setPanel(null);
    refresh();
    void loadLogContext();
    void loadStravaPreview();
    setTimeout(() => setSaved(null), 3000);
  }

  function openWeightPanel(date = localDateStr(new Date())) {
    setWeightInitialDate(date);
    setPanel("weight");
  }

  async function handleStravaImport(activityId: number) {
    if (stravaPreview.importing) return;
    setStravaPreview((prev) => ({ ...prev, importing: activityId, error: null }));
    const response = await fetch("/api/strava/sync", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ activityId }),
    });

    if (!response.ok) {
      setStravaPreview((prev) => ({ ...prev, importing: null, error: "Could not import this run." }));
      return;
    }

    setStravaPreview((prev) => ({
      ...prev,
      importing: null,
      activities: prev.activities.filter((activity) => activity.id !== activityId),
    }));
    onSaved("Run imported!");
  }

  const resumableSession = isActive ? session : hasDraft ? draft : null;

  return (
    <div className="page-shell">
      <div className="page-header">
        <div>
          <h1 className="page-title">Log</h1>
        </div>
      </div>

      {saved && (
        <div className="mb-4 px-4 py-3 bg-green-900/20 border border-green-400/20 rounded-2xl text-sm text-green-300 backdrop-blur-xl">
          {saved}
        </div>
      )}

      <div className="flex flex-col gap-4">
        {resumableSession && (
          <ResumeDraftCard
            session={resumableSession}
            active={isActive}
            onResume={() => {
              if (!isActive) resumeDraft();
              setPanel("session");
            }}
          />
        )}

        <div className="mobile-landscape-stack grid gap-4 lg:grid-cols-[minmax(0,1fr)_22rem] lg:items-start">
          <div className="flex flex-col gap-4">
            <TodayPlanCard
              loading={overview.loading}
              dateLabel={overview.dateLabel}
              slots={overview.todaySlots}
              onStartWorkout={() => setPanel("session")}
              onLogRun={() => setPanel("run")}
            />

            <LogAction
              title="Start Workout Session"
              description="Log sets, track progress, and keep the flow moving."
              onClick={() => setPanel("session")}
              primary
            />
          </div>

          <div className="flex flex-col gap-4">
            <div className="grid gap-4 lg:grid-cols-1">
              <LogAction
                title="Log Run"
                description="Import from Strava or enter manually."
                onClick={() => setPanel("run")}
              />
              <LogAction
                title="Log Body Weight"
                description="Add, backdate, or update a weigh-in."
                onClick={() => openWeightPanel()}
              />
            </div>

            <StravaImportPreview
              state={stravaPreview}
              units={overview.units}
              onImport={(activityId) => void handleStravaImport(activityId)}
            />

            <RecentActivityContext
              loading={overview.loading}
              units={overview.units}
              dayTypeNames={overview.dayTypeNames}
              workout={overview.recentWorkout}
              run={overview.recentRun}
              weight={overview.recentWeight}
              onEditWeight={openWeightPanel}
            />
          </div>
        </div>

        <LookupLink />
      </div>

      {/* Modals */}
      {panel === "session" && (
        <SessionFlow onClose={() => setPanel(null)} onComplete={() => onSaved("Session saved!")} initialUnits={overview.units} />
      )}

      {panel === "run" && (
        <div className="fixed inset-0 z-50 flex flex-col bg-background lg:bg-black/60 lg:items-center lg:justify-center lg:p-6" role="dialog" aria-modal="true" aria-labelledby="log-run-title">
          <div className="flex flex-col w-full h-full lg:h-auto lg:max-h-[85vh] lg:w-full lg:max-w-lg lg:rounded-3xl lg:bg-[#0A0A0A] lg:border lg:border-[#1F1F1F] lg:overflow-hidden">
            <div className="flex items-center gap-3 px-4 pb-4 border-b border-border" style={{ paddingTop: "max(1rem, calc(env(safe-area-inset-top, 0px) + 0.75rem))" }}>
              <button
                type="button"
                onClick={() => setPanel(null)}
                aria-label="Close log run"
                className="shrink-0 size-9 flex items-center justify-center rounded-full border border-white/10 text-white/55 hover:text-white hover:border-white/20 transition-colors"
              >
                <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="size-4">
                  <path d="M18 6L6 18M6 6l12 12" />
                </svg>
              </button>
              <h2 id="log-run-title" className="flex-1 font-semibold">Log Run</h2>
            </div>
            <div className="flex-1 overflow-y-auto px-4 py-6 pb-nav lg:pb-6">
              <LogRunPanel onSave={() => onSaved("Run saved!")} />
            </div>
          </div>
        </div>
      )}

      {panel === "weight" && (
        <div className="fixed inset-0 z-50 flex flex-col bg-background lg:bg-black/60 lg:items-center lg:justify-center lg:p-6" role="dialog" aria-modal="true" aria-labelledby="log-weight-title">
          <div className="flex flex-col w-full h-full lg:h-auto lg:max-h-[85vh] lg:w-full lg:max-w-lg lg:rounded-3xl lg:bg-[#0A0A0A] lg:border lg:border-[#1F1F1F] lg:overflow-hidden">
            <div className="flex items-center gap-3 px-4 pb-4 border-b border-border" style={{ paddingTop: "max(1rem, calc(env(safe-area-inset-top, 0px) + 0.75rem))" }}>
              <button
                type="button"
                onClick={() => setPanel(null)}
                aria-label="Close body weight"
                className="shrink-0 size-9 flex items-center justify-center rounded-full border border-white/10 text-white/55 hover:text-white hover:border-white/20 transition-colors"
              >
                <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="size-4">
                  <path d="M18 6L6 18M6 6l12 12" />
                </svg>
              </button>
              <h2 id="log-weight-title" className="flex-1 font-semibold">Body Weight</h2>
            </div>
            <div className="flex-1 overflow-y-auto px-4 py-6 pb-nav lg:pb-6">
              <LogWeightForm
                onSave={(mutation) => onSaved(mutation === "deleted" ? "Weight deleted!" : "Weight saved!")}
                units={overview.units}
                initialDate={weightInitialDate}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
