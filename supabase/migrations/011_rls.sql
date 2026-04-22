-- Enable RLS on all user-scoped tables
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE activity_details ENABLE ROW LEVEL SECURITY;
ALTER TABLE session_sets ENABLE ROW LEVEL SECURITY;
ALTER TABLE weekly_schedule ENABLE ROW LEVEL SECURITY;
ALTER TABLE daily_checkins ENABLE ROW LEVEL SECURITY;
ALTER TABLE weekly_summaries ENABLE ROW LEVEL SECURITY;

-- exercises and antagonist_pairs are global read-only (no user data)
ALTER TABLE exercises ENABLE ROW LEVEL SECURITY;
ALTER TABLE antagonist_pairs ENABLE ROW LEVEL SECURITY;
ALTER TABLE day_types ENABLE ROW LEVEL SECURITY;

-- profiles: own row only
CREATE POLICY "users_own_profile" ON profiles
  FOR ALL USING (id = auth.uid());

-- activities: own rows only
CREATE POLICY "users_own_activities" ON activities
  FOR ALL USING (user_id = auth.uid());

-- activity_details: via activity ownership
CREATE POLICY "users_own_activity_details" ON activity_details
  FOR ALL USING (
    activity_id IN (
      SELECT id FROM activities WHERE user_id = auth.uid()
    )
  );

-- session_sets: via activity ownership
CREATE POLICY "users_own_session_sets" ON session_sets
  FOR ALL USING (
    activity_id IN (
      SELECT id FROM activities WHERE user_id = auth.uid()
    )
  );

-- weekly_schedule: own rows
CREATE POLICY "users_own_schedule" ON weekly_schedule
  FOR ALL USING (user_id = auth.uid());

-- daily_checkins: own rows
CREATE POLICY "users_own_checkins" ON daily_checkins
  FOR ALL USING (user_id = auth.uid());

-- weekly_summaries: own rows
CREATE POLICY "users_own_summaries" ON weekly_summaries
  FOR ALL USING (user_id = auth.uid());

-- exercises: read for all authenticated users (global taxonomy)
CREATE POLICY "authenticated_read_exercises" ON exercises
  FOR SELECT USING (auth.role() = 'authenticated');

-- Custom exercises: users can manage their own
CREATE POLICY "users_manage_custom_exercises" ON exercises
  FOR INSERT WITH CHECK (is_custom = true);

CREATE POLICY "users_delete_custom_exercises" ON exercises
  FOR DELETE USING (is_custom = true);

-- antagonist_pairs: global read-only
CREATE POLICY "authenticated_read_antagonist_pairs" ON antagonist_pairs
  FOR SELECT USING (auth.role() = 'authenticated');

-- day_types: global read + users can add custom
CREATE POLICY "authenticated_read_day_types" ON day_types
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "users_insert_day_types" ON day_types
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "users_delete_custom_day_types" ON day_types
  FOR DELETE USING (auth.role() = 'authenticated');
