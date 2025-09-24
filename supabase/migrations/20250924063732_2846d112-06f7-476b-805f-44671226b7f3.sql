-- Add menstrual_length column to user_cycles table
ALTER TABLE public.user_cycles 
ADD COLUMN menstrual_length INTEGER DEFAULT 5;