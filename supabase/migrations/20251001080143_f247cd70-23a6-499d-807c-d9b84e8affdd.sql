-- Add google_event_id to events table to track Google Calendar mapping
ALTER TABLE public.events
ADD COLUMN IF NOT EXISTS google_event_id TEXT;

-- Helpful index for lookups by google_event_id
CREATE INDEX IF NOT EXISTS idx_events_google_event_id ON public.events(google_event_id);

-- No changes to RLS needed; existing policies continue to apply