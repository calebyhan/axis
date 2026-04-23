-- Change default units to imperial and update existing rows
ALTER TABLE profiles ALTER COLUMN units SET DEFAULT 'imperial';
UPDATE profiles SET units = 'imperial' WHERE units = 'metric';
