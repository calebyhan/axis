-- service_role needs explicit grants since migration 013 only covered authenticated
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
TO service_role;
