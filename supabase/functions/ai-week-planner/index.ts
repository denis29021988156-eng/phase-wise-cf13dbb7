import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface Event {
  id: string;
  title: string;
  start_time: string;
  end_time: string;
  source: string;
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

    // Получить всех пользователей с циклами
    const { data: users, error: usersError } = await supabaseClient
      .from('user_cycles')
      .select('user_id');

    if (usersError) throw usersError;

    console.log(`Starting AI week planner for ${users?.length || 0} users`);

    let totalSuggestions = 0;

    // Параллельная обработка пользователей для ускорения
    const userProcessingPromises = (users || []).map(async ({ user_id }) => {
      try {
        // Получить события на ближайшие 7 дней
        const now = new Date();
        const weekLater = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

        const { data: events, error: eventsError } = await supabaseClient
          .from('events')
          .select('*')
          .eq('user_id', user_id)
          .gte('start_time', now.toISOString())
          .lte('start_time', weekLater.toISOString())
          .order('start_time', { ascending: true });

        if (eventsError || !events || events.length === 0) {
          console.log(`No events found for user ${user_id}`);
          continue;
        }

        // Получить данные о цикле
        const { data: cycleData } = await supabaseClient
          .from('user_cycles')
          .select('*')
          .eq('user_id', user_id)
          .single();

        if (!cycleData) continue;

        // Получить недавние логи симптомов
        const { data: recentLogs } = await supabaseClient
          .from('symptom_logs')
          .select('*')
          .eq('user_id', user_id)
          .gte('date', new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0])
          .order('date', { ascending: false })
          .limit(7);

        // Анализировать нагрузку по дням
        const eventsByDay = new Map<string, Event[]>();
        events.forEach((event: Event) => {
          const day = event.start_time.split('T')[0];
          if (!eventsByDay.has(day)) {
            eventsByDay.set(day, []);
          }
          eventsByDay.get(day)!.push(event);
        });

        // Найти дни с потенциальной перегрузкой
        for (const [day, dayEvents] of eventsByDay.entries()) {
          // Пропустить если менее 2 событий
          if (dayEvents.length < 2) continue;

          // Рассчитать день цикла
          const eventDate = new Date(day);
          const startDate = new Date(cycleData.start_date);
          const diffInDays = Math.floor((eventDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
          const cycleDay = ((diffInDays % cycleData.cycle_length) + 1);

          // Менструальная или лютеиновая фаза = высокая чувствительность
          const isSensitivePhase = cycleDay <= 5 || cycleDay > (cycleData.cycle_length - 7);

          // Проверить близкие по времени события (< 1 час между ними)
          for (let i = 0; i < dayEvents.length - 1; i++) {
            const event1 = dayEvents[i];
            const event2 = dayEvents[i + 1];
            
            const end1 = new Date(event1.end_time);
            const start2 = new Date(event2.start_time);
            const gapMinutes = (start2.getTime() - end1.getTime()) / (1000 * 60);

            // Если промежуток < 60 минут или это чувствительная фаза с 3+ событиями
            if (gapMinutes < 60 || (isSensitivePhase && dayEvents.length >= 3)) {
              // Запросить AI для анализа
              const aiPrompt = `Ты AI-ассистент по планированию. Проанализируй календарь пользователя.

День цикла: ${cycleDay} из ${cycleData.cycle_length}
Фаза: ${isSensitivePhase ? 'менструальная/лютеиновая (повышенная утомляемость)' : 'фолликулярная/овуляторная'}

События в этот день (${day}):
${dayEvents.map((e, idx) => `${idx + 1}. ${e.title} (${new Date(e.start_time).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })} - ${new Date(e.end_time).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })})`).join('\n')}

Недавнее самочувствие:
${recentLogs?.map(log => `${log.date}: Энергия ${log.energy}/10, Сон ${log.sleep_quality}/10, Стресс ${log.stress_level}/10`).join('\n') || 'Нет данных'}

ЗАДАЧА: Если видишь перегрузку или плотное расписание в неблагоприятную фазу, предложи перенести ОДНО конкретное событие на другой день/время. 

Ответь в формате JSON:
{
  "should_suggest": true/false,
  "event_to_move": "название события",
  "reason": "краткое объяснение (2-3 предложения)",
  "suggested_new_date": "YYYY-MM-DD",
  "suggested_new_time": "HH:MM"
}

Если переносить не нужно, верни {"should_suggest": false}`;

              const openAIApiKey = Deno.env.get('OPENAI_API_KEY');
              
              // Retry логика для API calls
              let aiResponse;
              let retries = 3;
              
              while (retries > 0) {
                try {
                  aiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
                    method: 'POST',
                    headers: {
                      'Authorization': `Bearer ${openAIApiKey}`,
                      'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                      model: 'gpt-5-nano-2025-08-07', // Быстрая модель для классификации
                      messages: [
                        { role: 'system', content: 'Ты помощник по планированию с учетом менструального цикла. Отвечай только JSON.' },
                        { role: 'user', content: aiPrompt }
                      ],
                      max_completion_tokens: 250, // Новые модели используют max_completion_tokens
                    }),
                  });
                  
                  if (aiResponse.ok) break;
                  
                  if (aiResponse.status === 429 || aiResponse.status >= 500) {
                    retries--;
                    if (retries > 0) {
                      await new Promise(resolve => setTimeout(resolve, 1000 * (4 - retries))); // Exponential backoff
                      continue;
                    }
                  }
                  break;
                } catch (error) {
                  retries--;
                  if (retries === 0) throw error;
                  await new Promise(resolve => setTimeout(resolve, 1000));
                }
              }

              if (!aiResponse.ok) {
                console.error('OpenAI API error:', await aiResponse.text());
                continue;
              }

              const aiData = await aiResponse.json();
              const aiSuggestion = JSON.parse(aiData.choices[0].message.content);

              if (!aiSuggestion.should_suggest) continue;

              // Найти событие для переноса
              const eventToMove = dayEvents.find(e => 
                e.title.toLowerCase().includes(aiSuggestion.event_to_move.toLowerCase()) ||
                aiSuggestion.event_to_move.toLowerCase().includes(e.title.toLowerCase())
              );

              if (!eventToMove) continue;

              // Создать новое время
              const newStartDate = new Date(`${aiSuggestion.suggested_new_date}T${aiSuggestion.suggested_new_time}:00`);
              const duration = new Date(eventToMove.end_time).getTime() - new Date(eventToMove.start_time).getTime();
              const newEndDate = new Date(newStartDate.getTime() + duration);

              // Сохранить предложение
              const { error: suggestionError } = await supabaseClient
                .from('event_move_suggestions')
                .insert({
                  user_id,
                  event_id: eventToMove.id,
                  suggestion_text: `Предлагаю перенести "${eventToMove.title}" на ${newStartDate.toLocaleDateString('ru-RU')} ${newStartDate.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}`,
                  reason: aiSuggestion.reason,
                  suggested_new_start: newStartDate.toISOString(),
                  suggested_new_end: newEndDate.toISOString(),
                  status: 'pending'
                });

              if (!suggestionError) {
                console.log(`Created suggestion for user ${user_id}: move "${eventToMove.title}"`);
              }

              // Добавить в чат
              await supabaseClient
                .from('chat_messages')
                .insert({
                  user_id,
                  role: 'assistant',
                  content: `📅 ${aiSuggestion.reason}\n\n${aiSuggestion.event_to_move} → ${newStartDate.toLocaleDateString('ru-RU')} в ${newStartDate.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}\n\nХочешь, чтобы я написал участникам?`
                });

              return 1; // Возвращаем 1 созданное предложение
            }
          }
        }
        
        return 0; // Нет предложений создано

        return 0; // Возвращаем 0 предложений при успехе без создания
      } catch (userError) {
        console.error(`Error processing user ${user_id}:`, userError);
        return 0;
      }
    });

    // Ждём завершения всех пользователей
    const results = await Promise.all(userProcessingPromises);
    totalSuggestions = results.reduce((sum, count) => sum + count, 0);

    console.log(`AI week planner completed: ${totalSuggestions} suggestions created`);

    return new Response(
      JSON.stringify({ 
        success: true,
        suggestions_created: totalSuggestions,
        message: `Создано ${totalSuggestions} предложений по переносу`
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );

  } catch (error) {
    console.error('Error in ai-week-planner:', error);
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
