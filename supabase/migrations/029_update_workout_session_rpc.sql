CREATE OR REPLACE FUNCTION public.update_workout_session(
  p_activity_id UUID,
  p_sets JSONB
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID := auth.uid();
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF p_activity_id IS NULL THEN
    RAISE EXCEPTION 'Workout id is required';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.activities
    WHERE id = p_activity_id
      AND user_id = v_user_id
      AND type = 'workout'
  ) THEN
    RAISE EXCEPTION 'Workout not found';
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

  DELETE FROM public.session_sets
  WHERE activity_id = p_activity_id;

  INSERT INTO public.session_sets (
    activity_id,
    exercise_id,
    set_number,
    reps,
    weight,
    rpe
  )
  SELECT
    p_activity_id,
    (item->>'exercise_id')::UUID,
    (item->>'set_number')::INT,
    (item->>'reps')::INT,
    (item->>'weight')::NUMERIC,
    (item->>'rpe')::NUMERIC
  FROM jsonb_array_elements(p_sets) AS item;
END;
$$;

GRANT EXECUTE ON FUNCTION public.update_workout_session(UUID, JSONB) TO authenticated;
