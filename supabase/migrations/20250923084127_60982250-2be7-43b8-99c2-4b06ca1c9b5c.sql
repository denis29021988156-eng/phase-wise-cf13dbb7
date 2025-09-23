-- Check if there's a trigger on user_tokens that's causing the updated_at error
-- and add the missing updated_at column to fix the trigger
ALTER TABLE public.user_tokens 
ADD COLUMN updated_at TIMESTAMP WITH TIME ZONE DEFAULT now();

-- Create trigger for automatic timestamp updates if it doesn't exist
CREATE TRIGGER update_user_tokens_updated_at
BEFORE UPDATE ON public.user_tokens
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();