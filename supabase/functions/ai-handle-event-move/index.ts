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

    const { suggestionId } = await req.json();

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
    const userId = suggestion.user_id;

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
      // Microsoft Graph API
      // TODO: Получить участников из Outlook
      participants = [];
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

    // Получить профиль пользователя для персонализации
    const { data: userProfile } = await supabaseClient
      .from('user_profiles')
      .select('name')
      .eq('user_id', userId)
      .single();

    const userName = userProfile?.name || 'Пользователь';

    // Сгенерировать текст письма с помощью AI
    const newStartDate = new Date(suggestion.suggested_new_start);
    const openAIApiKey = Deno.env.get('OPENAI_API_KEY');
    
    const aiPrompt = `Ты помощник, который пишет письма от имени ${userName} для переноса встреч.

Контекст:
- Встреча: "${event.title}"
- Текущее время: ${new Date(event.start_time).toLocaleString('ru-RU', { 
  weekday: 'long', 
  day: 'numeric', 
  month: 'long', 
  hour: '2-digit', 
  minute: '2-digit' 
})}
- Предлагаемое время: ${newStartDate.toLocaleString('ru-RU', { 
  weekday: 'long', 
  day: 'numeric', 
  month: 'long', 
  hour: '2-digit', 
  minute: '2-digit' 
})}
- Причина переноса: ${suggestion.reason}

ЗАДАЧА: Напиши вежливое, короткое письмо участникам с предложением переноса. 
- Тон: дружелюбный, но профессиональный
- От первого лица (от ${userName})
- 3-4 предложения максимум
- Спроси, подходит ли новое время
- Не нужно подписи

Напиши только текст письма, без темы.`;

    let emailBody = '';
    
    try {
      const aiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${openAIApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          messages: [
            { role: 'system', content: 'Ты помощник для написания деловых писем. Пиши кратко и естественно.' },
            { role: 'user', content: aiPrompt }
          ],
          temperature: 0.7,
          max_tokens: 200,
        }),
      });

      if (aiResponse.ok) {
        const aiData = await aiResponse.json();
        emailBody = aiData.choices[0].message.content.trim();
        console.log('AI generated email body:', emailBody);
      } else {
        // Fallback к шаблонному письму
        emailBody = `Здравствуйте!

Предлагаю перенести встречу "${event.title}" с ${new Date(event.start_time).toLocaleString('ru-RU')} на ${newStartDate.toLocaleString('ru-RU')}.

Причина: ${suggestion.reason}

Подходит ли вам новое время?

С уважением,
${userName}`;
      }
    } catch (aiError) {
      console.error('AI generation failed, using template:', aiError);
      // Fallback к шаблонному письму
      emailBody = `Здравствуйте!

Предлагаю перенести встречу "${event.title}" с ${new Date(event.start_time).toLocaleString('ru-RU')} на ${newStartDate.toLocaleString('ru-RU')}.

Причина: ${suggestion.reason}

Подходит ли вам новое время?

С уважением,
${userName}`;
    }

    const emailSubject = `Предложение перенести: ${event.title}`;
    let emailSent = false;
    let threadId = '';

    if (emailProvider === 'google') {
      // Отправить через Gmail API
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

      const sendResponse = await fetch(
        'https://gmail.googleapis.com/gmail/v1/users/me/messages/send',
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ raw: encodedMessage }),
        }
      );

      if (sendResponse.ok) {
        const sendData = await sendResponse.json();
        emailSent = true;
        threadId = sendData.threadId;
      }
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
