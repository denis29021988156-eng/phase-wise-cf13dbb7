import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: req.headers.get('Authorization')! },
        },
      }
    );

    const { userId } = await req.json();

    console.log('Syncing Google Calendar for user:', userId);

    // Get user's Google access token
    const { data: tokenData, error: tokenError } = await supabaseClient
      .from('user_tokens')
      .select('access_token, refresh_token, expires_at')
      .eq('user_id', userId)
      .eq('provider', 'google')
      .single();

    if (tokenError || !tokenData) {
      console.error('No Google token found for user:', tokenError);
      throw new Error('Google Calendar не подключен. Войдите заново через Google.');
    }

    // Check if token needs refresh
    let accessToken = tokenData.access_token;
    if (tokenData.expires_at && new Date(tokenData.expires_at) <= new Date()) {
      console.log('Token expired, refreshing...');
      // Token refresh logic would go here - for now we'll assume it's valid
    }

    // Get user cycle data for AI suggestions
    const { data: cycleData, error: cycleError } = await supabaseClient
      .from('user_cycles')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (cycleError || !cycleData) {
      console.error('No cycle data found for user:', cycleError);
      throw new Error('Данные о цикле не найдены. Настройте цикл в профиле.');
    }

    // Calculate current cycle day
    const today = new Date();
    const startDate = new Date(cycleData.start_date);
    const diffInDays = Math.floor((today.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
    const cycleDay = (diffInDays % cycleData.cycle_length) + 1;
    const currentCycleDay = cycleDay > 0 ? cycleDay : cycleData.cycle_length + cycleDay;

    // Fetch events from Google Calendar (next 7 days)
    const now = new Date();
    const weekLater = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    
    const calendarResponse = await fetch(
      `https://www.googleapis.com/calendar/v3/calendars/primary/events?timeMin=${now.toISOString()}&timeMax=${weekLater.toISOString()}&singleEvents=true&orderBy=startTime`,
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
      }
    );

    if (!calendarResponse.ok) {
      console.error('Google Calendar API error:', await calendarResponse.text());
      throw new Error('Ошибка при загрузке событий из Google Calendar');
    }

    const calendarData = await calendarResponse.json();
    const googleEvents = calendarData.items || [];

    console.log(`Found ${googleEvents.length} events from Google Calendar`);

    let eventsProcessed = 0;
    let eventsWithSuggestions = 0;

    // Process each event
    for (const googleEvent of googleEvents) {
      try {
        // Skip all-day events or events without start time
        if (!googleEvent.start?.dateTime) continue;

        const startTime = new Date(googleEvent.start.dateTime);
        const endTime = new Date(googleEvent.end?.dateTime || googleEvent.start.dateTime);

        // Check if event already exists
        const { data: existingEvent } = await supabaseClient
          .from('events')
          .select('id')
          .eq('user_id', userId)
          .eq('title', googleEvent.summary || 'Без названия')
          .eq('start_time', startTime.toISOString())
          .single();

        if (existingEvent) {
          console.log('Event already exists:', googleEvent.summary);
          continue;
        }

        // Insert event
        const { data: newEvent, error: eventError } = await supabaseClient
          .from('events')
          .insert({
            user_id: userId,
            title: googleEvent.summary || 'Событие из Google Calendar',
            start_time: startTime.toISOString(),
            end_time: endTime.toISOString(),
            source: 'google'
          })
          .select()
          .single();

        if (eventError) {
          console.error('Error inserting event:', eventError);
          continue;
        }

        eventsProcessed++;

        // Generate AI suggestion for the event
        try {
          const { data: suggestionData, error: suggestionError } = await supabaseClient
            .rpc('generate_ai_suggestion_content', {
              event_title: newEvent.title,
              cycle_day: currentCycleDay,
              cycle_length: cycleData.cycle_length,
              event_description: googleEvent.description || null
            });

          if (!suggestionError && suggestionData) {
            await supabaseClient
              .from('event_ai_suggestions')
              .insert({
                event_id: newEvent.id,
                suggestion: suggestionData,
                justification: `Совет основан на ${currentCycleDay} дне цикла (продолжительность ${cycleData.cycle_length} дней)`,
                decision: 'generated'
              });

            eventsWithSuggestions++;
          }
        } catch (aiError) {
          console.error('Error generating AI suggestion for event:', newEvent.title, aiError);
        }

      } catch (eventError) {
        console.error('Error processing event:', googleEvent.summary, eventError);
      }
    }

    console.log(`Processed ${eventsProcessed} events, ${eventsWithSuggestions} with AI suggestions`);

    return new Response(
      JSON.stringify({ 
        success: true,
        eventsCount: eventsProcessed,
        suggestionsCount: eventsWithSuggestions,
        message: `Загружено ${eventsProcessed} событий с ${eventsWithSuggestions} ИИ-советами`
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );

  } catch (error) {
    console.error('Error in sync-google-calendar function:', error);
    return new Response(
      JSON.stringify({ 
        error: error.message,
        success: false
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});