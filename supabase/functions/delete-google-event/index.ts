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
    
    const { userId, eventId } = await req.json();
    console.log('Delete Google event request:', { userId, eventId });

    if (!userId || !eventId) {
      return new Response(
        JSON.stringify({ success: false, error: 'Missing required parameters' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get the event and its Google event ID
    const { data: eventData, error: eventError } = await supabase
      .from('events')
      .select('google_event_id, title, start_time, source')
      .eq('id', eventId)
      .eq('user_id', userId)
      .single();

    if (eventError || !eventData) {
      console.error('Event not found or access denied:', eventError);
      return new Response(
        JSON.stringify({ success: false, error: 'Event not found' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 404 }
      );
    }

    let foundGoogleEventId = eventData.google_event_id;
    
    // If no google_event_id but event source is google, try to find by title and time
    if (!foundGoogleEventId && eventData.source === 'google') {
      console.log('No google_event_id found, but event is from google. Searching by title and time...');
      foundGoogleEventId = await findGoogleEventId(supabase, userId, eventData.title, eventData.start_time);
    }

    // Get user's Google token only if we have a Google event to delete
    let tokenData = null;
    if (foundGoogleEventId) {
      const { data: tokens } = await supabase
        .from('user_tokens')
        .select('access_token, refresh_token')
        .eq('user_id', userId)
        .eq('provider', 'google')
        .maybeSingle();

      tokenData = tokens;
    }

    // If foundGoogleEventId is available and we have a token, delete from Google Calendar
    if (foundGoogleEventId && tokenData?.access_token) {
      try {
        const deleteResponse = await fetch(
          `https://www.googleapis.com/calendar/v3/calendars/primary/events/${foundGoogleEventId}`,
          {
            method: 'DELETE',
            headers: {
              'Authorization': `Bearer ${tokenData.access_token}`,
            },
          }
        );

        if (deleteResponse.status === 401) {
          console.log('Token expired, attempting refresh');
          // Token expired, try refresh
          const refreshed = await supabase.functions.invoke('refresh-google-token', {
            body: { user_id: userId },
            headers: {
              Authorization: `Bearer ${authToken}`
            }
          });

          if (refreshed.data?.access_token) {
            // Retry delete with new token
            const retryResponse = await fetch(
              `https://www.googleapis.com/calendar/v3/calendars/primary/events/${foundGoogleEventId}`,
              {
                method: 'DELETE',
                headers: {
                  'Authorization': `Bearer ${refreshed.data.access_token}`,
                },
              }
            );

            if (!retryResponse.ok && retryResponse.status !== 404) {
              throw new Error('Failed to delete from Google Calendar after token refresh');
            }
          }
        } else if (!deleteResponse.ok && deleteResponse.status !== 404) {
          // 404 is OK - event already deleted
          const errorText = await deleteResponse.text();
          console.error('Google Calendar delete error:', errorText);
        }
      } catch (googleError) {
        console.error('Error deleting from Google Calendar:', googleError);
        // Continue with local deletion even if Google deletion fails
      }
    }

    // Delete from local database
    const { error: deleteError } = await supabase
      .from('events')
      .delete()
      .eq('id', eventId)
      .eq('user_id', userId);

    if (deleteError) {
      console.error('Database deletion error:', deleteError);
      throw deleteError;
    }

    console.log('Event deleted successfully');
    return new Response(
      JSON.stringify({ success: true }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error in delete-google-event:', error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});
