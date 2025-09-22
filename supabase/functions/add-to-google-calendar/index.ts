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
      .single();

    if (tokenError || !tokenData) {
      console.error('No Google token found for user:', tokenError);
      
      if (tokenError?.code === 'PGRST116') {
        throw new Error('Google Calendar не подключен. Войдите заново через Google.');
      } else {
        throw new Error('Ошибка доступа к Google Calendar. Попробуйте войти заново через Google.');
      }
    }

    // Check if token needs refresh
    let accessToken = tokenData.access_token;
    if (tokenData.expires_at && new Date(tokenData.expires_at) <= new Date()) {
      console.log('Token expired, need to refresh...');
      throw new Error('Токен Google Calendar истек. Войдите заново через Google.');
    }

    // Prepare event data for Google Calendar
    const googleEvent = {
      summary: eventData.title,
      description: eventData.description || '',
      start: {
        dateTime: eventData.startTime,
        timeZone: 'Europe/Moscow',
      },
      end: {
        dateTime: eventData.endTime,
        timeZone: 'Europe/Moscow',
      },
    };

    console.log('Creating Google Calendar event:', googleEvent);

    // Create event in Google Calendar
    const createResponse = await fetch(
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