UPDATE public.exercises
SET primary_muscles = ARRAY['chest']::text[],
    secondary_muscles = ARRAY['front_delt']::text[]
WHERE name = 'Incline Dumbbell Fly';

UPDATE public.exercises
SET movement_pattern = 'vertical_push',
    primary_muscles = ARRAY['front_delt', 'chest', 'triceps']::text[]
WHERE name IN (
  'Landmine Press',
  'Single Arm Landmine Press'
);

UPDATE public.exercises
SET primary_muscles = ARRAY['front_delt', 'lateral_delt', 'triceps']::text[]
WHERE name IN (
  'Barbell Overhead Press',
  'Seated Barbell Overhead Press',
  'Dumbbell Overhead Press',
  'Seated Dumbbell Overhead Press',
  'Arnold Press',
  'Single Arm Dumbbell Overhead Press',
  'Push Press',
  'Push Jerk',
  'Dumbbell Push Press',
  'Kettlebell Overhead Press',
  'Kettlebell Push Press',
  'Bottoms Up Kettlebell Press',
  'Z Press',
  'Machine Shoulder Press',
  'Cable Overhead Press',
  'Single Arm Cable Overhead Press',
  'Resistance Band Overhead Press',
  'Handstand Push Up',
  'Pike Push Up',
  'Elevated Pike Push Up'
);

UPDATE public.exercises
SET primary_muscles = ARRAY['lateral_delt', 'front_delt', 'triceps']::text[]
WHERE name IN (
  'Behind The Neck Press',
  'Snatch Grip Overhead Press'
);

UPDATE public.exercises
SET primary_muscles = ARRAY['glutes', 'hamstrings', 'adductors']::text[],
    secondary_muscles = ARRAY['quads', 'lower_back', 'traps', 'lats', 'forearm']::text[]
WHERE name = 'Sumo Deadlift';

UPDATE public.exercises
SET primary_muscles = ARRAY['quads', 'glutes', 'hamstrings']::text[],
    secondary_muscles = ARRAY['lower_back', 'traps', 'lats', 'forearm']::text[]
WHERE name = 'Trap Bar Deadlift';

UPDATE public.exercises
SET primary_muscles = ARRAY['hamstrings', 'glutes']::text[],
    secondary_muscles = ARRAY['lower_back', 'adductors', 'traps', 'lats', 'forearm']::text[]
WHERE name IN (
  'Romanian Deadlift',
  'Stiff Leg Deadlift'
);

UPDATE public.exercises
SET primary_muscles = ARRAY['hamstrings', 'glutes']::text[],
    secondary_muscles = ARRAY['lower_back', 'adductors', 'traps', 'lats']::text[]
WHERE name IN (
  'Dumbbell Romanian Deadlift',
  'Kettlebell Romanian Deadlift'
);

UPDATE public.exercises
SET category = 'legs',
    movement_pattern = 'hip_hinge',
    primary_muscles = ARRAY['lower_back', 'glutes']::text[],
    secondary_muscles = ARRAY['hamstrings', 'adductors']::text[]
WHERE name = '45-Degree Back Extension';

UPDATE public.exercises
SET primary_muscles = ARRAY['quads', 'glutes', 'adductors']::text[],
    secondary_muscles = ARRAY['hamstrings', 'calves']::text[]
WHERE name IN (
  'Sumo Squat',
  'Lateral Lunge',
  'Lateral Lunge (Dumbbell)',
  'Lateral Step-Up'
);

UPDATE public.exercises
SET primary_muscles = ARRAY['glutes', 'quads', 'adductors']::text[],
    secondary_muscles = ARRAY['hamstrings', 'calves']::text[]
WHERE name IN (
  'Curtsy Lunge',
  'Curtsy Lunge (Dumbbell)'
);

UPDATE public.exercises
SET movement_pattern = 'other'
WHERE name IN (
  'Standing Calf Raise',
  'Standing Calf Raise (Machine)',
  'Standing Calf Raise (Dumbbell)',
  'Standing Calf Raise (Barbell)',
  'Seated Calf Raise',
  'Seated Calf Extension Machine',
  'Seated Calf Raise (Dumbbell)',
  'Single-Leg Calf Raise',
  'Single-Leg Calf Raise (Dumbbell)',
  'Donkey Calf Raise',
  'Leg Press Calf Raise'
);

UPDATE public.exercises
SET secondary_muscles = ARRAY[]::text[]
WHERE name IN (
  'Front Raise',
  'Barbell Front Raise',
  'Cable Front Raise'
);

UPDATE public.exercises
SET primary_muscles = ARRAY['lateral_delt', 'traps']::text[],
    secondary_muscles = ARRAY['front_delt', 'rear_delt']::text[]
WHERE name IN (
  'Barbell Upright Row',
  'Dumbbell Upright Row',
  'Cable Upright Row'
);

UPDATE public.exercises
SET movement_pattern = 'carry',
    primary_muscles = ARRAY['forearm', 'traps']::text[],
    secondary_muscles = ARRAY['upper_back', 'abs', 'obliques']::text[]
WHERE name IN (
  'Farmer''s Carry',
  'Barbell Farmer''s Carry'
);
