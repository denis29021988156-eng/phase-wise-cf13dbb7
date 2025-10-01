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

    // Get user's Google token
    const { data: tokenData } = await supabase
      .from('user_tokens')
      .select('access_token, refresh_token')
      .eq('user_id', userId)
      .eq('provider', 'google')
      .maybeSingle();

    if (!tokenData?.access_token) {
      console.log('No Google token found for user');
      return new Response(
        JSON.stringify({ success: false, error: 'No Google Calendar connection' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    // If googleEventId is provided, delete from Google Calendar
    if (googleEventId) {
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
            body: { userId }
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
