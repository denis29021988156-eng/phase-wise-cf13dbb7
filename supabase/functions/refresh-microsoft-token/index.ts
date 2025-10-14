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
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const { userId } = await req.json();
    if (!userId || userId !== user.id) {
      return new Response(JSON.stringify({ error: 'Invalid user ID' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    console.log('Refreshing Microsoft token for user:', userId);

    const { data: tokenData, error: tokenError } = await supabase
      .from('user_tokens')
      .select('access_token, refresh_token, expires_at')
      .eq('user_id', userId)
      .eq('provider', 'microsoft')
      .single();

    if (tokenError || !tokenData) {
      console.error('Token record not found:', tokenError);
      return new Response(JSON.stringify({ error: 'Microsoft account not connected' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    if (!tokenData.refresh_token) {
      return new Response(JSON.stringify({ error: 'No refresh token available' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const refreshResponse = await fetch('https://login.microsoftonline.com/common/oauth2/v2.0/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: Deno.env.get('MICROSOFT_CLIENT_ID')!,
        client_secret: Deno.env.get('MICROSOFT_CLIENT_SECRET')!,
        refresh_token: tokenData.refresh_token,
        grant_type: 'refresh_token',
        scope: 'openid profile email offline_access Calendars.ReadWrite User.Read',
      }),
    });

    if (!refreshResponse.ok) {
      const errText = await refreshResponse.text();
      console.error('Microsoft token refresh failed:', errText);
      return new Response(
        JSON.stringify({ error: 'Failed to refresh token', details: errText }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const refreshData = await refreshResponse.json();

    await supabase
      .from('user_tokens')
      .update({
        access_token: refreshData.access_token,
        refresh_token: refreshData.refresh_token || tokenData.refresh_token,
        expires_at: new Date(Date.now() + refreshData.expires_in * 1000).toISOString(),
      })
      .eq('user_id', userId)
      .eq('provider', 'microsoft');

    const mask = (t?: string) => (t ? `${t.slice(0,5)}...${t.slice(-5)}` : 'undefined');
    console.log('Refreshed Microsoft access token (masked):', mask(refreshData.access_token));

    return new Response(
      JSON.stringify({ success: true, accessToken: refreshData.access_token, expiresIn: refreshData.expires_in }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error in refresh-microsoft-token:', error);
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});