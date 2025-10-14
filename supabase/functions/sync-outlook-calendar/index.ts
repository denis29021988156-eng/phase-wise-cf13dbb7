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
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);
    
    if (userError || !user) {
      console.error('Auth error:', userError);
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { userId } = await req.json();

    if (!userId || userId !== user.id) {
      return new Response(
        JSON.stringify({ error: 'Invalid user ID' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Fetching Microsoft tokens for user:', userId);

    // Get Microsoft tokens
    const { data: tokenData, error: tokenError } = await supabase
      .from('user_tokens')
      .select('access_token, refresh_token, expires_at')
      .eq('user_id', userId)
      .eq('provider', 'microsoft')
      .single();

    if (tokenError || !tokenData) {
      console.error('Error fetching Microsoft tokens:', tokenError);
      return new Response(
        JSON.stringify({ error: 'Microsoft account not connected', details: tokenError?.message }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
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
          }),
        });

        if (!refreshResponse.ok) {
          const errorText = await refreshResponse.text();
          console.error('Token refresh failed:', errorText);
          return new Response(
            JSON.stringify({ error: 'Failed to refresh Microsoft token', details: errorText }),
            { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
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
          .eq('provider', 'microsoft');
      }
    }

    console.log('Fetching events from Microsoft Calendar...');

    // Fetch events from Microsoft Graph API
    const startDateTime = new Date().toISOString();
    const endDateTime = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
    
    const calendarResponse = await fetch(
      `https://graph.microsoft.com/v1.0/me/calendarView?startDateTime=${startDateTime}&endDateTime=${endDateTime}&$orderby=start/dateTime`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
      }
    );

    if (!calendarResponse.ok) {
      const errorText = await calendarResponse.text();
      console.error('Calendar fetch failed with status:', calendarResponse.status);
      console.error('Error details:', errorText);
      console.error('Request URL:', `https://graph.microsoft.com/v1.0/me/calendarView?startDateTime=${startDateTime}&endDateTime=${endDateTime}&$orderby=start/dateTime`);
      return new Response(
        JSON.stringify({ 
          error: 'Failed to fetch calendar', 
          details: errorText,
          status: calendarResponse.status,
          hint: calendarResponse.status === 401 ? 'Token may be invalid or missing required scopes (Calendars.ReadWrite)' : 'Unknown error'
        }),
        { status: calendarResponse.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const calendarData = await calendarResponse.json();
    const outlookEvents = calendarData.value || [];

    console.log(`Found ${outlookEvents.length} Outlook events`);

    let insertedCount = 0;
    let skippedCount = 0;

    for (const outlookEvent of outlookEvents) {
      // Skip all-day events or events without proper times
      if (outlookEvent.isAllDay || !outlookEvent.start?.dateTime || !outlookEvent.end?.dateTime) {
        skippedCount++;
        continue;
      }

      const startTime = new Date(outlookEvent.start.dateTime).toISOString();
      const endTime = new Date(outlookEvent.end.dateTime).toISOString();

      // Check if event already exists
      const { data: existingEvent } = await supabase
        .from('events')
        .select('id')
        .eq('user_id', userId)
        .eq('start_time', startTime)
        .eq('title', outlookEvent.subject)
        .single();

      if (existingEvent) {
        skippedCount++;
        continue;
      }

      // Insert new event
      const { error: insertError } = await supabase
        .from('events')
        .insert({
          user_id: userId,
          title: outlookEvent.subject || 'Без названия',
          start_time: startTime,
          end_time: endTime,
          source: 'outlook',
        });

      if (insertError) {
        console.error('Error inserting event:', insertError);
      } else {
        insertedCount++;
      }
    }

    console.log(`Sync completed: ${insertedCount} inserted, ${skippedCount} skipped`);

    return new Response(
      JSON.stringify({
        success: true,
        inserted: insertedCount,
        skipped: skippedCount,
        total: outlookEvents.length,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );

  } catch (error) {
    console.error('Error in sync-outlook-calendar:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
