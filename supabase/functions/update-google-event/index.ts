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
    const { userId, eventId, googleEventId, eventData } = await req.json();
    console.log('Update Google event request:', { userId, eventId, googleEventId });

    if (!userId || !eventId || !eventData) {
      return new Response(
        JSON.stringify({ success: false, error: 'Missing required parameters' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

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

    // If event came from Google Calendar, update it there too
    if (googleEventId) {
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
            `https://www.googleapis.com/calendar/v3/calendars/primary/events/${googleEventId}`,
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
              body: { user_id: userId }
            });

            if (refreshed.data?.access_token) {
              const retryResponse = await fetch(
                `https://www.googleapis.com/calendar/v3/calendars/primary/events/${googleEventId}`,
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
