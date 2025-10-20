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

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
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
    
    // Store auth token for passing to other functions
    const authToken = token;

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
      .maybeSingle();

    if (tokenError || !tokenData) {
      console.error('Error fetching Microsoft tokens:', tokenError);
      return new Response(
        JSON.stringify({ error: 'Microsoft account not connected', details: tokenError?.message }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

let accessToken = tokenData.access_token;
const maskToken = (t?: string) => t ? `${t.slice(0,5)}...${t.slice(-5)}` : 'undefined';
console.log('Access token (masked):', maskToken(accessToken));
console.log('Has refresh token:', Boolean(tokenData.refresh_token));
if (!accessToken) {
  console.error('No access token available for Microsoft Graph');
  return new Response(
    JSON.stringify({ error: 'No access token', details: 'Microsoft account connected but access token is missing' }),
    { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}
    
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
          
          // If refresh token is invalid (AADSTS70000), delete tokens from database
          if (errorText.includes('AADSTS70000') || errorText.includes('invalid_grant')) {
            console.log('Refresh token invalid - deleting tokens from database');
            await supabase
              .from('user_tokens')
              .delete()
              .eq('user_id', userId)
              .eq('provider', 'microsoft');
            
            return new Response(
              JSON.stringify({ 
                error: 'outlook_reconnect_required',
                message: 'Microsoft токен истек. Требуется переподключение Outlook Calendar.',
                details: errorText 
              }),
              { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
          }
          
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
console.log('Using access token (masked):', maskToken(accessToken));

    // Fetch events from Microsoft Graph API
    // Request times in UTC by setting Prefer header
    const startDateTime = new Date().toISOString();
    const endDateTime = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
    
    const calendarResponse = await fetch(
      `https://graph.microsoft.com/v1.0/me/calendarView?startDateTime=${startDateTime}&endDateTime=${endDateTime}&$orderby=start/dateTime`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
          'Prefer': 'outlook.timezone="UTC"', // Request times in UTC
        },
      }
    );

    // Handle 401 by attempting a token refresh and retrying once
    let finalResponse = calendarResponse;
    if (!finalResponse.ok && finalResponse.status === 401 && tokenData.refresh_token) {
      try {
        console.log('401 from Graph. Attempting token refresh and retry...');
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

        if (refreshResponse.ok) {
          const refreshData = await refreshResponse.json();
          accessToken = refreshData.access_token;

          await supabase
            .from('user_tokens')
            .update({
              access_token: refreshData.access_token,
              refresh_token: refreshData.refresh_token || tokenData.refresh_token,
              expires_at: new Date(Date.now() + refreshData.expires_in * 1000).toISOString(),
            })
            .eq('user_id', userId)
            .eq('provider', 'microsoft');

          finalResponse = await fetch(
            `https://graph.microsoft.com/v1.0/me/calendarView?startDateTime=${startDateTime}&endDateTime=${endDateTime}&$orderby=start/dateTime`,
            {
              headers: {
                Authorization: `Bearer ${accessToken}`,
                'Content-Type': 'application/json',
                'Prefer': 'outlook.timezone="UTC"', // Request times in UTC
              },
            }
          );
        } else {
          const errText = await refreshResponse.text();
          console.error('Refresh after 401 failed:', errText);
          
          // If refresh token is invalid, delete tokens from database
          if (errText.includes('AADSTS70000') || errText.includes('invalid_grant')) {
            console.log('Refresh token invalid during retry - deleting tokens');
            await supabase
              .from('user_tokens')
              .delete()
              .eq('user_id', userId)
              .eq('provider', 'microsoft');
          }
        }
      } catch (e) {
        console.error('Unexpected error during 401 refresh flow:', e);
      }
    }

    if (!finalResponse.ok) {
      const errorText = await finalResponse.text();
      const wwwAuth = finalResponse.headers.get('www-authenticate') || finalResponse.headers.get('WWW-Authenticate') || '';
      console.error('Calendar fetch failed with status:', finalResponse.status);
      console.error('WWW-Authenticate:', wwwAuth);
      console.error('Error details:', errorText);
      console.error('Request URL:', `https://graph.microsoft.com/v1.0/me/calendarView?startDateTime=${startDateTime}&endDateTime=${endDateTime}&$orderby=start/dateTime`);
      return new Response(
        JSON.stringify({ 
          error: 'Failed to fetch calendar', 
          details: errorText,
          status: finalResponse.status,
          wwwAuthenticate: wwwAuth,
          hint: finalResponse.status === 401 ? 'Token invalid/expired or missing scopes. Try re-login to refresh consent.' : 'Unknown error'
        }),
        { status: finalResponse.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const calendarData = await finalResponse.json();
    const outlookEvents = calendarData.value || [];

    console.log(`Found ${outlookEvents.length} Outlook events`);

    // Get user cycle data for AI suggestions
    const { data: cycleData, error: cycleError } = await supabase
      .from('user_cycles')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (cycleError || !cycleData) {
      console.log('No cycle data found, skipping AI suggestions');
    }

    // Get user language preference
    const { data: userProfile } = await supabase
      .from('user_profiles')
      .select('language')
      .eq('user_id', userId)
      .maybeSingle();
    
    const userLanguage = userProfile?.language || 'ru';

    let insertedCount = 0;
    let skippedCount = 0;
    let suggestionsCount = 0;

    for (const outlookEvent of outlookEvents) {
      // Skip all-day events or events without proper times
      if (outlookEvent.isAllDay || !outlookEvent.start?.dateTime || !outlookEvent.end?.dateTime) {
        skippedCount++;
        continue;
      }

      // With Prefer: outlook.timezone="UTC" header, Microsoft Graph returns times in UTC
      // The dateTime will be in format: "2025-10-17T18:00:00.0000000"
      // And timeZone will be "UTC"
      
      let startTime: string;
      let endTime: string;
      
      try {
        const startDateStr = outlookEvent.start.dateTime;
        const endDateStr = outlookEvent.end.dateTime;
        const startTZ = outlookEvent.start.timeZone || 'UTC';
        const endTZ = outlookEvent.end.timeZone || 'UTC';
        
        console.log(`\n=== Event: ${outlookEvent.subject} ===`);
        console.log(`  Original start: ${startDateStr} (TZ: ${startTZ})`);
        console.log(`  Original end: ${endDateStr} (TZ: ${endTZ})`);
        
        // Since we requested UTC times with Prefer: outlook.timezone="UTC",
        // Microsoft returns times in UTC format but without Z suffix
        // We need to add Z to indicate it's UTC time
        const startWithZ = startDateStr.includes('Z') ? startDateStr : startDateStr + 'Z';
        const endWithZ = endDateStr.includes('Z') ? endDateStr : endDateStr + 'Z';
        
        startTime = new Date(startWithZ).toISOString();
        endTime = new Date(endWithZ).toISOString();
        
        console.log(`  Parsed as UTC: ${startTime} to ${endTime}`);
        
        // Verify parsing
        const startDate = new Date(startTime);
        if (isNaN(startDate.getTime())) {
          throw new Error(`Invalid start time: ${startDateStr}`);
        }
      } catch (parseError) {
        console.error('Error parsing event times:', parseError);
        console.error('  Event data:', JSON.stringify(outlookEvent, null, 2));
        skippedCount++;
        continue;
      }

      // Check if event already exists
      const { data: existingEvent } = await supabase
        .from('events')
        .select('id')
        .eq('user_id', userId)
        .eq('start_time', startTime)
        .eq('title', outlookEvent.subject)
        .single();

      if (existingEvent) {
        console.log('Event already exists:', outlookEvent.subject);
        
        // Check if event has AI suggestion
        if (cycleData) {
          const { data: existingSuggestion } = await supabase
            .from('event_ai_suggestions')
            .select('id')
            .eq('event_id', existingEvent.id)
            .single();
          
          // If no suggestion exists, generate one
          if (!existingSuggestion) {
            try {
              const eventDate = new Date(startTime);
              const startDate = new Date(cycleData.start_date);
              const diffInDays = Math.floor((eventDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
              const eventCycleDay = ((diffInDays % cycleData.cycle_length) + 1);
              const adjustedCycleDay = eventCycleDay > 0 ? eventCycleDay : cycleData.cycle_length + eventCycleDay;

              console.log(`Generating missing AI suggestion for existing event "${outlookEvent.subject}" on cycle day ${adjustedCycleDay}`);

              const { data: suggestionData, error: suggestionError } = await supabase.functions.invoke('generate-ai-suggestion', {
                body: {
                  event: {
                    title: outlookEvent.subject || 'Без названия',
                    start_time: startTime,
                    description: outlookEvent.bodyPreview || ''
                  },
                  cycleData: {
                    cycleDay: adjustedCycleDay,
                    cycleLength: cycleData.cycle_length,
                    startDate: cycleData.start_date,
                    language: userLanguage
                  }
                },
                headers: {
                  Authorization: `Bearer ${authToken}`
                }
              });

              if (!suggestionError && suggestionData?.suggestion) {
                await supabase
                  .from('event_ai_suggestions')
                  .insert({
                    event_id: existingEvent.id,
                    suggestion: suggestionData.suggestion,
                    justification: suggestionData.justification || `ИИ-совет для ${adjustedCycleDay} дня цикла`,
                    decision: 'generated'
                  });

                suggestionsCount++;
                console.log(`AI suggestion created for existing event: ${outlookEvent.subject}`);
              }
            } catch (aiError) {
              console.error('Error generating AI suggestion for existing event:', outlookEvent.subject, aiError);
            }
          }
        }
        
        skippedCount++;
        continue;
      }

      // Insert new event with Microsoft event ID
      const { data: newEvent, error: insertError } = await supabase
        .from('events')
        .insert({
          user_id: userId,
          title: outlookEvent.subject || 'Без названия',
          start_time: startTime,
          end_time: endTime,
          source: 'outlook',
          microsoft_event_id: outlookEvent.id, // Сохранить ID события из Outlook
        })
        .select()
        .single();

      if (insertError) {
        console.error('Error inserting event:', insertError);
        continue;
      }
      
      insertedCount++;

      // Generate AI suggestion if cycle data exists
      if (cycleData && newEvent) {
        try {
          const eventDate = new Date(startTime);
          const startDate = new Date(cycleData.start_date);
          const diffInDays = Math.floor((eventDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
          const eventCycleDay = ((diffInDays % cycleData.cycle_length) + 1);
          const adjustedCycleDay = eventCycleDay > 0 ? eventCycleDay : cycleData.cycle_length + eventCycleDay;

          console.log(`Generating AI suggestion for event "${newEvent.title}" on cycle day ${adjustedCycleDay}`);

          const { data: suggestionData, error: suggestionError } = await supabase.functions.invoke('generate-ai-suggestion', {
            body: {
              event: {
                title: newEvent.title,
                start_time: startTime,
                description: outlookEvent.bodyPreview || ''
              },
              cycleData: {
                cycleDay: adjustedCycleDay,
                cycleLength: cycleData.cycle_length,
                startDate: cycleData.start_date,
                language: userLanguage
              }
            },
            headers: {
              Authorization: `Bearer ${authToken}`
            }
          });

          if (!suggestionError && suggestionData?.suggestion) {
            await supabase
              .from('event_ai_suggestions')
              .insert({
                event_id: newEvent.id,
                suggestion: suggestionData.suggestion,
                justification: suggestionData.justification || `ИИ-совет для ${adjustedCycleDay} дня цикла`,
                decision: 'generated'
              });

            suggestionsCount++;
            console.log(`AI suggestion created for event: ${newEvent.title}`);
          } else {
            console.error('Error with AI suggestion:', suggestionError);
          }
        } catch (aiError) {
          console.error('Error generating AI suggestion for event:', newEvent.title, aiError);
        }
      }
    }

    console.log(`Sync completed: ${insertedCount} inserted, ${skippedCount} skipped, ${suggestionsCount} AI suggestions`);

    return new Response(
      JSON.stringify({
        success: true,
        inserted: insertedCount,
        skipped: skippedCount,
        total: outlookEvents.length,
        suggestionsCount: suggestionsCount,
        message: `Загружено ${insertedCount} событий с ${suggestionsCount} ИИ-советами`
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
