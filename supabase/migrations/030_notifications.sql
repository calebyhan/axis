CREATE TABLE notification_preferences (
  user_id UUID PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
  enabled BOOLEAN NOT NULL DEFAULT false,
  today_plan_enabled BOOLEAN NOT NULL DEFAULT true,
  today_plan_time TIME NOT NULL DEFAULT '08:00',
  pending_strava_enabled BOOLEAN NOT NULL DEFAULT true,
  plan_nudge_enabled BOOLEAN NOT NULL DEFAULT true,
  plan_nudge_time TIME NOT NULL DEFAULT '19:00',
  weekly_review_enabled BOOLEAN NOT NULL DEFAULT true,
  weekly_review_day INT NOT NULL DEFAULT 0 CHECK (weekly_review_day >= 0 AND weekly_review_day <= 6),
  weekly_review_time TIME NOT NULL DEFAULT '18:00',
  timezone TEXT NOT NULL DEFAULT 'UTC',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE push_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  endpoint TEXT NOT NULL UNIQUE,
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_push_subscriptions_user ON push_subscriptions (user_id);

CREATE TABLE notification_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK (kind IN ('today_plan', 'pending_strava_link', 'plan_nudge', 'weekly_review')),
  dedupe_key TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  url TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  sent_at TIMESTAMPTZ,
  UNIQUE (user_id, kind, dedupe_key)
);

CREATE INDEX idx_notification_events_user_kind ON notification_events (user_id, kind, created_at DESC);

ALTER TABLE notification_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE push_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_manage_own_notification_preferences"
  ON notification_preferences FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "users_manage_own_push_subscriptions"
  ON push_subscriptions FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "users_read_own_notification_events"
  ON notification_events FOR SELECT
  USING (auth.uid() = user_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE notification_preferences TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE push_subscriptions TO authenticated;
GRANT SELECT ON TABLE notification_events TO authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE notification_preferences TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE push_subscriptions TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE notification_events TO service_role;
