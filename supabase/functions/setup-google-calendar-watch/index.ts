import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
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

    const { data: { user } } = await supabaseClient.auth.getUser();
    if (!user) {
      throw new Error('Unauthorized');
    }

    console.log('Setting up Google Calendar watch for user:', user.id);

    // Get Google token
    const { data: tokenData, error: tokenError } = await supabaseClient
      .from('user_tokens')
      .select('access_token')
      .eq('user_id', user.id)
      .eq('provider', 'google')
      .maybeSingle();

    if (tokenError || !tokenData) {
      throw new Error('Google токен не найден');
    }

    // Refresh token
    const refreshResponse = await supabaseClient.functions.invoke('refresh-google-token', {
      body: { user_id: user.id }
    });

    if (refreshResponse.error) {
      throw new Error('Не удалось обновить токен');
    }

    const accessToken = refreshResponse.data.access_token;

    // Check if watch already exists and is still valid
    const { data: existingWatch } = await supabaseClient
      .from('google_calendar_watch_channels')
      .select('*')
      .eq('user_id', user.id)
      .maybeSingle();

    if (existingWatch) {
      const expirationDate = new Date(existingWatch.expiration);
      const now = new Date();
      const hourFromNow = new Date(now.getTime() + 60 * 60 * 1000);

      // If watch is still valid for more than 1 hour, return existing
      if (expirationDate > hourFromNow) {
        console.log('Watch channel still valid:', existingWatch.channel_id);
        return new Response(
          JSON.stringify({ 
            success: true,
            message: 'Webhook уже настроен',
            channelId: existingWatch.channel_id,
            expiration: existingWatch.expiration,
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Stop old watch before creating new one
      try {
        await fetch(
          'https://www.googleapis.com/calendar/v3/channels/stop',
          {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${accessToken}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              id: existingWatch.channel_id,
              resourceId: existingWatch.resource_id,
            }),
          }
        );
        console.log('Stopped old watch channel');
      } catch (stopError) {
        console.error('Error stopping old watch:', stopError);
      }
    }

    // Generate unique channel ID
    const channelId = `calendar-${user.id}-${Date.now()}`;
    
    // Webhook URL - Google будет отправлять уведомления сюда
    const webhookUrl = `${Deno.env.get('SUPABASE_URL')}/functions/v1/google-calendar-webhook`;

    console.log('Creating watch with webhook URL:', webhookUrl);

    // Set up watch on primary calendar
    const watchResponse = await fetch(
      'https://www.googleapis.com/calendar/v3/calendars/primary/events/watch',
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          id: channelId,
          type: 'web_hook',
          address: webhookUrl,
          expiration: Date.now() + (7 * 24 * 60 * 60 * 1000), // 7 days
        }),
      }
    );

    if (!watchResponse.ok) {
      const error = await watchResponse.text();
      console.error('Google Calendar watch error:', error);
      throw new Error('Не удалось настроить webhook для Google Calendar');
    }

    const watchData = await watchResponse.json();

    console.log('Watch created successfully:', watchData);

    // Save watch info to database
    const expirationDate = new Date(parseInt(watchData.expiration));
    
    await supabaseClient
      .from('google_calendar_watch_channels')
      .upsert({
        user_id: user.id,
        channel_id: watchData.id,
        resource_id: watchData.resourceId,
        expiration: expirationDate.toISOString(),
      }, { onConflict: 'user_id' });

    console.log('Watch info saved to database');

    return new Response(
      JSON.stringify({ 
        success: true,
        message: 'Автосинхронизация Google Calendar активирована',
        channelId: watchData.id,
        expiration: expirationDate.toISOString(),
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in setup-google-calendar-watch:', error);
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