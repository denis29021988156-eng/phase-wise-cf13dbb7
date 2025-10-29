-- Add email column to user_profiles for secure user lookup
ALTER TABLE public.user_profiles 
ADD COLUMN email text;

-- Add unique constraint on email
CREATE UNIQUE INDEX user_profiles_email_key ON public.user_profiles(email) WHERE email IS NOT NULL;

-- Add channel_token to google_calendar_watch_channels for webhook verification
ALTER TABLE public.google_calendar_watch_channels 
ADD COLUMN channel_token text;

-- Populate email from auth.users for existing users
UPDATE public.user_profiles 
SET email = auth.users.email
FROM auth.users
WHERE user_profiles.user_id = auth.users.id;