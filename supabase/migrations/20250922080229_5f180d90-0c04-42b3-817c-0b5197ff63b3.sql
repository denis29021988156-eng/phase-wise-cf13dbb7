-- Remove the foreign key constraint that's causing issues
ALTER TABLE public.user_cycles DROP CONSTRAINT IF EXISTS user_cycles_user_id_fkey;

-- Add a check to ensure user_id is valid UUID format, but don't require foreign key to auth.users
-- since auth.users is managed by Supabase and may have timing issues during OAuth flow
ALTER TABLE public.user_cycles 
ADD CONSTRAINT user_cycles_user_id_uuid_check 
CHECK (user_id IS NOT NULL AND user_id ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$');