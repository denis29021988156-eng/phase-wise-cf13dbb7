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

    // Get the user from the Authorization header
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'No authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { data: { user }, error: authError } = await supabase.auth.getUser(
      authHeader.replace('Bearer ', '')
    );

    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get Microsoft token
    const { data: tokenData, error: tokenError } = await supabase
      .from('user_tokens')
      .select('access_token, refresh_token, expires_at')
      .eq('user_id', user.id)
      .in('provider', ['microsoft', 'azure'])
      .maybeSingle();

    if (tokenError || !tokenData) {
      return new Response(
        JSON.stringify({ 
          connected: false,
          error: 'Microsoft account not connected' 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    let accessToken = tokenData.access_token;

    // Check if token needs refresh
    if (tokenData.expires_at) {
      const expiresAt = new Date(tokenData.expires_at);
      const now = new Date();
      const fiveMinutesFromNow = new Date(now.getTime() + 5 * 60000);
      
      if (expiresAt < fiveMinutesFromNow) {
        console.log('Token expired or expiring soon, refreshing...');
        
        const refreshResponse = await fetch('https://login.microsoftonline.com/common/oauth2/v2.0/token', {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({
            client_id: Deno.env.get('MICROSOFT_CLIENT_ID')!,
            client_secret: Deno.env.get('MICROSOFT_CLIENT_SECRET')!,
            refresh_token: tokenData.refresh_token || '',
            grant_type: 'refresh_token',
            scope: 'openid profile email offline_access Calendars.ReadWrite User.Read MailboxSettings.Read',
          }),
        });

        if (!refreshResponse.ok) {
          console.error('Token refresh failed');
          return new Response(
            JSON.stringify({ 
              connected: false,
              error: 'Failed to refresh token' 
            }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        const refreshData = await refreshResponse.json();
        accessToken = refreshData.access_token;

        await supabase
          .from('user_tokens')
          .update({
            access_token: refreshData.access_token,
            refresh_token: refreshData.refresh_token || tokenData.refresh_token,
            expires_at: new Date(Date.now() + refreshData.expires_in * 1000).toISOString(),
          })
          .eq('user_id', user.id)
          .in('provider', ['microsoft', 'azure']);
      }
    }

    // Get mailbox settings from Microsoft Graph API
    const settingsResponse = await fetch('https://graph.microsoft.com/v1.0/me/mailboxSettings', {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
      },
    });

    if (!settingsResponse.ok) {
      const errorText = await settingsResponse.text();
      console.error('Failed to fetch mailbox settings:', errorText);
      return new Response(
        JSON.stringify({ 
          connected: true,
          error: 'Failed to fetch mailbox settings',
          outlookTimezone: null 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const settings = await settingsResponse.json();
    const outlookTimezone = settings.timeZone;

    console.log('Outlook timezone:', outlookTimezone);

    return new Response(
      JSON.stringify({ 
        connected: true,
        outlookTimezone: outlookTimezone 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in check-outlook-timezone:', error);
    return new Response(
      JSON.stringify({ 
        connected: false,
        error: error instanceof Error ? error.message : 'Unknown error' 
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
