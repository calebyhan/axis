CREATE TABLE session_sets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  activity_id UUID NOT NULL REFERENCES activities(id) ON DELETE CASCADE,
  exercise_id UUID NOT NULL REFERENCES exercises(id),
  set_number INT NOT NULL,
  reps INT NOT NULL,
  weight NUMERIC NOT NULL,
  rpe NUMERIC CHECK (rpe >= 1 AND rpe <= 10),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_session_sets_activity ON session_sets (activity_id);
CREATE INDEX idx_session_sets_exercise ON session_sets (exercise_id);
