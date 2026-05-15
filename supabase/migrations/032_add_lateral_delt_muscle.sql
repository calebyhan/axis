UPDATE public.exercises
SET primary_muscles = ARRAY['lateral_delt']::text[],
    secondary_muscles = ARRAY['traps']::text[]
WHERE name IN (
  'Lateral Raise',
  'Cable Lateral Raise',
  'Machine Lateral Raise',
  'Resistance Band Lateral Raise'
);

UPDATE public.exercises
SET secondary_muscles = ARRAY['lateral_delt', 'front_delt', 'rear_delt']::text[]
WHERE name IN (
  'Barbell Upright Row',
  'Dumbbell Upright Row',
  'Cable Upright Row'
);

UPDATE public.day_types
SET muscle_focus = CASE
  WHEN COALESCE(muscle_focus, ARRAY[]::text[]) @> ARRAY['lateral_delt']::text[] THEN muscle_focus
  ELSE COALESCE(muscle_focus, ARRAY[]::text[]) || ARRAY['lateral_delt']::text[]
END
WHERE category = 'strength'
  AND name IN ('Push', 'Upper');
