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

    const { suggestionId, language = 'ru' } = await req.json();

    console.log('Generating email preview for suggestion:', suggestionId, 'language:', language);

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

    // Получить email пользователя
    const { data: authUser } = await supabaseClient.auth.getUser();
    const userEmail = authUser?.user?.email?.toLowerCase();

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
            .map((a: any) => a.email)
            .filter((email: string) => email.toLowerCase() !== userEmail); // Исключить отправителя
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
            .map((a: any) => a.emailAddress.address)
            .filter((email: string) => email.toLowerCase() !== userEmail); // Исключить отправителя
        }
      }
    } catch (error) {
      console.error('Error fetching participants:', error);
    }

    // Получить профиль пользователя (с физическими параметрами)
    const { data: userProfile } = await supabaseClient
      .from('user_profiles')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle();

    const userName = userProfile?.name || (language === 'ru' ? 'Пользователь' : 'User');
    
    // Добавить контекст профиля для более персонализированных писем
    let profileNote = '';
    if (userProfile?.age || userProfile?.height || userProfile?.weight) {
      profileNote = ' (учитывая личные особенности)';
    }

    // Сгенерировать текст письма с помощью AI
    const newStartDate = new Date(suggestion.suggested_new_start);
    const openAIApiKey = Deno.env.get('OPENAI_API_KEY');
    
    const localeStr = language === 'ru' ? 'ru-RU' : 'en-US';
    
    const aiPrompt = language === 'ru' 
      ? `Ты помощник, который пишет письма от имени ${userName} для переноса встреч${profileNote}.

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

Напиши только текст письма, без темы.`
      : `You are an assistant that writes emails on behalf of ${userName} to reschedule meetings${profileNote}.

Context:
- Meeting: "${event.title}"
- Current time: ${new Date(event.start_time).toLocaleString('en-US', { 
  weekday: 'long', 
  day: 'numeric', 
  month: 'long', 
  hour: '2-digit', 
  minute: '2-digit' 
})}
- Proposed time: ${newStartDate.toLocaleString('en-US', { 
  weekday: 'long', 
  day: 'numeric', 
  month: 'long', 
  hour: '2-digit', 
  minute: '2-digit' 
})}
- Reason for rescheduling: ${suggestion.reason}

TASK: Write a polite, brief email to participants proposing the change. 
- Tone: friendly but professional
- First person (from ${userName})
- 3-4 sentences maximum
- Ask if the new time works
- No signature needed

Write only the email body, without subject.`;

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
            model: 'gpt-5-nano-2025-08-07',
            messages: [
              { 
                role: 'system', 
                content: language === 'ru' 
                  ? 'Ты помощник для написания деловых писем. Пиши кратко и естественно.' 
                  : 'You are an assistant for writing business emails. Write concisely and naturally.'
              },
              { role: 'user', content: aiPrompt }
            ],
            max_completion_tokens: 200,
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
      const localeStr = language === 'ru' ? 'ru-RU' : 'en-US';
      
      emailBody = language === 'ru'
        ? `Здравствуйте!

Предлагаю перенести встречу "${event.title}" с ${new Date(event.start_time).toLocaleString(localeStr)} на ${newStartDate.toLocaleString(localeStr)}.

Причина: ${suggestion.reason}

Подходит ли вам новое время?

С уважением,
${userName}`
        : `Hello!

I propose to reschedule the meeting "${event.title}" from ${new Date(event.start_time).toLocaleString(localeStr)} to ${newStartDate.toLocaleString(localeStr)}.

Reason: ${suggestion.reason}

Does the new time work for you?

Best regards,
${userName}`;
    }

    const emailSubject = language === 'ru' 
      ? `Предложение перенести: ${event.title}`
      : `Proposal to reschedule: ${event.title}`;

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
