UPDATE public.exercises
SET movement_pattern = 'elbow_flexion'
WHERE name IN (
  'Barbell Curl',
  'Dumbbell Curl',
  'Hammer Curl',
  'Incline Dumbbell Curl',
  'Preacher Curl',
  'Dumbbell Preacher Curl',
  'Concentration Curl',
  'Cable Curl',
  'EZ Bar Curl',
  'Reverse Curl',
  'Reverse EZ Bar Curl',
  'Cable Hammer Curl',
  'Resistance Band Curl',
  'Spider Curl',
  'Dumbbell Spider Curl',
  'Zottman Curl',
  'Machine Preacher Curl'
);

UPDATE public.exercises
SET movement_pattern = 'elbow_extension'
WHERE name IN (
  'Skull Crusher',
  'EZ Bar Skull Crusher',
  'Dumbbell Skull Crusher',
  'Tricep Overhead Extension',
  'Cable Overhead Tricep Extension',
  'Cable Tricep Pushdown',
  'Cable Rope Tricep Pushdown',
  'Tricep Kickback',
  'Cable Tricep Kickback',
  'Machine Tricep Extension',
  'Resistance Band Tricep Pushdown'
);
