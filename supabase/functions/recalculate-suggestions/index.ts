import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { userId } = await req.json();

    if (!userId) {
      return new Response(
        JSON.stringify({ error: 'userId is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const openAIApiKey = Deno.env.get('OPENAI_API_KEY')!;

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get user cycle data
    const { data: cycleData, error: cycleError } = await supabase
      .from('user_cycles')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (cycleError || !cycleData) {
      return new Response(
        JSON.stringify({ error: 'User cycle not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get user profile for name
    const { data: profileData } = await supabase
      .from('user_profiles')
      .select('name')
      .eq('user_id', userId)
      .maybeSingle();

    const userName = profileData?.name || 'ты';

    // Get all future events (including today)
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const { data: events, error: eventsError } = await supabase
      .from('events')
      .select('*')
      .eq('user_id', userId)
      .gte('start_time', today.toISOString());

    if (eventsError) {
      console.error('Error fetching events:', eventsError);
      return new Response(
        JSON.stringify({ error: 'Failed to fetch events' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!events || events.length === 0) {
      return new Response(
        JSON.stringify({ message: 'No future events to recalculate', recalculated: 0 }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get recent chat messages for context
    const { data: recentMessages } = await supabase
      .from('chat_messages')
      .select('content, role')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(5);

    // Get today's symptom log for additional context
    const todayDate = new Date().toISOString().split('T')[0];
    const { data: todaySymptoms } = await supabase
      .from('symptom_logs')
      .select('*')
      .eq('user_id', userId)
      .eq('date', todayDate)
      .maybeSingle();

    let healthContext = '';
    if (recentMessages && recentMessages.length > 0) {
      const userMessages = recentMessages.filter(m => m.role === 'user').slice(0, 3);
      if (userMessages.length > 0) {
        healthContext = '\n\nПоследние сообщения о самочувствии:\n' + 
          userMessages.map(m => `- ${m.content}`).join('\n');
      }
    }

    // Add symptom data if available
    if (todaySymptoms) {
      healthContext += '\n\nДанные о самочувствии сегодня:';
      if (todaySymptoms.wellness_index) healthContext += `\n- Индекс самочувствия: ${todaySymptoms.wellness_index}/100`;
      if (todaySymptoms.energy) healthContext += `\n- Энергия: ${todaySymptoms.energy}/5`;
      if (todaySymptoms.sleep_quality) healthContext += `\n- Качество сна: ${todaySymptoms.sleep_quality}/5`;
      if (todaySymptoms.stress_level) healthContext += `\n- Уровень стресса: ${todaySymptoms.stress_level}/5`;
      if (todaySymptoms.weight) healthContext += `\n- Вес: ${todaySymptoms.weight} кг`;
      if (todaySymptoms.blood_pressure_systolic && todaySymptoms.blood_pressure_diastolic) {
        healthContext += `\n- Давление: ${todaySymptoms.blood_pressure_systolic}/${todaySymptoms.blood_pressure_diastolic} мм рт. ст.`;
      }
      if (todaySymptoms.had_sex !== null && todaySymptoms.had_sex !== undefined) {
        healthContext += `\n- Половая активность: ${todaySymptoms.had_sex ? 'Да' : 'Нет'}`;
      }
    }

    const recalculatedCount = events.length;
    const userTimezone = 'Europe/Moscow'; // Can be made configurable

    // Process each event
    for (const event of events) {
      try {
        const eventDate = new Date(event.start_time);
        const cycleStartDate = new Date(cycleData.start_date);
        const daysSinceStart = Math.floor((eventDate.getTime() - cycleStartDate.getTime()) / (1000 * 60 * 60 * 24));
        const cycleDay = ((daysSinceStart % cycleData.cycle_length) + cycleData.cycle_length) % cycleData.cycle_length + 1;

        // Determine phase
        let phase = '';
        let description = '';
        if (cycleDay <= cycleData.menstrual_length) {
          phase = 'менструации';
          description = 'низкий уровень энергии, повышенная чувствительность';
        } else if (cycleDay <= 13) {
          phase = 'фолликулярной фазы';
          description = 'высокая энергия, хорошая концентрация';
        } else if (cycleDay <= 15) {
          phase = 'овуляции';
          description = 'пик энергии и харизмы';
        } else {
          phase = 'лютеиновой фазы';
          description = 'снижение энергии, нужен отдых';
        }

        const eventTime = new Date(event.start_time).toLocaleTimeString('ru-RU', {
          hour: '2-digit',
          minute: '2-digit',
          timeZone: userTimezone
        });

        const systemPrompt = `Ты — профессиональный ИИ-помощник по женскому здоровью с экспертизой в менструальном цикле. 

КРИТИЧЕСКИ ВАЖНО:
• РАЗНООБРАЗИЕ НАЧАЛЬНЫХ ФРАЗ: Никогда не повторяй одно и то же начало. Варьируй стиль обращения в каждом ответе.
• Отвечай на русском языке, используй дружелюбный, но профессиональный тон.
• Будь конкретной и практичной в советах.`;

        const userPrompt = `Оцени событие для пользователя с учётом цикла и самочувствия.

Контекст:
- ${cycleDay}-й день цикла (${phase})
- Особенности фазы: ${description}
- Событие: «${event.title}»
- Время: ${eventTime}${healthContext}

Напиши развернутую оценку для ${userName === 'ты' ? 'пользователя' : userName} (4-6 предложений): 
• Влияние текущей фазы цикла на энергию
• Рекомендации по подготовке к событию
• Практические советы (питание, отдых, timing)
• Альтернативные варианты если событие неоптимально

НАЧАЛЬНЫЕ ФРАЗЫ (используй разные каждый раз):
1. "Давай посмотрим на это событие..."
2. "Интересное событие! Вот что важно учесть..."
3. "По поводу этого события..."
4. "Обрати внимание на несколько моментов..."
5. "Что нужно знать об этом событии..."
6. "Вот моя оценка..."
7. "Разберём это событие детальнее..."
8. "Несколько важных наблюдений..."
${userName !== 'ты' ? `9. "${userName}, это событие..."
10. "${userName}, вот что я думаю..."` : ''}

${healthContext ? '⚠️ ВАЖНО: Учти информацию о самочувствии в рекомендациях!' : ''}`;

        const aiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${openAIApiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: 'gpt-4o-mini',
            messages: [
              { role: 'system', content: systemPrompt },
              { role: 'user', content: userPrompt }
            ],
            temperature: 0.9,
            max_tokens: 300,
          }),
        });

        if (!aiResponse.ok) {
          console.error(`AI API error for event ${event.id}:`, await aiResponse.text());
          continue;
        }

        const aiData = await aiResponse.json();
        const suggestion = aiData.choices[0]?.message?.content || 'Не удалось сгенерировать совет';

        // Update or insert suggestion
        const { data: existingSuggestion } = await supabase
          .from('event_ai_suggestions')
          .select('id')
          .eq('event_id', event.id)
          .maybeSingle();

        if (existingSuggestion) {
          await supabase
            .from('event_ai_suggestions')
            .update({
              suggestion,
              justification: `Пересчитано для ${cycleDay} дня цикла`,
            })
            .eq('event_id', event.id);
        } else {
          await supabase
            .from('event_ai_suggestions')
            .insert({
              event_id: event.id,
              suggestion,
              justification: `Gaia для ${cycleDay} дня цикла (продолжительность ${cycleData.cycle_length} дней)`,
              decision: 'generated'
            });
        }
      } catch (eventError) {
        console.error(`Error processing event ${event.id}:`, eventError);
      }
    }

    return new Response(
      JSON.stringify({ 
        message: 'Suggestions recalculated successfully',
        recalculated: recalculatedCount
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in recalculate-suggestions:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});