CREATE TABLE planned_slots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  week_start DATE NOT NULL,
  date DATE NOT NULL,
  day_of_week INT NOT NULL CHECK (day_of_week >= 0 AND day_of_week <= 6),
  slot TEXT NOT NULL CHECK (slot IN ('workout', 'cardio')),
  planned_day_type_id UUID REFERENCES day_types(id) ON DELETE SET NULL,
  effective_day_type_id UUID REFERENCES day_types(id) ON DELETE SET NULL,
  is_overridden BOOLEAN NOT NULL DEFAULT false,
  is_skipped BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, date, slot)
);

CREATE INDEX idx_planned_slots_user_week ON planned_slots (user_id, week_start);
CREATE INDEX idx_planned_slots_user_date ON planned_slots (user_id, date);

ALTER TABLE planned_slots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_own_planned_slots"
  ON planned_slots
  FOR ALL
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE planned_slots TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE planned_slots TO service_role;
