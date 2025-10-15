import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { logRetryAttempt, logOperationMetric, logErrorNotification, withTimeout, OperationTimer } from '../_shared/logger.ts';
import { checkRateLimit, rateLimitHeaders } from '../_shared/rate-limiter.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const timer = new OperationTimer();
  let userId: string | undefined;

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

    const { suggestionId, customSubject, customBody } = await req.json();

    // Получить user_id из suggestion для rate limiting
    const { data: suggestionData } = await supabaseClient
      .from('event_move_suggestions')
      .select('user_id')
      .eq('id', suggestionId)
      .single();

    if (suggestionData) {
      userId = suggestionData.user_id;

      // Проверить rate limit
      const rateLimit = await checkRateLimit(supabaseClient, userId, 'ai-handle-event-move');
      
      if (!rateLimit.allowed) {
        return new Response(
          JSON.stringify({ 
            error: 'Превышен лимит запросов. Попробуйте через минуту.',
            success: false
          }),
          {
            status: 429,
            headers: { 
              ...corsHeaders, 
              'Content-Type': 'application/json',
              ...rateLimitHeaders(rateLimit.remaining, rateLimit.resetAt)
            },
          }
        );
      }
    }

    console.log('Handling event move for suggestion:', suggestionId);

    // Получить предложение
    const { data: suggestion, error: suggestionError } = await supabaseClient
      .from('event_move_suggestions')
      .select(`
        *,
        events (
          id,
          title,
          start_time,
          end_time,
          source,
          google_event_id
        )
      `)
      .eq('id', suggestionId)
      .single();

    if (suggestionError || !suggestion) {
      throw new Error('Предложение не найдено');
    }

    const event = suggestion.events;
    userId = suggestion.user_id;

    // Определить провайдера календаря
    let emailProvider = 'google';
    if (event.source === 'outlook' || event.source === 'microsoft') {
      emailProvider = 'microsoft';
    }

    // Получить токен доступа
    const { data: tokenData } = await supabaseClient
      .from('user_tokens')
      .select('access_token')
      .eq('user_id', userId)
      .eq('provider', emailProvider)
      .single();

    if (!tokenData) {
      throw new Error(`Токен ${emailProvider} не найден`);
    }

    // Обновить токен
    const refreshResponse = await supabaseClient.functions.invoke(
      emailProvider === 'google' ? 'refresh-google-token' : 'refresh-microsoft-token',
      { body: { user_id: userId } }
    );

    if (refreshResponse.error) {
      throw new Error('Не удалось обновить токен');
    }

    const accessToken = refreshResponse.data.access_token;

    // Получить участников события
    let participants: string[] = [];
    
    if (emailProvider === 'google') {
    // Получить детали события из Google Calendar
      const eventResponse = await fetch(
        `https://www.googleapis.com/calendar/v3/calendars/primary/events/${event.google_event_id}`,
        {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
          },
        }
      );

      if (eventResponse.ok) {
        const eventData = await eventResponse.json();
        participants = (eventData.attendees || [])
          .filter((a: any) => a.email)
          .map((a: any) => a.email);
      }
    } else {
      // Microsoft Graph API - получить участников из Outlook
      try {
        // Используем отдельное поле для Microsoft event ID
        const microsoftEventId = (event as any).microsoft_event_id || event.google_event_id;
        const eventResponse = await fetch(
          `https://graph.microsoft.com/v1.0/me/events/${microsoftEventId}`,
          {
            headers: {
              'Authorization': `Bearer ${accessToken}`,
            },
          }
        );

        if (eventResponse.ok) {
          const eventData = await eventResponse.json();
          participants = (eventData.attendees || [])
            .filter((a: any) => a.emailAddress?.address)
            .map((a: any) => a.emailAddress.address);
        }
      } catch (error) {
        console.error('Error fetching Outlook event participants:', error);
        participants = [];
      }
    }

    // Если нет участников, просто обновить событие локально
    if (participants.length === 0) {
      await supabaseClient
        .from('events')
        .update({
          start_time: suggestion.suggested_new_start,
          end_time: suggestion.suggested_new_end,
        })
        .eq('id', event.id);

      await supabaseClient
        .from('event_move_suggestions')
        .update({ status: 'completed' })
        .eq('id', suggestionId);

      return new Response(
        JSON.stringify({ 
          success: true,
          message: 'Событие перенесено (нет участников)'
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Использовать кастомный текст если передан
    let emailSubject = customSubject;
    let emailBody = customBody;
    
    // Кастомный текст уже приходит от ai-generate-email-preview
    if (!emailSubject || !emailBody) {
      const { data: userProfile } = await supabaseClient
        .from('user_profiles')
        .select('name')
        .eq('user_id', userId)
        .single();

      // Fallback на простой шаблон
      emailSubject = `Предложение перенести: ${event.title}`;
      const userName = (await supabaseClient.from('user_profiles').select('name').eq('user_id', userId).single()).data?.name || 'Пользователь';
      const newStartDate = new Date(suggestion.suggested_new_start);
      
      emailBody = `Здравствуйте!

Предлагаю перенести встречу "${event.title}" с ${new Date(event.start_time).toLocaleString('ru-RU')} на ${newStartDate.toLocaleString('ru-RU')}.

Причина: ${suggestion.reason}

Подходит ли вам новое время?

С уважением,
${userName}`;
    }

    let emailSent = false;
    let threadId = '';

    // Retry логика для отправки
    let sendRetries = 3;
    
    while (sendRetries > 0 && !emailSent) {
      try {
        if (emailProvider === 'google') {
          // Отправить через Gmail API с таймаутом
          const message = [
            'Content-Type: text/plain; charset=utf-8',
            'MIME-Version: 1.0',
            `To: ${participants.join(', ')}`,
            `Subject: ${emailSubject}`,
            '',
            emailBody
          ].join('\n');

          const encodedMessage = btoa(unescape(encodeURIComponent(message)))
            .replace(/\+/g, '-')
            .replace(/\//g, '_')
            .replace(/=+$/, '');

          const sendResponse = await withTimeout(
            fetch(
              'https://gmail.googleapis.com/gmail/v1/users/me/messages/send',
            {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/json',
              },
                body: JSON.stringify({ raw: encodedMessage }),
              }
            ),
            45000, // 45 секунд таймаут для отправки email
            'Gmail send email'
          );

          if (sendResponse.ok) {
            const sendData = await sendResponse.json();
            emailSent = true;
            threadId = sendData.threadId;
          } else if (sendResponse.status >= 500) {
            await logRetryAttempt({
              supabaseClient,
              userId: userId!,
              operationType: 'email_send_gmail',
              attemptNumber: 4 - sendRetries,
              httpStatus: sendResponse.status,
              errorMessage: `Gmail API error: ${sendResponse.status}`,
            });
            throw new Error('Server error, retrying...');
          }
        } else {
          // Microsoft Graph API с таймаутом
          const sendResponse = await withTimeout(
            fetch(
              'https://graph.microsoft.com/v1.0/me/sendMail',
              {
                method: 'POST',
                headers: {
                  'Authorization': `Bearer ${accessToken}`,
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                  message: {
                    subject: emailSubject,
                    body: {
                      contentType: 'Text',
                      content: emailBody
                    },
                    toRecipients: participants.map(email => ({
                      emailAddress: { address: email }
                    }))
                  }
                }),
              }
            ),
            45000,
            'Microsoft Graph send email'
          );

          if (sendResponse.ok) {
            emailSent = true;
          } else if (sendResponse.status >= 500) {
            await logRetryAttempt({
              supabaseClient,
              userId: userId!,
              operationType: 'email_send_microsoft',
              attemptNumber: 4 - sendRetries,
              httpStatus: sendResponse.status,
              errorMessage: `Microsoft Graph API error: ${sendResponse.status}`,
            });
            throw new Error('Server error, retrying...');
          }
        }
        
        if (emailSent) break;
        sendRetries--;
      } catch (error) {
        console.error(`Send attempt failed, ${sendRetries - 1} retries left:`, error);
        
        await logRetryAttempt({
          supabaseClient,
          userId: userId!,
          operationType: 'email_send',
          attemptNumber: 4 - sendRetries,
          errorMessage: error instanceof Error ? error.message : 'Unknown error',
        });
        
        sendRetries--;
        if (sendRetries > 0) {
          await new Promise(resolve => setTimeout(resolve, 1000 * (4 - sendRetries)));
        }
      }
    }

    // Логировать результат отправки
    await logOperationMetric({
      supabaseClient,
      operationType: 'email_send',
      status: emailSent ? 'success' : 'error',
      executionTimeMs: timer.getElapsedMs(),
      userId: userId!,
      errorDetails: emailSent ? undefined : 'Failed to send email after retries',
      metadata: { participants_count: participants.length },
    });

    if (!emailSent) {
      await logErrorNotification({
        supabaseClient,
        errorType: 'email_send_failure',
        severity: 'high',
        message: `Не удалось отправить письмо для события "${event.title}" после 3 попыток`,
        operationType: 'email_send',
        userId: userId!,
      });
    }

    // Обновить статус предложения
    await supabaseClient
      .from('event_move_suggestions')
      .update({
        status: emailSent ? 'email_sent' : 'failed',
        email_sent_at: emailSent ? new Date().toISOString() : null,
        email_thread_id: threadId,
        participants,
      })
      .eq('id', suggestionId);

    // Добавить сообщение в чат
    await supabaseClient
      .from('chat_messages')
      .insert({
        user_id: userId,
        role: 'assistant',
        content: emailSent
          ? `✅ Письмо отправлено участникам (${participants.length} чел.). Жду ответов...`
          : '❌ Не удалось отправить письмо. Попробуй позже.'
      });

    console.log(`Email sent for suggestion ${suggestionId}:`, emailSent);

    return new Response(
      JSON.stringify({ 
        success: emailSent,
        message: emailSent ? 'Письмо отправлено' : 'Ошибка отправки'
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );

  } catch (error) {
    console.error('Error in ai-handle-event-move:', error);
    
    // Логировать ошибку
    if (userId) {
      const supabaseClient = createClient(
        Deno.env.get('SUPABASE_URL') ?? '',
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      );
      
      await logOperationMetric({
        supabaseClient,
        operationType: 'email_send',
        status: 'error',
        executionTimeMs: timer.getElapsedMs(),
        userId,
        errorDetails: error instanceof Error ? error.message : 'Unknown error',
      });

      await logErrorNotification({
        supabaseClient,
        errorType: 'event_move_failure',
        severity: 'high',
        message: `Ошибка при обработке переноса события: ${error instanceof Error ? error.message : 'Unknown'}`,
        operationType: 'event_move',
        userId,
      });
    }
    
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
