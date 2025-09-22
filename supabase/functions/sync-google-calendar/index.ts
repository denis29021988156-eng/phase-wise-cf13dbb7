import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface GoogleCalendarEvent {
  id: string;
  summary: string;
  start: {
    dateTime?: string;
    date?: string;
    timeZone?: string;
  };
  end: {
    dateTime?: string;
    date?: string;
    timeZone?: string;
  };
  description?: string;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { userId } = await req.json();
    
    console.log('Syncing Google Calendar for user:', userId);

    // Get user's Google access token
    const { data: tokenData, error: tokenError } = await supabase
      .from('user_tokens')
      .select('access_token, refresh_token, expires_at')
      .eq('user_id', userId)
      .eq('provider', 'google')
      .single();

    if (tokenError || !tokenData) {
      console.error('No Google token found for user:', userId);
      throw new Error('Google Calendar не подключен. Войдите через Google заново.');
    }

    // Check if token needs refresh
    let accessToken = tokenData.access_token;
    if (tokenData.expires_at && new Date(tokenData.expires_at) <= new Date()) {
      console.log('Token expired, attempting to refresh...');
      // For now, throw an error. In production, implement token refresh
      throw new Error('Токен Google истек. Необходимо войти заново.');
    }

    // Get events from Google Calendar (last 30 days and next 30 days)
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 30);
    const endDate = new Date();
    endDate.setDate(endDate.getDate() + 30);

    const calendarUrl = `https://www.googleapis.com/calendar/v3/calendars/primary/events?` +
      `timeMin=${startDate.toISOString()}&` +
      `timeMax=${endDate.toISOString()}&` +
      `singleEvents=true&` +
      `orderBy=startTime&` +
      `maxResults=100`;

    const googleResponse = await fetch(calendarUrl, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
    });

    if (!googleResponse.ok) {
      const errorText = await googleResponse.text();
      console.error('Google Calendar API error:', errorText);
      throw new Error('Не удалось загрузить события из Google Calendar');
    }

    const googleData = await googleResponse.json();
    const googleEvents: GoogleCalendarEvent[] = googleData.items || [];
    
    console.log(`Found ${googleEvents.length} events from Google Calendar`);

    // Get user cycle data for AI suggestions
    const { data: cycleData } = await supabase
      .from('user_cycles')
      .select('*')
      .eq('user_id', userId)
      .single();

    let syncedCount = 0;
    let suggestionsCount = 0;

    // Process each Google Calendar event
    for (const googleEvent of googleEvents) {
      if (!googleEvent.summary || !googleEvent.start) continue;

      const startTime = googleEvent.start.dateTime || googleEvent.start.date;
      const endTime = googleEvent.end?.dateTime || googleEvent.end?.date || startTime;

      // Check if event already exists
      const { data: existingEvent } = await supabase
        .from('events')
        .select('id')
        .eq('user_id', userId)
        .eq('title', googleEvent.summary)
        .eq('start_time', new Date(startTime).toISOString())
        .eq('source', 'google')
        .single();

      if (existingEvent) {
        console.log('Event already exists, skipping:', googleEvent.summary);
        continue;
      }

      // Insert new event
      const { data: newEvent, error: eventError } = await supabase
        .from('events')
        .insert({
          user_id: userId,
          title: googleEvent.summary,
          start_time: new Date(startTime).toISOString(),
          end_time: new Date(endTime).toISOString(),
          source: 'google'
        })
        .select()
        .single();

      if (eventError) {
        console.error('Error inserting event:', eventError);
        continue;
      }

      syncedCount++;
      console.log('Synced event:', googleEvent.summary);

      // Generate AI suggestion if cycle data is available
      if (cycleData && newEvent) {
        try {
          const today = new Date();
          const startDate = new Date(cycleData.start_date);
          const diffInDays = Math.floor((today.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
          const cycleDay = (diffInDays % cycleData.cycle_length) + 1;

          const { data: suggestionData, error: suggestionError } = await supabase
            .rpc('generate_ai_suggestion_content', {
              event_title: googleEvent.summary,
              cycle_day: cycleDay > 0 ? cycleDay : cycleData.cycle_length + cycleDay,
              cycle_length: cycleData.cycle_length,
              event_description: googleEvent.description || null
            });

          if (!suggestionError && suggestionData) {
            await supabase
              .from('event_ai_suggestions')
              .insert({
                event_id: newEvent.id,
                suggestion: suggestionData,
                justification: `На основе ${cycleDay > 0 ? cycleDay : cycleData.cycle_length + cycleDay} дня цикла`,
                decision: 'generated'
              });

            suggestionsCount++;
            console.log('Generated AI suggestion for event:', googleEvent.summary);
          }
        } catch (aiError) {
          console.error('Error generating AI suggestion:', aiError);
        }
      }
    }

    console.log(`Sync completed: ${syncedCount} events synced, ${suggestionsCount} AI suggestions generated`);

    return new Response(JSON.stringify({ 
      success: true,
      eventsCount: syncedCount,
      suggestionsCount: suggestionsCount,
      message: `Синхронизировано ${syncedCount} событий с ${suggestionsCount} ИИ-советами`
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (error) {
    console.error('Error in sync-google-calendar function:', error);
    return new Response(JSON.stringify({ 
      error: error.message || 'Failed to sync Google Calendar'
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});