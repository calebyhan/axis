ALTER TABLE profiles
  DROP COLUMN IF EXISTS weight_increment_upper,
  DROP COLUMN IF EXISTS weight_increment_lower,
  DROP COLUMN IF EXISTS ohp_bench_ratio,
  DROP COLUMN IF EXISTS dl_squat_ratio,
  DROP COLUMN IF EXISTS volume_ceiling;
