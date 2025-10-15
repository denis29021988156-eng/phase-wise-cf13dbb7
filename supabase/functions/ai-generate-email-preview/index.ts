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

    console.log('Generating email preview for suggestion:', suggestionId);

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

    // Получить email участников
    let participants: string[] = [];
    
    // Определить провайдера
    let emailProvider = 'google';
    if (event.source === 'outlook' || event.source === 'microsoft') {
      emailProvider = 'microsoft';
    }

    // Получить токен
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
    try {
      if (emailProvider === 'google' && event.google_event_id) {
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
      } else if (emailProvider === 'microsoft' && event.google_event_id) {
        const eventResponse = await fetch(
          `https://graph.microsoft.com/v1.0/me/events/${event.google_event_id}`,
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
      }
    } catch (error) {
      console.error('Error fetching participants:', error);
    }

    // Получить профиль пользователя
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
    let retries = 3;
    
    // Retry логика для AI генерации
    while (retries > 0 && !emailBody) {
      try {
        const aiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${openAIApiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: 'gpt-5-nano-2025-08-07', // Быстрая модель для генерации текста
            messages: [
              { role: 'system', content: 'Ты помощник для написания деловых писем. Пиши кратко и естественно.' },
              { role: 'user', content: aiPrompt }
            ],
            max_completion_tokens: 200, // Новые модели используют max_completion_tokens
          }),
        });

        if (aiResponse.ok) {
          const aiData = await aiResponse.json();
          emailBody = aiData.choices[0].message.content.trim();
          console.log('AI generated email body:', emailBody);
          break;
        } else if (aiResponse.status === 429 || aiResponse.status >= 500) {
          retries--;
          if (retries > 0) {
            await new Promise(resolve => setTimeout(resolve, 1000 * (4 - retries)));
            continue;
          }
        }
        break;
      } catch (aiError) {
        console.error(`AI generation attempt failed, ${retries - 1} retries left:`, aiError);
        retries--;
        if (retries > 0) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }
    }
    
    // Fallback если AI не сработал
    if (!emailBody) {
      console.log('Using fallback template');
      emailBody = `Здравствуйте!

Предлагаю перенести встречу "${event.title}" с ${new Date(event.start_time).toLocaleString('ru-RU')} на ${newStartDate.toLocaleString('ru-RU')}.

Причина: ${suggestion.reason}

Подходит ли вам новое время?

С уважением,
${userName}`;
    }

    const emailSubject = `Предложение перенести: ${event.title}`;

    console.log('Email preview generated successfully');

    return new Response(
      JSON.stringify({ 
        success: true,
        preview: {
          subject: emailSubject,
          body: emailBody,
          recipients: participants,
          eventTitle: event.title
        }
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );

  } catch (error) {
    console.error('Error in ai-generate-email-preview:', error);
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
