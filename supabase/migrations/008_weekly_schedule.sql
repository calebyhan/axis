-- day_of_week: 0=Monday ... 6=Sunday (ISO week order, NOT JS Date.getDay())
CREATE TABLE weekly_schedule (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  day_of_week INT NOT NULL CHECK (day_of_week >= 0 AND day_of_week <= 6),
  day_type_id UUID NOT NULL REFERENCES day_types(id),
  active BOOLEAN NOT NULL DEFAULT true,
  UNIQUE (user_id, day_of_week)
);

CREATE INDEX idx_weekly_schedule_user ON weekly_schedule (user_id);
