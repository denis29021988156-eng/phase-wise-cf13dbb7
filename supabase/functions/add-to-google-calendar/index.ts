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

    const { userId, eventData } = await req.json();

    console.log('Adding event to Google Calendar for user:', userId);
    console.log('Event data:', eventData);

    // Get user's Google access token
    const { data: tokenData, error: tokenError } = await supabaseClient
      .from('user_tokens')
      .select('access_token, refresh_token, expires_at')
      .eq('user_id', userId)
      .eq('provider', 'google')
      .maybeSingle();

    if (tokenError || !tokenData) {
      console.error('No Google token found for user:', tokenError);
      
      if (tokenError?.code === 'PGRST116') {
        throw new Error('Google Calendar не подключен. Войдите заново через Google.');
      } else {
        throw new Error('Ошибка доступа к Google Calendar. Попробуйте войти заново через Google.');
      }
    }

    // Get fresh access token (automatically refreshes if needed)
    console.log('Getting fresh access token...');
    const refreshResponse = await supabaseClient.functions.invoke('refresh-google-token', {
      body: { user_id: userId }
    });

    if (refreshResponse.error) {
      console.error('Token refresh failed:', refreshResponse.error);
      throw new Error('Не удалось обновить токен Google Calendar. Войдите заново через Google.');
    }

    const accessToken = refreshResponse.data.access_token;

    // Prepare event data for Google Calendar
    // Google Calendar accepts dateTime in RFC3339 format with timezone
    // Since we receive UTC time (ISO string), we just pass it as is
    const googleEvent = {
      summary: eventData.title,
      description: eventData.description || '',
      start: {
        dateTime: eventData.startTime, // Already in UTC (ISO format with Z)
      },
      end: {
        dateTime: eventData.endTime, // Already in UTC (ISO format with Z)
      },
    };

    console.log('Creating Google Calendar event:', googleEvent);

    // Create event in Google Calendar
    let createResponse = await fetch(
      'https://www.googleapis.com/calendar/v3/calendars/primary/events',
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(googleEvent),
      }
    );

    // Handle 401 by attempting a token refresh and retrying once
    if (createResponse.status === 401) {
      console.log('401 from Google Calendar API. Attempting token refresh and retry...');
      const refreshRetryResponse = await supabaseClient.functions.invoke('refresh-google-token', {
        body: { user_id: userId }
      });

      if (!refreshRetryResponse.error && refreshRetryResponse.data?.access_token) {
        const newAccessToken = refreshRetryResponse.data.access_token;
        console.log('Token refreshed, retrying create event request...');
        
        createResponse = await fetch(
          'https://www.googleapis.com/calendar/v3/calendars/primary/events',
          {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${newAccessToken}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(googleEvent),
          }
        );
      } else {
        console.error('Token refresh failed:', refreshRetryResponse.error);
      }
    }

    if (!createResponse.ok) {
      const errorText = await createResponse.text();
      console.error('Google Calendar API error:', errorText);
      
      if (createResponse.status === 401) {
        throw new Error('Токен Google Calendar истек. Войдите заново через Google.');
      } else if (createResponse.status === 403) {
        throw new Error('Нет доступа к Google Calendar. Проверьте разрешения.');
      } else {
        throw new Error(`Ошибка добавления события в Google Calendar: ${createResponse.status}`);
      }
    }

    const createdEvent = await createResponse.json();
    console.log('Event created successfully in Google Calendar:', createdEvent.id);

    return new Response(
      JSON.stringify({ 
        success: true,
        googleEventId: createdEvent.id,
        message: 'Событие успешно добавлено в Google Calendar'
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );

  } catch (error) {
    console.error('Error in add-to-google-calendar function:', error);
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : 'Unknown error',
        success: false
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});