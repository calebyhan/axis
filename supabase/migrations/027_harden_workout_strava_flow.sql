ALTER TABLE session_sets
  ADD CONSTRAINT session_sets_set_number_positive CHECK (set_number > 0) NOT VALID,
  ADD CONSTRAINT session_sets_reps_positive CHECK (reps > 0) NOT VALID,
  ADD CONSTRAINT session_sets_weight_nonnegative CHECK (weight >= 0) NOT VALID;

DELETE FROM pending_strava_links
WHERE ctid IN (
  SELECT ctid
  FROM (
    SELECT
      ctid,
      row_number() OVER (
        PARTITION BY user_id, strava_activity_id
        ORDER BY created_at, id
      ) AS duplicate_rank
    FROM pending_strava_links
  ) ranked
  WHERE duplicate_rank > 1
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_pending_strava_links_user_strava_activity
  ON pending_strava_links (user_id, strava_activity_id);

CREATE OR REPLACE FUNCTION public.save_workout_session(
  p_start_time TIMESTAMPTZ,
  p_duration INT,
  p_day_type_id UUID,
  p_sets JSONB
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_activity_id UUID;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF p_start_time IS NULL THEN
    RAISE EXCEPTION 'Session start time is required';
  END IF;

  IF p_duration IS NULL OR p_duration < 0 THEN
    RAISE EXCEPTION 'Session duration must be non-negative';
  END IF;

  IF jsonb_typeof(COALESCE(p_sets, '[]'::JSONB)) <> 'array' OR jsonb_array_length(COALESCE(p_sets, '[]'::JSONB)) = 0 THEN
    RAISE EXCEPTION 'Workout session requires at least one set';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM jsonb_array_elements(p_sets) AS item
    WHERE NULLIF(item->>'exercise_id', '') IS NULL
      OR NULLIF(item->>'set_number', '') IS NULL
      OR NULLIF(item->>'reps', '') IS NULL
      OR NULLIF(item->>'weight', '') IS NULL
      OR NULLIF(item->>'rpe', '') IS NULL
      OR (item->>'set_number')::INT <= 0
      OR (item->>'reps')::INT <= 0
      OR (item->>'weight')::NUMERIC < 0
      OR (item->>'rpe')::NUMERIC < 1
      OR (item->>'rpe')::NUMERIC > 10
  ) THEN
    RAISE EXCEPTION 'Workout session contains invalid set data';
  END IF;

  INSERT INTO public.activities (
    user_id,
    type,
    source,
    start_time,
    duration,
    day_type_id
  )
  VALUES (
    v_user_id,
    'workout',
    'manual',
    p_start_time,
    p_duration,
    p_day_type_id
  )
  RETURNING id INTO v_activity_id;

  INSERT INTO public.session_sets (
    activity_id,
    exercise_id,
    set_number,
    reps,
    weight,
    rpe
  )
  SELECT
    v_activity_id,
    (item->>'exercise_id')::UUID,
    (item->>'set_number')::INT,
    (item->>'reps')::INT,
    (item->>'weight')::NUMERIC,
    (item->>'rpe')::NUMERIC
  FROM jsonb_array_elements(p_sets) AS item;

  RETURN v_activity_id;
END;
$$;
