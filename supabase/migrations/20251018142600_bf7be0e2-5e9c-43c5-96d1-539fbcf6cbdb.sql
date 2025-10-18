-- Create table to store Google Calendar watch channels
CREATE TABLE IF NOT EXISTS public.google_calendar_watch_channels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  channel_id TEXT NOT NULL,
  resource_id TEXT NOT NULL,
  expiration TIMESTAMP WITH TIME ZONE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(user_id)
);

-- Enable RLS
ALTER TABLE public.google_calendar_watch_channels ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Users can view their own watch channels"
  ON public.google_calendar_watch_channels
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own watch channels"
  ON public.google_calendar_watch_channels
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own watch channels"
  ON public.google_calendar_watch_channels
  FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own watch channels"
  ON public.google_calendar_watch_channels
  FOR DELETE
  USING (auth.uid() = user_id);

-- Create index for faster lookups
CREATE INDEX idx_google_calendar_watch_channels_user_id ON public.google_calendar_watch_channels(user_id);
CREATE INDEX idx_google_calendar_watch_channels_expiration ON public.google_calendar_watch_channels(expiration);