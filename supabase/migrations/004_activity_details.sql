CREATE TABLE activity_details (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  activity_id UUID NOT NULL REFERENCES activities(id) ON DELETE CASCADE,
  data JSONB NOT NULL DEFAULT '{}'
);

CREATE INDEX idx_activity_details_activity ON activity_details (activity_id);
