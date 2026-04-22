-- Ensure authenticated users can access app tables, with RLS still enforcing row-level ownership.
GRANT USAGE ON SCHEMA public TO authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE
  public.profiles,
  public.activities,
  public.activity_details,
  public.session_sets,
  public.weekly_schedule,
  public.daily_checkins,
  public.weekly_summaries,
  public.exercises,
  public.antagonist_pairs,
  public.day_types
TO authenticated;
