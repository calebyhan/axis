CREATE TABLE pending_strava_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  strava_activity_id BIGINT NOT NULL,
  -- Biometric fields + metadata from Strava to be merged on resolution
  strava_data JSONB NOT NULL,
  -- IDs of Axis workout activities that are candidates for linking
  candidate_ids UUID[] NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_pending_strava_links_user ON pending_strava_links (user_id);

ALTER TABLE pending_strava_links ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own pending links"
  ON pending_strava_links FOR ALL
  USING (user_id = auth.uid());

GRANT ALL ON pending_strava_links TO authenticated;
