# Database

Supabase (PostgreSQL) with Row Level Security on every table.

---

## Schema

```sql
-- Auth & Strava token storage
-- Strava tokens stored via Supabase Vault extension (vault.secrets); never exposed to frontend
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users,
  strava_access_token TEXT,        -- encrypted via Vault
  strava_refresh_token TEXT,       -- encrypted via Vault
  token_expires_at TIMESTAMPTZ,
  units TEXT DEFAULT 'metric'      -- 'metric' | 'imperial'
);

-- Core activity log (both Strava and manual)
CREATE TABLE activities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id),
  strava_activity_id BIGINT UNIQUE,
  type TEXT,                       -- 'run' | 'ride' | 'workout' | 'manual_run'
  day_type_id UUID REFERENCES day_types(id),  -- NULL for unplanned/Strava-only activities
  start_time TIMESTAMPTZ,
  duration INT,                    -- seconds (moving_time for runs)
  source TEXT,                     -- 'strava' | 'manual'
  -- Strava summary fields (NULL for manual entries where not applicable)
  distance NUMERIC,                -- meters
  avg_heartrate NUMERIC,
  max_heartrate NUMERIC,
  suffer_score INT,
  calories INT,
  elevation_gain NUMERIC,          -- meters
  avg_pace NUMERIC,                -- seconds per km (runs only)
  tags TEXT[],                     -- ['felt heavy', 'race sim', etc.]
  notes TEXT
);

-- Flexible type-specific data per activity
CREATE TABLE activity_details (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  activity_id UUID REFERENCES activities(id),
  data JSONB                       -- GPS polylines, HR streams, summary stats
);

-- Granular strength session data
CREATE TABLE session_sets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  activity_id UUID REFERENCES activities(id),
  exercise_id UUID REFERENCES exercises(id),
  set_number INT,
  reps INT,
  weight NUMERIC,
  rpe NUMERIC,                     -- 1–10
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Exercise taxonomy (seeded from Wger open dataset + custom)
CREATE TABLE exercises (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT,
  category TEXT,                   -- 'push' | 'pull' | 'legs' | 'core'
  primary_muscles TEXT[],          -- ["chest", "front_delt", "triceps"]
  secondary_muscles TEXT[],
  movement_pattern TEXT,           -- 'horizontal_push' | 'vertical_pull' | 'hinge' etc.
  equipment TEXT,                  -- 'barbell' | 'dumbbell' | 'bodyweight' etc.
  is_custom BOOLEAN DEFAULT false  -- false = Wger seed; true = user-created (safe to delete/edit)
);

-- Antagonist movement pairs (for balance warnings)
CREATE TABLE antagonist_pairs (
  pattern_a TEXT,                  -- 'horizontal_push'
  pattern_b TEXT                   -- 'horizontal_pull'
);

-- Named day types
CREATE TABLE day_types (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT,                       -- "Push", "Long Run", "Intervals"
  category TEXT,                   -- 'strength' | 'run'
  muscle_focus TEXT[]              -- NULL for run types
);

-- Weekly repeating schedule
-- day_of_week convention: 0 = Monday … 6 = Sunday (ISO week order, NOT JS Date.getDay())
-- Frontend must convert: jsDay => (jsDay + 6) % 7
CREATE TABLE weekly_schedule (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  day_of_week INT,                 -- 0 = Monday ... 6 = Sunday
  day_type_id UUID REFERENCES day_types(id),
  active BOOLEAN DEFAULT true
);

-- Body weight log
CREATE TABLE daily_checkins (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id),
  date DATE,
  body_weight NUMERIC,
  notes TEXT,
  UNIQUE (user_id, date)           -- one weigh-in per day; upsert on re-entry
);

-- Week in Review summaries (written by Sunday pg_cron job — requires Supabase Pro plan)
CREATE TABLE weekly_summaries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id),
  week_start DATE,
  data JSONB,
  UNIQUE (user_id, week_start)     -- idempotent re-runs safe
);
```

---

## Row Level Security

All tables use Supabase RLS — every query is automatically scoped to the authenticated user. No query can access another user's rows.

---

## Derived Data (Computed, Not Stored)

These are computed at query time or client-side; not persisted as columns.

### e1RM (Epley formula)
```
e1rm = weight × (1 + reps / 30.0)
```
Computed client-side per set.

### Weekly volume per lift
```sql
SUM(sets × reps × weight) GROUP BY week
```

### 7-day rolling average body weight
Rolling query over `daily_checkins`.

### ATL / CTL / TSB (Training Load Model)

Daily training load (TL) combines run and strength signals on the same scale:

- **Run TL** = `suffer_score` (Strava-provided, 0–200 scale)
- **Strength TL** = `SUM(sets × reps × weight × rpe) / 1000` per session, normalized to 0–200 via a fixed divisor (tune once against real data)
- **Daily TL** = run TL + strength TL (additive; zero on rest days)

Exponentially weighted averages:
```
ATL_today = ATL_yesterday × (1 - 1/7)  + TL_today × (1/7)    -- 7-day EWA (fatigue)
CTL_today = CTL_yesterday × (1 - 1/42) + TL_today × (1/42)   -- 42-day EWA (fitness)
TSB       = CTL - ATL                                          -- form
```

Computed over the last 90 days on page load. Cache in a Postgres materialized view if query time becomes unacceptable.

### Muscle group coverage per session
Aggregated from `session_sets` joined to `exercises.primary_muscles` and `exercises.secondary_muscles`.

### Body weight trend classification
Linear regression over last 14 days of `daily_checkins`:
- Slope > +0.2 kg/week → **gaining**
- Slope < −0.2 kg/week → **losing**
- Otherwise → **maintaining**

---

## Seed Data

### Antagonist pairs
```sql
INSERT INTO antagonist_pairs VALUES
  ('horizontal_push', 'horizontal_pull'),
  ('vertical_push',   'vertical_pull'),
  ('quad_dominant',   'hip_hinge'),
  ('elbow_flexion',   'elbow_extension');
```

### Exercise taxonomy
Seeded from the [Wger open dataset](https://wger.de/en/software/api). Run `npm run seed:exercises` on first setup. This is the critical upfront investment — the muscle mappings power the entire smart feature layer. Verify mappings after seeding; Wger quality is variable.

Custom exercises added by the user have `is_custom = true` and can be safely deleted or renamed. Wger-seeded exercises (`is_custom = false`) should not be deleted as they may be referenced by historical session sets.
