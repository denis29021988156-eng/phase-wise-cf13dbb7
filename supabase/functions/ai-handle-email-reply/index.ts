import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Input validation schema
interface EmailReplyInput {
  threadId: string;
  emailBody: string;
  userId: string;
}

function validateInput(data: any): EmailReplyInput {
  if (!data || typeof data !== 'object') {
    throw new Error('Invalid request body');
  }

  const { threadId, emailBody, userId } = data;

  // Validate threadId
  if (!threadId || typeof threadId !== 'string' || threadId.length > 100) {
    throw new Error('Invalid threadId: must be a string with max 100 characters');
  }

  // Validate emailBody
  if (!emailBody || typeof emailBody !== 'string' || emailBody.length > 10000) {
    throw new Error('Invalid emailBody: must be a string with max 10000 characters');
  }

  // Validate userId (must be valid UUID format)
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!userId || typeof userId !== 'string' || !uuidRegex.test(userId)) {
    throw new Error('Invalid userId: must be a valid UUID');
  }

  return { threadId, emailBody, userId };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    );

    // Validate and parse input
    const rawBody = await req.json();
    const { threadId, emailBody, userId } = validateInput(rawBody);

    console.log('Processing email reply for thread:', threadId);

    // Найти предложение по thread ID и проверить принадлежность пользователю
    const { data: suggestion, error: suggestionError } = await supabaseClient
      .from('event_move_suggestions')
      .select(`
        *,
        events (*)
      `)
      .eq('email_thread_id', threadId)
      .eq('status', 'email_sent')
      .eq('user_id', userId)
      .single();

    if (suggestionError || !suggestion) {
      console.log('No pending suggestion found for thread:', threadId, 'and user:', userId);
      return new Response(
        JSON.stringify({ success: false, message: 'Предложение не найдено или доступ запрещен' }),
        {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Дополнительная проверка владельца
    if (suggestion.user_id !== userId) {
      console.error('Unauthorized access attempt: suggestion belongs to', suggestion.user_id, 'but request claims', userId);
      return new Response(
        JSON.stringify({ success: false, message: 'Доступ запрещен' }),
        {
          status: 403,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Анализировать ответ с помощью AI
    const openAIApiKey = Deno.env.get('OPENAI_API_KEY');
    
    // Sanitize emailBody before sending to AI (limit length, remove potential injection attempts)
    const sanitizedEmailBody = emailBody.substring(0, 5000).replace(/[<>]/g, '');
    
    const aiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openAIApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { 
            role: 'system', 
            content: 'Ты анализируешь ответы на предложение переноса встречи. Определи: человек согласен, не согласен, или предлагает другое время. Отвечай только JSON.' 
          },
          { 
            role: 'user', 
            content: `Письмо: "${sanitizedEmailBody}"\n\nОтветь в JSON:\n{"accepted": true/false, "alternative_suggested": true/false, "alternative_time": "если предложено, то в формате YYYY-MM-DD HH:MM"}` 
          }
        ],
        temperature: 0.3,
        max_tokens: 150,
      }),
    });

    if (!aiResponse.ok) {
      throw new Error('AI analysis failed');
    }

    const aiData = await aiResponse.json();
    let content = aiData.choices[0].message.content;
    
    // Remove markdown code blocks if present
    content = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    
    const analysis = JSON.parse(content);

    let newStatus = 'completed';
    let chatMessage = '';
    let updateEvent = false;
    let newStartTime = suggestion.suggested_new_start;
    let newEndTime = suggestion.suggested_new_end;

    if (analysis.accepted) {
      chatMessage = `✅ Участники согласились! Встреча "${suggestion.events.title}" перенесена на ${new Date(suggestion.suggested_new_start).toLocaleString('ru-RU')}`;
      updateEvent = true;
    } else if (analysis.alternative_suggested && analysis.alternative_time) {
      const altDate = new Date(analysis.alternative_time);
      const duration = new Date(suggestion.events.end_time).getTime() - new Date(suggestion.events.start_time).getTime();
      newStartTime = altDate.toISOString();
      newEndTime = new Date(altDate.getTime() + duration).toISOString();
      chatMessage = `🔄 Участники предложили другое время: ${altDate.toLocaleString('ru-RU')}. Переношу встречу.`;
      updateEvent = true;
    } else {
      chatMessage = `❌ Участники не согласились перенести встречу "${suggestion.events.title}". Оставляю как есть.`;
      newStatus = 'rejected';
    }

    // Обновить событие если нужно
    if (updateEvent) {
      const event = suggestion.events;
      
      // Обновить в БД
      await supabaseClient
        .from('events')
        .update({
          start_time: newStartTime,
          end_time: newEndTime,
        })
        .eq('id', event.id);

      // Обновить в календаре (Google/Outlook)
      if (event.source === 'google' && event.google_event_id) {
        await supabaseClient.functions.invoke('update-google-event', {
          body: {
            userId: suggestion.user_id,
            eventId: event.id,
            eventData: {
              title: event.title,
              startTime: newStartTime,
              endTime: newEndTime,
            }
          }
        });
      } else if (event.source === 'outlook') {
        await supabaseClient.functions.invoke('update-outlook-event', {
          body: {
            userId: suggestion.user_id,
            eventId: event.id,
            eventData: {
              title: event.title,
              startTime: newStartTime,
              endTime: newEndTime,
            }
          }
        });
      }
    }

    // Обновить статус предложения
    await supabaseClient
      .from('event_move_suggestions')
      .update({ status: newStatus })
      .eq('id', suggestion.id);

    // Добавить сообщение в чат
    await supabaseClient
      .from('chat_messages')
      .insert({
        user_id: suggestion.user_id,
        role: 'assistant',
        content: chatMessage
      });

    console.log(`Email reply processed for suggestion ${suggestion.id}:`, newStatus);

    return new Response(
      JSON.stringify({ 
        success: true,
        message: 'Ответ обработан',
        status: newStatus
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );

  } catch (error) {
    console.error('Error in ai-handle-email-reply:', error);
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
