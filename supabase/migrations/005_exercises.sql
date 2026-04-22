CREATE TABLE exercises (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  category TEXT NOT NULL CHECK (category IN ('push', 'pull', 'legs', 'core', 'other')),
  primary_muscles TEXT[] NOT NULL DEFAULT '{}',
  secondary_muscles TEXT[] NOT NULL DEFAULT '{}',
  movement_pattern TEXT NOT NULL CHECK (movement_pattern IN (
    'horizontal_push', 'horizontal_pull', 'vertical_push', 'vertical_pull',
    'quad_dominant', 'hip_hinge', 'elbow_flexion', 'elbow_extension',
    'carry', 'core', 'other'
  )),
  equipment TEXT NOT NULL DEFAULT 'bodyweight',
  is_custom BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_exercises_name ON exercises (name);
CREATE INDEX idx_exercises_movement ON exercises (movement_pattern);
