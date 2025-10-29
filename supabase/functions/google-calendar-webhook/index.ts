import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-goog-channel-id, x-goog-channel-token, x-goog-resource-id, x-goog-resource-state, x-goog-resource-uri',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    );

    // Google отправляет информацию о канале в заголовках
    const channelId = req.headers.get('x-goog-channel-id');
    const resourceState = req.headers.get('x-goog-resource-state');
    const resourceId = req.headers.get('x-goog-resource-id');

    console.log('Received Google Calendar notification:', {
      channelId,
      resourceState,
      resourceId,
    });

    // Respond quickly to Google
    if (resourceState === 'sync') {
      console.log('Sync message received - channel is now active');
      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (!channelId || !resourceState) {
      console.log('Missing required headers');
      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Validate channel token
    const channelToken = req.headers.get('x-goog-channel-token');
    
    // Find user by channel ID and validate token
    const { data: watchData, error: watchError } = await supabaseClient
      .from('google_calendar_watch_channels')
      .select('user_id, channel_token')
      .eq('channel_id', channelId)
      .maybeSingle();

    if (watchError || !watchData) {
      console.log('Watch channel not found:', channelId);
      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Verify channel token if stored
    if (watchData.channel_token && watchData.channel_token !== channelToken) {
      console.log('Invalid channel token for:', channelId);
      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const userId = watchData.user_id;

    console.log('Calendar changed for user:', userId, 'State:', resourceState);

    // Trigger sync in background (don't await to respond quickly to Google)
    const syncPromise = supabaseClient.functions.invoke('sync-google-calendar', {
      body: { userId }
    }).then(() => {
      console.log('Background sync completed for user:', userId);
    }).catch((error) => {
      console.error('Background sync failed:', error);
    });

    // Use EdgeRuntime.waitUntil to ensure the background task completes
    if (typeof EdgeRuntime !== 'undefined' && EdgeRuntime.waitUntil) {
      EdgeRuntime.waitUntil(syncPromise);
    }

    // Respond immediately to Google
    return new Response(
      JSON.stringify({ success: true }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in google-calendar-webhook:', error);
    
    // Always return 200 to Google to avoid retries
    return new Response(
      JSON.stringify({ success: true }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});