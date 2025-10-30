-- Enable realtime for symptom_logs table
ALTER TABLE public.symptom_logs REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.symptom_logs;

-- Enable realtime for events table
ALTER TABLE public.events REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.events;

-- Enable realtime for user_profiles table
ALTER TABLE public.user_profiles REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.user_profiles;

-- Enable realtime for user_cycles table
ALTER TABLE public.user_cycles REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.user_cycles;