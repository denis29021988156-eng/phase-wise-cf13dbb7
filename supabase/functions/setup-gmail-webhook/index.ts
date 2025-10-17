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

    // Получить Google токен
    const { data: tokenData, error: tokenError } = await supabaseClient
      .from('user_tokens')
      .select('access_token')
      .eq('user_id', user.id)
      .eq('provider', 'google')
      .maybeSingle();

    if (tokenError || !tokenData) {
      throw new Error('Google токен не найден');
    }

    // Обновить токен
    const refreshResponse = await supabaseClient.functions.invoke('refresh-google-token', {
      body: { user_id: user.id }
    });

    if (refreshResponse.error) {
      throw new Error('Не удалось обновить токен');
    }

    const accessToken = refreshResponse.data.access_token;

    // Настроить Gmail watch для получения уведомлений о новых письмах
    const watchResponse = await fetch(
      'https://gmail.googleapis.com/gmail/v1/users/me/watch',
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          labelIds: ['INBOX'],
          topicName: `projects/${Deno.env.get('GOOGLE_CLOUD_PROJECT_ID')}/topics/gmail-notifications`,
        }),
      }
    );

    if (!watchResponse.ok) {
      const error = await watchResponse.text();
      console.error('Gmail watch error:', error);
      throw new Error('Не удалось настроить Gmail webhooks');
    }

    const watchData = await watchResponse.json();

    console.log('Gmail watch configured:', watchData);

    return new Response(
      JSON.stringify({ 
        success: true,
        message: 'Webhooks настроены успешно',
        historyId: watchData.historyId,
        expiration: watchData.expiration,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );

  } catch (error) {
    console.error('Error in setup-gmail-webhook:', error);
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