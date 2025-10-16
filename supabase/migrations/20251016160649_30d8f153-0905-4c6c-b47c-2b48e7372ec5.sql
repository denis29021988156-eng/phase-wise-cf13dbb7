
-- Fix user_tokens table to support multiple providers per user
-- Drop old primary key and create composite unique constraint

ALTER TABLE public.user_tokens DROP CONSTRAINT IF EXISTS user_tokens_pkey;

-- Add composite primary key on (user_id, provider)
ALTER TABLE public.user_tokens 
  ADD PRIMARY KEY (user_id, provider);

-- Ensure provider is NOT NULL (it was nullable before)
ALTER TABLE public.user_tokens 
  ALTER COLUMN provider SET NOT NULL;
