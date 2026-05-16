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
  'Seated Calf Extension Machine',
  'legs',
  'quad_dominant',
  ARRAY['calves'],
  ARRAY[]::text[],
  'machine',
  false
)
ON CONFLICT (name) DO NOTHING;
