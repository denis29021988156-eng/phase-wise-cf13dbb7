-- Remove the foreign key constraint that's causing issues
ALTER TABLE public.user_cycles DROP CONSTRAINT IF EXISTS user_cycles_user_id_fkey;

-- Ensure user_id is not null
ALTER TABLE public.user_cycles ALTER COLUMN user_id SET NOT NULL;