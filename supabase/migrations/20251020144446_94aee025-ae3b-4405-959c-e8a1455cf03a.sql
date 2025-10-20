-- Add language column to user_profiles table
ALTER TABLE public.user_profiles 
ADD COLUMN IF NOT EXISTS language TEXT DEFAULT 'ru';

-- Add a check constraint to ensure valid language values
ALTER TABLE public.user_profiles 
ADD CONSTRAINT valid_language CHECK (language IN ('ru', 'en'));