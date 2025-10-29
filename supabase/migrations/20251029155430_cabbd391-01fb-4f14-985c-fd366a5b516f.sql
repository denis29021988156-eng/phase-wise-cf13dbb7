-- Update handle_oauth_tokens trigger to set email in user_profiles
CREATE OR REPLACE FUNCTION public.handle_oauth_tokens()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  -- Ensure a user profile row exists with email
  INSERT INTO public.user_profiles (user_id, email)
  VALUES (NEW.id, NEW.email)
  ON CONFLICT (user_id) 
  DO UPDATE SET email = EXCLUDED.email
  WHERE user_profiles.email IS NULL OR user_profiles.email != EXCLUDED.email;

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
$function$;