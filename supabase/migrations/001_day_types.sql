CREATE TABLE day_types (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  category TEXT NOT NULL CHECK (category IN ('strength', 'run')),
  muscle_focus TEXT[]
);

-- Built-in strength types
INSERT INTO day_types (name, category, muscle_focus) VALUES
  ('Push',      'strength', ARRAY['chest','front_delt','triceps']),
  ('Pull',      'strength', ARRAY['upper_back','lats','biceps','rear_delt']),
  ('Legs',      'strength', ARRAY['quads','hamstrings','glutes','calves']),
  ('Upper',     'strength', ARRAY['chest','upper_back','front_delt','rear_delt','triceps','biceps']),
  ('Full Body', 'strength', ARRAY['chest','upper_back','quads','hamstrings','glutes']);

-- Built-in run types
INSERT INTO day_types (name, category) VALUES
  ('Easy',      'run'),
  ('Long',      'run'),
  ('Intervals', 'run'),
  ('Rest',      'run');
