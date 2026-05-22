ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS hr_zone_method TEXT NOT NULL DEFAULT 'strava',
  ADD COLUMN IF NOT EXISTS max_heart_rate INTEGER NOT NULL DEFAULT 190;

UPDATE profiles
SET hr_zone_method = 'custom'
WHERE hr_zones IS NOT NULL
  AND hr_zone_method = 'strava';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'profiles_hr_zone_method_check'
  ) THEN
    ALTER TABLE profiles
      ADD CONSTRAINT profiles_hr_zone_method_check
      CHECK (hr_zone_method IN ('custom', 'strava', 'max_hr')) NOT VALID;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'profiles_max_heart_rate_check'
  ) THEN
    ALTER TABLE profiles
      ADD CONSTRAINT profiles_max_heart_rate_check
      CHECK (max_heart_rate BETWEEN 100 AND 240) NOT VALID;
  END IF;
END $$;
