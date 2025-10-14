-- Create wellness predictions cache table
CREATE TABLE IF NOT EXISTS public.wellness_predictions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  prediction_date DATE NOT NULL,
  predictions JSONB NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, prediction_date)
);

-- Enable RLS
ALTER TABLE public.wellness_predictions ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Users can view their own predictions"
  ON public.wellness_predictions
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own predictions"
  ON public.wellness_predictions
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own predictions"
  ON public.wellness_predictions
  FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own predictions"
  ON public.wellness_predictions
  FOR DELETE
  USING (auth.uid() = user_id);

-- Index for faster lookups
CREATE INDEX idx_wellness_predictions_user_date 
  ON public.wellness_predictions(user_id, prediction_date);