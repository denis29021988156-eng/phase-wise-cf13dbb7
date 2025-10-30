-- Create table for user-specific event coefficients learned from AI
CREATE TABLE public.user_event_coefficients (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  event_title TEXT NOT NULL,
  base_coefficient NUMERIC NOT NULL,
  cycle_menstrual NUMERIC DEFAULT 0,
  cycle_follicular NUMERIC DEFAULT 0,
  cycle_ovulation NUMERIC DEFAULT 0,
  cycle_luteal NUMERIC DEFAULT 0,
  time_morning NUMERIC DEFAULT 0,
  time_afternoon NUMERIC DEFAULT 0,
  time_evening NUMERIC DEFAULT 0,
  stress_coefficient NUMERIC DEFAULT 0.2,
  category TEXT,
  is_ai_generated BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, event_title)
);

-- Enable RLS
ALTER TABLE public.user_event_coefficients ENABLE ROW LEVEL SECURITY;

-- Users can view their own coefficients
CREATE POLICY "Users can view their own event coefficients"
  ON public.user_event_coefficients
  FOR SELECT
  USING (auth.uid() = user_id);

-- Users can insert their own coefficients
CREATE POLICY "Users can insert their own event coefficients"
  ON public.user_event_coefficients
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can update their own coefficients
CREATE POLICY "Users can update their own event coefficients"
  ON public.user_event_coefficients
  FOR UPDATE
  USING (auth.uid() = user_id);

-- Users can delete their own coefficients
CREATE POLICY "Users can delete their own event coefficients"
  ON public.user_event_coefficients
  FOR DELETE
  USING (auth.uid() = user_id);

-- Create index for faster lookups
CREATE INDEX idx_user_event_coefficients_user_title ON public.user_event_coefficients(user_id, event_title);

-- Trigger to update updated_at
CREATE TRIGGER update_user_event_coefficients_updated_at
  BEFORE UPDATE ON public.user_event_coefficients
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();