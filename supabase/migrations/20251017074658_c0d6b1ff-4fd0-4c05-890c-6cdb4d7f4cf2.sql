-- Clean up incorrect Microsoft tokens that are actually Google tokens
-- These were saved by useMicrosoftTokens when linking identities instead of direct login

DELETE FROM public.user_tokens 
WHERE provider = 'microsoft' 
AND access_token LIKE 'ya29%'; -- Google tokens start with ya29

-- Add comment explaining the fix
COMMENT ON TABLE public.user_tokens IS 'Stores OAuth tokens for external providers. Note: tokens are only saved on direct provider login, not when linking identities.';