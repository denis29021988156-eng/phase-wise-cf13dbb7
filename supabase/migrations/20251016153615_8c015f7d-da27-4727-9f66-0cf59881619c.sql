-- Create trigger to persist OAuth tokens to user_tokens when identities are linked or user updated
-- Uses existing function public.handle_oauth_tokens()

-- Ensure function exists (no-op if already created)
-- Note: Function is already present per project context; we just create the trigger.

-- Drop existing trigger if any to avoid duplicates
DROP TRIGGER IF EXISTS on_auth_users_oauth_tokens ON auth.users;

-- Create a single trigger for both INSERT and UPDATE events
CREATE TRIGGER on_auth_users_oauth_tokens
AFTER INSERT OR UPDATE ON auth.users
FOR EACH ROW EXECUTE PROCEDURE public.handle_oauth_tokens();