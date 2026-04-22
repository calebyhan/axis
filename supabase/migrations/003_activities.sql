CREATE TABLE activities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  strava_activity_id BIGINT UNIQUE,
  type TEXT NOT NULL CHECK (type IN ('run', 'ride', 'workout', 'manual_run')),
  day_type_id UUID REFERENCES day_types(id),
  start_time TIMESTAMPTZ NOT NULL,
  duration INT,                        -- seconds
  source TEXT NOT NULL CHECK (source IN ('strava', 'manual')),
  -- Strava summary fields
  distance NUMERIC,                    -- meters
  avg_heartrate NUMERIC,
  max_heartrate NUMERIC,
  suffer_score INT,
  calories INT,
  elevation_gain NUMERIC,              -- meters
  avg_pace NUMERIC,                    -- seconds/km
  tags TEXT[],
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_activities_user_start ON activities (user_id, start_time DESC);
CREATE INDEX idx_activities_user_type ON activities (user_id, type);
