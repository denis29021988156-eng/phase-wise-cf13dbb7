-- Create or update user_tokens table with proper structure
CREATE TABLE IF NOT EXISTS public.user_tokens (
  user_id UUID NOT NULL,
  provider TEXT NOT NULL DEFAULT 'google',
  access_token TEXT,
  refresh_token TEXT,
  expires_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  PRIMARY KEY (user_id, provider)
);

-- Enable RLS
ALTER TABLE public.user_tokens ENABLE ROW LEVEL SECURITY;

-- Create policies for user_tokens
CREATE POLICY "Users can view their own tokens" 
ON public.user_tokens 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own tokens" 
ON public.user_tokens 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own tokens" 
ON public.user_tokens 
FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own tokens" 
ON public.user_tokens 
FOR DELETE 
USING (auth.uid() = user_id);

-- Create trigger for automatic timestamp updates
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
NEW.updated_at = now();
RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_user_tokens_updated_at
BEFORE UPDATE ON public.user_tokens
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create function to handle OAuth token storage
CREATE OR REPLACE FUNCTION public.handle_oauth_tokens()
RETURNS TRIGGER AS $$
BEGIN
  -- Extract tokens from user metadata if they exist
  IF NEW.raw_app_meta_data ? 'provider_token' THEN
    INSERT INTO public.user_tokens (
      user_id,
      provider,
      access_token,
      refresh_token,
      expires_at
    )
    VALUES (
      NEW.id,
      COALESCE(NEW.raw_app_meta_data->>'provider', 'google'),
      NEW.raw_app_meta_data->>'provider_token',
      NEW.raw_app_meta_data->>'provider_refresh_token',
      CASE 
        WHEN NEW.raw_app_meta_data->>'expires_at' IS NOT NULL 
        THEN to_timestamp((NEW.raw_app_meta_data->>'expires_at')::bigint)
        ELSE NULL
      END
    )
    ON CONFLICT (user_id, provider) 
    DO UPDATE SET
      access_token = EXCLUDED.access_token,
      refresh_token = EXCLUDED.refresh_token,
      expires_at = EXCLUDED.expires_at,
      updated_at = now();
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;