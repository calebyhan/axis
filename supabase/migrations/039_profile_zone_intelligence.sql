ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS strava_hr_zones JSONB,
  ADD COLUMN IF NOT EXISTS strava_hr_zones_synced_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS strava_hr_zones_hash TEXT,
  ADD COLUMN IF NOT EXISTS ignored_hr_zone_suggestion_hash TEXT,
  ADD COLUMN IF NOT EXISTS ignored_pace_zone_suggestion_hash TEXT,
  ADD COLUMN IF NOT EXISTS last_hr_zone_suggestion_basis JSONB,
  ADD COLUMN IF NOT EXISTS last_pace_zone_suggestion_basis JSONB,
  ADD COLUMN IF NOT EXISTS last_zone_suggestions_generated_at TIMESTAMPTZ;
