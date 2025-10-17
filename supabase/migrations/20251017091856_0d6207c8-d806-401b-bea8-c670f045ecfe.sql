-- Add timezone column to user_profiles
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS timezone text DEFAULT 'Europe/Moscow';

COMMENT ON COLUMN user_profiles.timezone IS 'User timezone in IANA format (e.g., Europe/Moscow)';