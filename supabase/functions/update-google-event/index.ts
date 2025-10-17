import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Helper function to find Google event ID by title and time
async function findGoogleEventId(supabase: any, userId: string, title: string, startTime: string) {
  try {
    const { data: tokenData } = await supabase
      .from('user_tokens')
      .select('access_token')
      .eq('user_id', userId)
      .eq('provider', 'google')
      .maybeSingle();

    if (!tokenData?.access_token) return null;

    const startDate = new Date(startTime);
    const timeMin = new Date(startDate.getTime() - 24 * 60 * 60 * 1000).toISOString(); // 1 day before
    const timeMax = new Date(startDate.getTime() + 24 * 60 * 60 * 1000).toISOString(); // 1 day after

    const calendarResponse = await fetch(
      `https://www.googleapis.com/calendar/v3/calendars/primary/events?timeMin=${timeMin}&timeMax=${timeMax}&singleEvents=true`,
      {
        headers: {
          'Authorization': `Bearer ${tokenData.access_token}`,
        },
      }
    );

    if (!calendarResponse.ok) return null;

    const calendarData = await calendarResponse.json();
    const events = calendarData.items || [];

    // Find event by title and approximate time (within 1 hour)
    for (const event of events) {
      if (event.summary === title && event.start?.dateTime) {
        const eventStartTime = new Date(event.start.dateTime);
        const timeDiff = Math.abs(eventStartTime.getTime() - startDate.getTime());
        if (timeDiff < 60 * 60 * 1000) { // Within 1 hour
          console.log(`Found Google event by title and time: ${event.id}`);
          return event.id;
        }
      }
    }

    return null;
  } catch (error) {
    console.error('Error finding Google event ID:', error);
    return null;
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    const authToken = authHeader?.replace('Bearer ', '') || '';
    
    const { userId, eventId, eventData } = await req.json();
    console.log('Update Google event request:', { userId, eventId });

    if (!userId || !eventId || !eventData) {
      return new Response(
        JSON.stringify({ success: false, error: 'Missing required parameters' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get the event and its Google event ID
    const { data: eventRecord, error: getEventError } = await supabase
      .from('events')
      .select('google_event_id, title, start_time, source')
      .eq('id', eventId)
      .eq('user_id', userId)
      .single();

    if (getEventError || !eventRecord) {
      console.error('Event not found or access denied:', getEventError);
      return new Response(
        JSON.stringify({ success: false, error: 'Event not found' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 404 }
      );
    }

    let foundGoogleEventId = eventRecord.google_event_id;
    
    // If no google_event_id but event source is google, try to find by title and time
    if (!foundGoogleEventId && eventRecord.source === 'google') {
      console.log('No google_event_id found, but event is from google. Searching by title and time...');
      foundGoogleEventId = await findGoogleEventId(supabase, userId, eventRecord.title, eventRecord.start_time);
    }

    // Update local database first
    const { error: updateError } = await supabase
      .from('events')
      .update({
        title: eventData.title,
        start_time: eventData.startTime,
        end_time: eventData.endTime,
      })
      .eq('id', eventId)
      .eq('user_id', userId);

    if (updateError) {
      console.error('Database update error:', updateError);
      throw updateError;
    }

    // Generate new AI suggestion for updated event
    try {
      const { data: cycleData } = await supabase
        .from('user_cycles')
        .select('*')
        .eq('user_id', userId)
        .single();

      if (cycleData) {
        const eventDate = new Date(eventData.startTime);
        const startDate = new Date(cycleData.start_date);
        const diffInDays = Math.floor((eventDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
        const eventCycleDay = ((diffInDays % cycleData.cycle_length) + 1);
        const adjustedCycleDay = eventCycleDay > 0 ? eventCycleDay : cycleData.cycle_length + eventCycleDay;

        console.log(`Generating AI suggestion for updated event on cycle day ${adjustedCycleDay}`);

        const { data: suggestionData, error: suggestionError } = await supabase.functions.invoke('generate-ai-suggestion', {
          body: {
            event: {
              title: eventData.title,
              start_time: eventData.startTime,
              description: eventData.description || ''
            },
            cycleData: {
              cycleDay: adjustedCycleDay,
              cycleLength: cycleData.cycle_length,
              startDate: cycleData.start_date
            }
          },
          headers: {
            Authorization: `Bearer ${authToken}`
          }
        });

        if (!suggestionError && suggestionData?.suggestion) {
          // Delete old suggestion and insert new one
          await supabase
            .from('event_ai_suggestions')
            .delete()
            .eq('event_id', eventId);

          await supabase
            .from('event_ai_suggestions')
            .insert({
              event_id: eventId,
              suggestion: suggestionData.suggestion,
              justification: suggestionData.justification || `ИИ-совет для ${adjustedCycleDay} дня цикла`,
              decision: 'generated'
            });

          console.log('AI suggestion updated for event');
        }
      }
    } catch (aiError) {
      console.error('Error generating AI suggestion:', aiError);
      // Continue anyway - event update succeeded
    }

    // If event has Google event ID, update it in Google Calendar too
    if (foundGoogleEventId) {
      const { data: tokenData } = await supabase
        .from('user_tokens')
        .select('access_token, refresh_token')
        .eq('user_id', userId)
        .eq('provider', 'google')
        .maybeSingle();

      if (tokenData?.access_token) {
        try {
          const googleEvent = {
            summary: eventData.title,
            description: eventData.description || '',
            start: {
              dateTime: eventData.startTime,
              timeZone: 'UTC',
            },
            end: {
              dateTime: eventData.endTime,
              timeZone: 'UTC',
            },
          };

          const updateResponse = await fetch(
            `https://www.googleapis.com/calendar/v3/calendars/primary/events/${foundGoogleEventId}`,
            {
              method: 'PATCH',
              headers: {
                'Authorization': `Bearer ${tokenData.access_token}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify(googleEvent),
            }
          );

          if (updateResponse.status === 401) {
            console.log('Token expired, attempting refresh');
            const refreshed = await supabase.functions.invoke('refresh-google-token', {
              body: { user_id: userId },
              headers: {
                Authorization: `Bearer ${authToken}`
              }
            });

            if (refreshed.data?.access_token) {
              const retryResponse = await fetch(
                `https://www.googleapis.com/calendar/v3/calendars/primary/events/${foundGoogleEventId}`,
                {
                  method: 'PATCH',
                  headers: {
                    'Authorization': `Bearer ${refreshed.data.access_token}`,
                    'Content-Type': 'application/json',
                  },
                  body: JSON.stringify(googleEvent),
                }
              );

              if (!retryResponse.ok) {
                throw new Error('Failed to update Google Calendar after token refresh');
              }
            }
          } else if (!updateResponse.ok) {
            const errorText = await updateResponse.text();
            console.error('Google Calendar update error:', errorText);
          }
        } catch (googleError) {
          console.error('Error updating Google Calendar:', googleError);
          // Continue anyway - local update succeeded
        }
      }
    }

    console.log('Event updated successfully');
    return new Response(
      JSON.stringify({ success: true }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error in update-google-event:', error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});
