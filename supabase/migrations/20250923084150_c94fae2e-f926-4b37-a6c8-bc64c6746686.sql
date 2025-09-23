-- Add the missing updated_at column to user_tokens table
ALTER TABLE public.user_tokens 
ADD COLUMN updated_at TIMESTAMP WITH TIME ZONE DEFAULT now();