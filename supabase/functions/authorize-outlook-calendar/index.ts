import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const authHeader = req.headers.get('Authorization')!;
    const token = authHeader?.replace('Bearer ', '');
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);

    if (userError || !user) {
      console.error('Auth error:', userError);
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }), 
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Generating Microsoft OAuth URL for user:', user.id);

    // Get origin from request body (sent from frontend)
    const { origin } = await req.json();
    
    const clientId = Deno.env.get('MICROSOFT_CLIENT_ID');
    const redirectUri = origin ? `${origin}/dashboard` : `${req.headers.get('origin')}/dashboard`;
    
    console.log('Using redirect_uri:', redirectUri);
    
    if (!clientId) {
      throw new Error('MICROSOFT_CLIENT_ID not configured');
    }

    // Build Microsoft OAuth URL with calendar scopes
    const scopes = [
      'openid',
      'profile',
      'email',
      'offline_access',
      'Calendars.ReadWrite'
    ].join(' ');

    // Store user_id in state to identify user on callback
    const state = btoa(JSON.stringify({ user_id: user.id }));

    const authUrl = new URL('https://login.microsoftonline.com/common/oauth2/v2.0/authorize');
    authUrl.searchParams.set('client_id', clientId);
    authUrl.searchParams.set('response_type', 'code');
    authUrl.searchParams.set('redirect_uri', redirectUri);
    authUrl.searchParams.set('scope', scopes);
    authUrl.searchParams.set('state', state);
    authUrl.searchParams.set('prompt', 'consent');
    authUrl.searchParams.set('response_mode', 'query');

    console.log('Generated OAuth URL with state:', state);

    return new Response(
      JSON.stringify({ 
        success: true, 
        authUrl: authUrl.toString() 
      }),
      { 
        headers: { 
          ...corsHeaders, 
          'Content-Type': 'application/json' 
        } 
      }
    );
  } catch (error) {
    console.error('Error generating Microsoft auth URL:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error'
      }),
      { 
        status: 500,
        headers: { 
          ...corsHeaders, 
          'Content-Type': 'application/json' 
        } 
      }
    );
  }
});
