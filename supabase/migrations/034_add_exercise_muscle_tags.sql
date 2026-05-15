ALTER TABLE public.exercises
  ADD COLUMN muscle_tags TEXT[] NOT NULL DEFAULT '{}';

UPDATE public.exercises
SET muscle_tags = ARRAY['biceps_long_head', 'biceps_short_head']::text[]
WHERE name IN (
  'Barbell Curl',
  'Dumbbell Curl',
  'Cable Curl',
  'EZ Bar Curl',
  'Resistance Band Curl'
);

UPDATE public.exercises
SET muscle_tags = ARRAY['biceps_long_head']::text[]
WHERE name IN (
  'Incline Dumbbell Curl'
);

UPDATE public.exercises
SET muscle_tags = ARRAY['biceps_short_head']::text[]
WHERE name IN (
  'Preacher Curl',
  'Dumbbell Preacher Curl',
  'Concentration Curl',
  'Spider Curl',
  'Dumbbell Spider Curl',
  'Machine Preacher Curl'
);

UPDATE public.exercises
SET muscle_tags = ARRAY['brachialis', 'brachioradialis']::text[]
WHERE name IN (
  'Hammer Curl',
  'Cable Hammer Curl',
  'Zottman Curl'
);

UPDATE public.exercises
SET muscle_tags = ARRAY['brachioradialis', 'brachialis']::text[]
WHERE name IN (
  'Reverse Curl',
  'Reverse EZ Bar Curl'
);
