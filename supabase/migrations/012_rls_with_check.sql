-- Add WITH CHECK to all FOR ALL policies that lack it.
-- FOR ALL without WITH CHECK allows INSERT/UPDATE to bypass the ownership guard.

-- profiles
DROP POLICY IF EXISTS "users_own_profile" ON profiles;
CREATE POLICY "users_own_profile" ON profiles
  FOR ALL
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

-- activities
DROP POLICY IF EXISTS "users_own_activities" ON activities;
CREATE POLICY "users_own_activities" ON activities
  FOR ALL
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- activity_details (keyed via activity, no direct user_id column)
DROP POLICY IF EXISTS "users_own_activity_details" ON activity_details;
CREATE POLICY "users_own_activity_details" ON activity_details
  FOR ALL
  USING (
    activity_id IN (
      SELECT id FROM activities WHERE user_id = auth.uid()
    )
  )
  WITH CHECK (
    activity_id IN (
      SELECT id FROM activities WHERE user_id = auth.uid()
    )
  );

-- session_sets (keyed via activity)
DROP POLICY IF EXISTS "users_own_session_sets" ON session_sets;
CREATE POLICY "users_own_session_sets" ON session_sets
  FOR ALL
  USING (
    activity_id IN (
      SELECT id FROM activities WHERE user_id = auth.uid()
    )
  )
  WITH CHECK (
    activity_id IN (
      SELECT id FROM activities WHERE user_id = auth.uid()
    )
  );

-- weekly_schedule
DROP POLICY IF EXISTS "users_own_schedule" ON weekly_schedule;
CREATE POLICY "users_own_schedule" ON weekly_schedule
  FOR ALL
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- daily_checkins
DROP POLICY IF EXISTS "users_own_checkins" ON daily_checkins;
CREATE POLICY "users_own_checkins" ON daily_checkins
  FOR ALL
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- weekly_summaries
DROP POLICY IF EXISTS "users_own_summaries" ON weekly_summaries;
CREATE POLICY "users_own_summaries" ON weekly_summaries
  FOR ALL
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());
