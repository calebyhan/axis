CREATE TABLE antagonist_pairs (
  pattern_a TEXT NOT NULL,
  pattern_b TEXT NOT NULL,
  PRIMARY KEY (pattern_a, pattern_b)
);

INSERT INTO antagonist_pairs (pattern_a, pattern_b) VALUES
  ('horizontal_push', 'horizontal_pull'),
  ('vertical_push',   'vertical_pull'),
  ('quad_dominant',   'hip_hinge'),
  ('elbow_flexion',   'elbow_extension');
