CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users ON DELETE CASCADE,
  strava_athlete_id BIGINT UNIQUE,
  strava_access_token TEXT,
  strava_refresh_token TEXT,
  token_expires_at TIMESTAMPTZ,
  units TEXT NOT NULL DEFAULT 'metric' CHECK (units IN ('metric', 'imperial')),
  weight_increment_upper NUMERIC NOT NULL DEFAULT 2.5,
  weight_increment_lower NUMERIC NOT NULL DEFAULT 5.0,
  accent_color TEXT NOT NULL DEFAULT 'blue' CHECK (accent_color IN ('blue', 'green', 'orange', 'purple')),
  ohp_bench_ratio NUMERIC NOT NULL DEFAULT 0.65,
  dl_squat_ratio NUMERIC NOT NULL DEFAULT 1.20,
  volume_ceiling INT NOT NULL DEFAULT 10,
  long_run_distance_threshold NUMERIC NOT NULL DEFAULT 16,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Auto-create profile row on new user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id)
  VALUES (NEW.id);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
