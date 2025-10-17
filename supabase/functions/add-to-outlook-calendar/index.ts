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
    const { userId, eventData } = await req.json();
    console.log('Adding event to Outlook Calendar:', { userId, eventData });

    if (!userId || !eventData) {
      return new Response(
        JSON.stringify({ success: false, error: 'Missing required parameters' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get Microsoft token
    const { data: tokenData, error: tokenError } = await supabase
      .from('user_tokens')
      .select('access_token, refresh_token, expires_at')
      .eq('user_id', userId)
      .in('provider', ['microsoft', 'azure'])
      .maybeSingle();

    if (tokenError || !tokenData) {
      console.error('Error fetching Microsoft token:', tokenError);
      return new Response(
        JSON.stringify({ success: false, error: 'Microsoft account not connected' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
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
            scope: 'openid profile email offline_access Calendars.ReadWrite User.Read',
          }),
        });

        if (!refreshResponse.ok) {
          const errorText = await refreshResponse.text();
          console.error('Token refresh failed:', errorText);
          return new Response(
            JSON.stringify({ success: false, error: 'Failed to refresh Microsoft token' }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 401 }
          );
        }

        const refreshData = await refreshResponse.json();
        accessToken = refreshData.access_token;

        // Update tokens in database
        await supabase
          .from('user_tokens')
          .update({
            access_token: refreshData.access_token,
            refresh_token: refreshData.refresh_token || tokenData.refresh_token,
            expires_at: new Date(Date.now() + refreshData.expires_in * 1000).toISOString(),
          })
          .eq('user_id', userId)
          .in('provider', ['microsoft', 'azure']);
      }
    }

    // Create event in Outlook Calendar
    // Use UTC time for consistency with Google Calendar approach
    // Remove Z suffix and milliseconds, then specify UTC timezone
    const sanitize = (s: string) => s.replace(/Z$/, '').replace(/\.\d+$/, '');
    const startUTC = sanitize(eventData.startTime);
    const endUTC = sanitize(eventData.endTime);

    const eventBody = {
      subject: eventData.title,
      body: {
        contentType: 'Text',
        content: eventData.description || ''
      },
      start: {
        dateTime: startUTC,
        timeZone: 'UTC'
      },
      end: {
        dateTime: endUTC,
        timeZone: 'UTC'
      }
    };

    console.log('Creating Outlook event:', eventBody);

    const createResponse = await fetch('https://graph.microsoft.com/v1.0/me/events', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(eventBody),
    });

    if (!createResponse.ok) {
      const errorText = await createResponse.text();
      console.error('Failed to create Outlook event:', errorText);
      return new Response(
        JSON.stringify({ success: false, error: 'Failed to create event in Outlook' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: createResponse.status }
      );
    }

    const createdEvent = await createResponse.json();
    console.log('Successfully created Outlook event:', createdEvent.id);

    return new Response(
      JSON.stringify({ 
        success: true, 
        microsoftEventId: createdEvent.id 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in add-to-outlook-calendar:', error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
