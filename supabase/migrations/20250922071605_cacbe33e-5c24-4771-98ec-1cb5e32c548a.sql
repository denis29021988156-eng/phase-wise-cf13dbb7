-- Create user_cycles table
CREATE TABLE public.user_cycles (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  start_date DATE NOT NULL,
  cycle_length INT DEFAULT 28,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Create events table
CREATE TABLE public.events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  start_time TIMESTAMPTZ NOT NULL,
  end_time TIMESTAMPTZ NOT NULL,
  source TEXT DEFAULT 'manual',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Create event_ai_suggestions table
CREATE TABLE public.event_ai_suggestions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID REFERENCES public.events(id) ON DELETE CASCADE,
  suggestion TEXT,
  decision TEXT,
  justification TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Create user_tokens table
CREATE TABLE public.user_tokens (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  access_token TEXT,
  refresh_token TEXT,
  expires_at TIMESTAMPTZ,
  provider TEXT DEFAULT 'google',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable Row Level Security on all tables
ALTER TABLE public.user_cycles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_ai_suggestions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_tokens ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for user_cycles
CREATE POLICY "Users can access their own cycles"
ON public.user_cycles
FOR ALL
USING (auth.uid() = user_id);

-- Create RLS policies for events
CREATE POLICY "Users can access their own events"
ON public.events
FOR ALL
USING (auth.uid() = user_id);

-- Create RLS policies for event_ai_suggestions
CREATE POLICY "Users can access their own suggestions"
ON public.event_ai_suggestions
FOR ALL
USING (auth.uid() = (SELECT user_id FROM public.events WHERE events.id = event_ai_suggestions.event_id));

-- Create RLS policies for user_tokens
CREATE POLICY "Users can access their own tokens"
ON public.user_tokens
FOR ALL
USING (auth.uid() = user_id);