-- Add optional cardio/run day type selection per day (separate from strength day_type_id)
-- Also make day_type_id nullable to support cardio-only days
ALTER TABLE weekly_schedule
  ALTER COLUMN day_type_id DROP NOT NULL,
  ADD COLUMN cardio_day_type_id UUID REFERENCES day_types(id);
