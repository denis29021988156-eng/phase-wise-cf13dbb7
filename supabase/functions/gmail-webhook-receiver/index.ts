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
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    );

    // Gmail отправляет уведомления в формате Pub/Sub
    const notification = await req.json();
    console.log('Received Gmail notification:', notification);

    // Декодировать данные из Pub/Sub
    const message = notification.message;
    if (!message || !message.data) {
      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const decodedData = JSON.parse(atob(message.data));
    const { emailAddress, historyId } = decodedData;

    console.log('Gmail notification for:', emailAddress, 'historyId:', historyId);

    // Найти пользователя по email
    const { data: userData } = await supabaseClient
      .from('user_profiles')
      .select('user_id')
      .ilike('name', `%${emailAddress}%`)
      .maybeSingle();

    if (!userData) {
      console.log('User not found for email:', emailAddress);
      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const userId = userData.user_id;

    // Получить токен пользователя
    const { data: tokenData } = await supabaseClient
      .from('user_tokens')
      .select('access_token')
      .eq('user_id', userId)
      .eq('provider', 'google')
      .maybeSingle();

    if (!tokenData) {
      console.log('Token not found for user:', userId);
      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Обновить токен
    const refreshResponse = await supabaseClient.functions.invoke('refresh-google-token', {
      body: { user_id: userId }
    });

    if (refreshResponse.error) {
      throw new Error('Не удалось обновить токен');
    }

    const accessToken = refreshResponse.data.access_token;

    // Получить историю изменений с момента последнего historyId
    const historyResponse = await fetch(
      `https://gmail.googleapis.com/gmail/v1/users/me/history?startHistoryId=${historyId}`,
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
        },
      }
    );

    if (!historyResponse.ok) {
      throw new Error('Не удалось получить историю Gmail');
    }

    const historyData = await historyResponse.json();
    const history = historyData.history || [];

    // Проверить, есть ли новые письма
    for (const item of history) {
      if (item.messagesAdded) {
        for (const messageAdded of item.messagesAdded) {
          const messageId = messageAdded.message.id;
          const threadId = messageAdded.message.threadId;

          // Получить детали письма
          const messageResponse = await fetch(
            `https://gmail.googleapis.com/gmail/v1/users/me/messages/${messageId}`,
            {
              headers: {
                'Authorization': `Bearer ${accessToken}`,
              },
            }
          );

          if (messageResponse.ok) {
            const messageData = await messageResponse.json();
            
            // Извлечь тело письма
            let emailBody = '';
            if (messageData.payload.parts) {
              for (const part of messageData.payload.parts) {
                if (part.mimeType === 'text/plain' && part.body.data) {
                  emailBody = atob(part.body.data.replace(/-/g, '+').replace(/_/g, '/'));
                  break;
                }
              }
            } else if (messageData.payload.body.data) {
              emailBody = atob(messageData.payload.body.data.replace(/-/g, '+').replace(/_/g, '/'));
            }

            // Вызвать функцию обработки ответа
            await supabaseClient.functions.invoke('ai-handle-email-reply', {
              body: {
                threadId,
                emailBody,
                userId,
              }
            });

            console.log('Processed email reply for thread:', threadId);
          }
        }
      }
    }

    return new Response(
      JSON.stringify({ success: true }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );

  } catch (error) {
    console.error('Error in gmail-webhook-receiver:', error);
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