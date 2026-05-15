# Database

Supabase Postgres is the source of truth. User-owned tables are protected by Row Level Security and keyed directly or indirectly to `auth.uid()`.

---

## Core Tables

### `profiles`

Created automatically by `public.handle_new_user()` when a Supabase Auth user signs up.

```sql
id UUID PRIMARY KEY REFERENCES auth.users ON DELETE CASCADE
strava_athlete_id BIGINT UNIQUE
strava_access_token TEXT
strava_refresh_token TEXT
token_expires_at TIMESTAMPTZ
units TEXT NOT NULL DEFAULT 'imperial' CHECK (units IN ('metric', 'imperial'))
accent_color TEXT NOT NULL DEFAULT 'blue' CHECK (accent_color IN ('blue', 'green', 'orange', 'purple'))
long_run_distance_threshold NUMERIC NOT NULL DEFAULT 16
display_name TEXT
onboarding_completed_at TIMESTAMPTZ
created_at TIMESTAMPTZ NOT NULL DEFAULT now()
```

Current implementation stores Strava tokens on `profiles`; Vault is not used in this repo.

### `activities`

Single activity feed for Strava cardio, manual runs, and strength workouts.

```sql
id UUID PRIMARY KEY DEFAULT gen_random_uuid()
user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE
strava_activity_id BIGINT UNIQUE
type TEXT NOT NULL CHECK (type IN ('run', 'ride', 'workout', 'manual_run'))
day_type_id UUID REFERENCES day_types(id)
start_time TIMESTAMPTZ NOT NULL
duration INT
source TEXT NOT NULL CHECK (source IN ('strava', 'manual'))
distance NUMERIC
avg_heartrate NUMERIC
max_heartrate NUMERIC
suffer_score INT
calories INT
elevation_gain NUMERIC
avg_pace NUMERIC
tags TEXT[]
notes TEXT
created_at TIMESTAMPTZ NOT NULL DEFAULT now()

-- Strava detail fields added by later migrations
name TEXT
summary_polyline TEXT
splits JSONB
best_efforts JSONB
avg_cadence NUMERIC
avg_watts NUMERIC
elapsed_time INT
max_speed NUMERIC
average_temp NUMERIC
```

### `session_sets`

Granular strength-session data. Workouts are saved through `save_workout_session()` and edited through `update_workout_session()`.

```sql
id UUID PRIMARY KEY DEFAULT gen_random_uuid()
activity_id UUID NOT NULL REFERENCES activities(id) ON DELETE CASCADE
exercise_id UUID NOT NULL REFERENCES exercises(id)
set_number INT NOT NULL
reps INT NOT NULL
weight NUMERIC NOT NULL
rpe NUMERIC CHECK (rpe >= 1 AND rpe <= 10)
created_at TIMESTAMPTZ NOT NULL DEFAULT now()
```

Later hardening adds non-validated constraints for positive set number/reps and non-negative weight.

### `exercises`

Global exercise taxonomy seeded by `npm run seed:exercises`.

```sql
id UUID PRIMARY KEY DEFAULT gen_random_uuid()
name TEXT NOT NULL UNIQUE
category TEXT NOT NULL CHECK (category IN ('push', 'pull', 'legs', 'core', 'other'))
primary_muscles TEXT[] NOT NULL DEFAULT '{}'
secondary_muscles TEXT[] NOT NULL DEFAULT '{}'
muscle_tags TEXT[] NOT NULL DEFAULT '{}'
movement_pattern TEXT NOT NULL CHECK (movement_pattern IN (
  'horizontal_push', 'horizontal_pull', 'vertical_push', 'vertical_pull',
  'quad_dominant', 'hip_hinge', 'elbow_flexion', 'elbow_extension',
  'carry', 'core', 'other'
))
equipment TEXT NOT NULL DEFAULT 'bodyweight'
is_custom BOOLEAN NOT NULL DEFAULT false
created_at TIMESTAMPTZ NOT NULL DEFAULT now()
```

### `day_types`

Global day-type library. Built-ins are Push, Pull, Legs, Upper, Full Body, Easy, Long, Intervals, and Rest.

```sql
id UUID PRIMARY KEY DEFAULT gen_random_uuid()
name TEXT NOT NULL
category TEXT NOT NULL CHECK (category IN ('strength', 'run'))
muscle_focus TEXT[]
```

### `weekly_schedule`

Repeating plan. A row can hold one workout slot, one cardio slot, or both.

```sql
id UUID PRIMARY KEY DEFAULT gen_random_uuid()
user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE
day_of_week INT NOT NULL CHECK (day_of_week >= 0 AND day_of_week <= 6)
day_type_id UUID REFERENCES day_types(id)
cardio_day_type_id UUID REFERENCES day_types(id)
active BOOLEAN NOT NULL DEFAULT true
UNIQUE (user_id, day_of_week)
```

`day_of_week` uses ISO weekday order: `0 = Monday ... 6 = Sunday`. Week ranges in the UI are displayed Sunday-Saturday, so date mapping must account for both conventions.

### `schedule_overrides`

Per-date changes from the repeating schedule.

```sql
id UUID PRIMARY KEY DEFAULT gen_random_uuid()
user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE
date DATE NOT NULL
slot TEXT NOT NULL CHECK (slot IN ('workout', 'cardio'))
day_type_id UUID REFERENCES day_types(id) ON DELETE SET NULL
created_at TIMESTAMPTZ NOT NULL DEFAULT now()
UNIQUE (user_id, date, slot)
```

`day_type_id = NULL` means the slot is skipped for that date.

### `planned_slots`

Historical adherence snapshots. Current/future weeks are regenerated when the repeating schedule or an override changes; older weeks remain stable.

```sql
id UUID PRIMARY KEY DEFAULT gen_random_uuid()
user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE
week_start DATE NOT NULL
date DATE NOT NULL
day_of_week INT NOT NULL CHECK (day_of_week >= 0 AND day_of_week <= 6)
slot TEXT NOT NULL CHECK (slot IN ('workout', 'cardio'))
planned_day_type_id UUID REFERENCES day_types(id) ON DELETE SET NULL
effective_day_type_id UUID REFERENCES day_types(id) ON DELETE SET NULL
is_overridden BOOLEAN NOT NULL DEFAULT false
is_skipped BOOLEAN NOT NULL DEFAULT false
created_at TIMESTAMPTZ NOT NULL DEFAULT now()
updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
UNIQUE (user_id, date, slot)
```

### Other Tables

```sql
activity_details(id, activity_id, data)
daily_checkins(id, user_id, date, body_weight, notes, created_at)
weekly_summaries(id, user_id, week_start, data, created_at)
pending_strava_links(id, user_id, strava_activity_id, strava_data, candidate_ids, created_at)
antagonist_pairs(pattern_a, pattern_b)
```

`activity_details` and `weekly_summaries` exist for flexible detail/summary data, but the current UI primarily reads typed columns on `activities`.

### Notifications

```sql
notification_preferences(
  user_id,
  enabled,
  today_plan_enabled,
  today_plan_time,
  pending_strava_enabled,
  plan_nudge_enabled,
  plan_nudge_time,
  weekly_review_enabled,
  weekly_review_day,
  weekly_review_time,
  timezone
)

push_subscriptions(user_id, endpoint, p256dh, auth, user_agent, last_seen_at)

notification_events(user_id, kind, dedupe_key, title, body, url, sent_at)
```

`notification_events` deduplicates once-per-day and once-per-week scheduled notifications, plus event-driven pending Strava link notifications.

---

## RPCs

### `save_workout_session(p_start_time, p_duration, p_day_type_id, p_sets)`

Validates authentication, start time, non-negative duration, at least one set, positive reps/set numbers, non-negative weight, and RPE in `1..10`. Inserts one `activities` row with `type = 'workout'`, then inserts all `session_sets` in one database function call.

### `update_workout_session(p_activity_id, p_sets)`

Validates ownership and workout type, validates the replacement sets, deletes existing sets for the workout, and inserts the replacement set list.

---

## RLS

User-owned tables are scoped to `auth.uid()`:

- Direct ownership: `profiles`, `activities`, `weekly_schedule`, `daily_checkins`, `weekly_summaries`, `schedule_overrides`, `planned_slots`, `pending_strava_links`
- Indirect ownership through `activities`: `activity_details`, `session_sets`
- Global read-mostly tables: `exercises`, `antagonist_pairs`, `day_types`

Authenticated users and `service_role` receive explicit grants for app tables; RLS still enforces ownership for authenticated clients.

---

## Derived Data

### e1RM

```text
e1rm = weight * (1 + reps / 30)
```

Computed in TypeScript with `computeE1RM()`. One-rep sets return the actual weight.

### Training Load

Daily training load combines run and strength signals:

- Run TL: sum of `suffer_score`, capped at 200 per day in the query.
- Strength TL: `SUM(reps * weight * rpe) / 1000`, capped at 200.
- Daily TL: `runTL + strengthTL`.

```text
ATL = ATL_previous * (1 - 1/7)  + dailyTL * (1/7)
CTL = CTL_previous * (1 - 1/42) + dailyTL * (1/42)
TSB = CTL - ATL
```

The Stats load tab computes the window on demand: 7 days, 30 days, 365 days, or 730 days.

### Body Weight Trend

Linear regression over the selected body-weight points in stored kilograms:

- `> +0.2 kg/week`: gaining
- `< -0.2 kg/week`: losing
- otherwise: maintaining

### Muscle Coverage

Coverage uses `session_sets -> exercises.primary_muscles`. Secondary muscles are stored and used in search/filtering, but coverage counts are currently based on primary muscles.

### Plan Adherence

`deriveAdherence()` greedily assigns activities to effective planned slots by type match and temporal proximity. A matched activity on the planned date is `completed`; a match on another date in the same week is `swapped`; past unmatched slots are `missed`; future unmatched slots are `pending`; skipped overrides are `skipped`.

---

## Seed Data

Antagonist movement pairs:

```sql
('horizontal_push', 'horizontal_pull')
('vertical_push', 'vertical_pull')
('quad_dominant', 'hip_hinge')
('elbow_flexion', 'elbow_extension')
```

Exercise taxonomy is seeded from the Wger open dataset plus local mapping logic in `scripts/seed-exercises.ts`.
