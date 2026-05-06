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
    NULLIF(item->>'rpe', '')::NUMERIC
  FROM jsonb_array_elements(COALESCE(p_sets, '[]'::JSONB)) AS item;

  RETURN v_activity_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.save_workout_session(TIMESTAMPTZ, INT, UUID, JSONB) TO authenticated;
