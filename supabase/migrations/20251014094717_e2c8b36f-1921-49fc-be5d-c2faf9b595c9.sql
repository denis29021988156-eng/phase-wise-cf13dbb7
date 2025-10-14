-- Fix 1: Make events.user_id NOT NULL (security fix)
-- First ensure all events have user_id (already verified - all 12 events have it)
ALTER TABLE public.events 
ALTER COLUMN user_id SET NOT NULL;

-- Fix 2: Add performance index for frequent queries
CREATE INDEX IF NOT EXISTS idx_events_user_start_time 
ON public.events(user_id, start_time DESC);

-- Fix 3: Add index for symptom logs queries
CREATE INDEX IF NOT EXISTS idx_symptom_logs_user_date 
ON public.symptom_logs(user_id, date DESC);

-- Fix 4: Optimize wellness_index queries
CREATE INDEX IF NOT EXISTS idx_symptom_logs_wellness 
ON public.symptom_logs(user_id, wellness_index) 
WHERE wellness_index IS NOT NULL;