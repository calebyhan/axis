INSERT INTO public.exercises (
  name,
  category,
  movement_pattern,
  primary_muscles,
  secondary_muscles,
  equipment,
  is_custom
)
VALUES (
  'Ab Twist Machine',
  'core',
  'core',
  ARRAY['obliques'],
  ARRAY['abs'],
  'machine',
  false
)
ON CONFLICT (name) DO NOTHING;
