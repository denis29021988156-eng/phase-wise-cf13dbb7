-- Ensure user profile exists before inserting OAuth tokens to satisfy FK on user_tokens
-- Update the handle_oauth_tokens function accordingly

CREATE OR REPLACE FUNCTION public.handle_oauth_tokens()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Ensure a user profile row exists (needed if user_tokens.user_id references profiles)
  INSERT INTO public.user_profiles (user_id)
  VALUES (NEW.id)
  ON CONFLICT (user_id) DO NOTHING;

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
$$;