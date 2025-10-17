import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Helper function to find Microsoft event ID by title and time
async function findMicrosoftEventId(supabase: any, userId: string, title: string, startTime: string) {
  try {
    const { data: tokenData } = await supabase
      .from('user_tokens')
      .select('access_token')
      .eq('user_id', userId)
      .eq('provider', 'microsoft')
      .maybeSingle();

    if (!tokenData?.access_token) return null;

    const startDate = new Date(startTime);
    const timeMin = new Date(startDate.getTime() - 24 * 60 * 60 * 1000).toISOString();
    const timeMax = new Date(startDate.getTime() + 24 * 60 * 60 * 1000).toISOString();

    const calendarResponse = await fetch(
      `https://graph.microsoft.com/v1.0/me/calendarView?startDateTime=${timeMin}&endDateTime=${timeMax}`,
      {
        headers: {
          'Authorization': `Bearer ${tokenData.access_token}`,
        },
      }
    );

    if (!calendarResponse.ok) return null;

    const calendarData = await calendarResponse.json();
    const events = calendarData.value || [];

    // Find event by title and approximate time (within 1 hour)
    for (const event of events) {
      if (event.subject === title && event.start?.dateTime) {
        const eventStartTime = new Date(event.start.dateTime);
        const timeDiff = Math.abs(eventStartTime.getTime() - startDate.getTime());
        if (timeDiff < 60 * 60 * 1000) {
          console.log(`Found Microsoft event by title and time: ${event.id}`);
          return event.id;
        }
      }
    }

    return null;
  } catch (error) {
    console.error('Error finding Microsoft event ID:', error);
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
    console.log('Update Outlook event request:', { userId, eventId });

    if (!userId || !eventId || !eventData) {
      return new Response(
        JSON.stringify({ success: false, error: 'Missing required parameters' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get the event and its Microsoft event ID
    const { data: eventRecord, error: getEventError } = await supabase
      .from('events')
      .select('microsoft_event_id, title, start_time, source')
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

    let foundMicrosoftEventId = eventRecord.microsoft_event_id;
    
    // If no microsoft_event_id but event source is outlook, try to find by title and time
    if (!foundMicrosoftEventId && eventRecord.source === 'outlook') {
      console.log('No microsoft_event_id found, but event is from outlook. Searching by title and time...');
      foundMicrosoftEventId = await findMicrosoftEventId(supabase, userId, eventRecord.title, eventRecord.start_time);
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

    // If event has Microsoft event ID, update it in Outlook Calendar too
    if (foundMicrosoftEventId) {
      const { data: tokenData } = await supabase
        .from('user_tokens')
        .select('access_token, refresh_token')
        .eq('user_id', userId)
        .in('provider', ['microsoft', 'azure'])
        .maybeSingle();

      if (tokenData?.access_token) {
        try {
          const microsoftEvent = {
            subject: eventData.title,
            body: {
              contentType: 'text',
              content: eventData.description || ''
            },
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
            `https://graph.microsoft.com/v1.0/me/events/${foundMicrosoftEventId}`,
            {
              method: 'PATCH',
              headers: {
                'Authorization': `Bearer ${tokenData.access_token}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify(microsoftEvent),
            }
          );

          if (updateResponse.status === 401) {
            console.log('Token expired, attempting refresh');
            const refreshed = await supabase.functions.invoke('refresh-microsoft-token', {
              body: { user_id: userId }
            });

            if (refreshed.data?.access_token) {
              const retryResponse = await fetch(
                `https://graph.microsoft.com/v1.0/me/events/${foundMicrosoftEventId}`,
                {
                  method: 'PATCH',
                  headers: {
                    'Authorization': `Bearer ${refreshed.data.access_token}`,
                    'Content-Type': 'application/json',
                  },
                  body: JSON.stringify(microsoftEvent),
                }
              );

              if (!retryResponse.ok) {
                throw new Error('Failed to update Outlook Calendar after token refresh');
              }
            }
          } else if (!updateResponse.ok) {
            const errorText = await updateResponse.text();
            console.error('Outlook Calendar update error:', errorText);
          }
        } catch (outlookError) {
          console.error('Error updating Outlook Calendar:', outlookError);
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
    console.error('Error in update-outlook-event:', error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});