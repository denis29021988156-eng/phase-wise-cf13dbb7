-- Create symptoms log table
CREATE TABLE public.symptom_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  energy INTEGER CHECK (energy >= 1 AND energy <= 5),
  mood TEXT[] DEFAULT '{}',
  physical_symptoms TEXT[] DEFAULT '{}',
  sleep_quality INTEGER CHECK (sleep_quality >= 1 AND sleep_quality <= 5),
  stress_level INTEGER CHECK (stress_level >= 1 AND stress_level <= 5),
  wellness_index INTEGER CHECK (wellness_index >= 0 AND wellness_index <= 100),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, date)
);

-- Enable RLS
ALTER TABLE public.symptom_logs ENABLE ROW LEVEL SECURITY;

-- Create policy for users to access their own logs
CREATE POLICY "Users can access their own symptom logs"
ON public.symptom_logs
FOR ALL
USING (auth.uid() = user_id);

-- Create trigger for updated_at
CREATE TRIGGER update_symptom_logs_updated_at
BEFORE UPDATE ON public.symptom_logs
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();