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
    const { userId, eventId, googleEventId } = await req.json();
    console.log('Delete Google event request:', { userId, eventId, googleEventId });

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
      .select('google_event_id')
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

    const googleEventId = eventData.google_event_id;

    // Get user's Google token only if we have a Google event to delete
    let tokenData = null;
    if (googleEventId) {
      const { data: tokens } = await supabase
        .from('user_tokens')
        .select('access_token, refresh_token')
        .eq('user_id', userId)
        .eq('provider', 'google')
        .maybeSingle();

      tokenData = tokens;
    }

    // If googleEventId is provided and we have a token, delete from Google Calendar
    if (googleEventId && tokenData?.access_token) {
      try {
        const deleteResponse = await fetch(
          `https://www.googleapis.com/calendar/v3/calendars/primary/events/${googleEventId}`,
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
            body: { user_id: userId }
          });

          if (refreshed.data?.access_token) {
            // Retry delete with new token
            const retryResponse = await fetch(
              `https://www.googleapis.com/calendar/v3/calendars/primary/events/${googleEventId}`,
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
