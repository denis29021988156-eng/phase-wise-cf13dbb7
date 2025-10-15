import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const openAIApiKey = Deno.env.get('OPENAI_API_KEY');

// Определяем фазы цикла и их описания
const getCyclePhase = (cycleDay: number, cycleLength: number = 28, menstrualLength: number = 5) => {
  if (cycleDay >= 1 && cycleDay <= menstrualLength) {
    return {
      phase: 'Менструация',
      description: 'снижение энергии, потребность в отдыхе, возможные болевые ощущения, эмоциональная чувствительность'
    };
  } else if (cycleDay >= menstrualLength + 1 && cycleDay <= 13) {
    return {
      phase: 'Фолликулярная фаза',
      description: 'повышение энергии, улучшение настроения, активность, хорошая концентрация'
    };
  } else if (cycleDay >= 14 && cycleDay <= 16) {
    return {
      phase: 'Овуляция',
      description: 'пик энергии, социальная активность, повышенная привлекательность, возможны тянущие боли'
    };
  } else {
    return {
      phase: 'Лютеиновая фаза',
      description: 'постепенное снижение энергии, возможная раздражительность, потребность в комфорте, изменения аппетита'
    };
  }
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    if (!openAIApiKey) {
      throw new Error('OpenAI API key не настроен');
    }

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: req.headers.get('Authorization')! },
        },
      }
    );

    const { event, cycleData, timezone = 'UTC' } = await req.json();

    console.log('Generating AI suggestion for event:', event.title);
    console.log('Cycle data:', cycleData);

    // Get user from auth
    const { data: { user } } = await supabaseClient.auth.getUser();
    if (!user) {
      throw new Error('Пользователь не аутентифицирован');
    }

    // Get user profile for name and physical parameters
    const { data: profile } = await supabaseClient
      .from('user_profiles')
      .select('*')
      .eq('user_id', user.id)
      .maybeSingle();

    // Build profile context
    let profileContext = '';
    if (profile) {
      const profileParts = [];
      if (profile.age) profileParts.push(`Возраст: ${profile.age} лет`);
      if (profile.height) profileParts.push(`Рост: ${profile.height} см`);
      if (profile.weight) profileParts.push(`Вес: ${profile.weight} кг`);
      
      if (profileParts.length > 0) {
        profileContext = `\n\nДанные пользователя:\n${profileParts.join('\n')}\n(Используй для персонализации советов по активности и питанию)`;
      }
    }

    // Get today's symptom log
    const today = new Date().toISOString().split('T')[0];
    const { data: todaySymptoms } = await supabaseClient
      .from('symptom_logs')
      .select('*')
      .eq('user_id', user.id)
      .eq('date', today)
      .maybeSingle();

    // Get recent chat history to understand user's health context (last 10 messages)
    const { data: recentMessages } = await supabaseClient
      .from('chat_messages')
      .select('content, created_at')
      .eq('user_id', user.id)
      .eq('role', 'user')
      .order('created_at', { ascending: false })
      .limit(10);

    // Build health context from symptoms and recent messages
    let healthContext = '';
    
    // Add symptom data if available
    if (todaySymptoms) {
      const moodLabels: Record<string, string> = {
        happy: 'радость', calm: 'спокойствие', anxious: 'тревога',
        irritable: 'раздражение', sad: 'грусть', motivated: 'вдохновение'
      };
      const physicalLabels: Record<string, string> = {
        pain: 'боль', fatigue: 'усталость', energy: 'бодрость',
        cramps: 'спазмы', headache: 'головная боль', bloating: 'вздутие'
      };
      
      healthContext += '\n📊 ДАННЫЕ О САМОЧУВСТВИИ СЕГОДНЯ:\n';
      healthContext += `- Индекс самочувствия: ${todaySymptoms.wellness_index}/100\n`;
      healthContext += `- Энергия: ${todaySymptoms.energy}/5\n`;
      healthContext += `- Качество сна: ${todaySymptoms.sleep_quality}/5\n`;
      healthContext += `- Уровень стресса: ${todaySymptoms.stress_level}/5\n`;
      
      if (todaySymptoms.mood && todaySymptoms.mood.length > 0) {
        healthContext += `- Настроение: ${todaySymptoms.mood.map((m: string) => moodLabels[m] || m).join(', ')}\n`;
      }
      
      if (todaySymptoms.physical_symptoms && todaySymptoms.physical_symptoms.length > 0) {
        healthContext += `- Физические симптомы: ${todaySymptoms.physical_symptoms.map((s: string) => physicalLabels[s] || s).join(', ')}\n`;
      }
      healthContext += '\n';
    }
    
    // Add chat context
    if (recentMessages && recentMessages.length > 0) {
      const healthKeywords = ['болею', 'болит', 'устала', 'плохо', 'больно', 'недомогание', 'головная боль', 'спина', 'живот', 'тошнит', 'слабость'];
      const relevantMessages = recentMessages.filter(msg => 
        healthKeywords.some(keyword => msg.content.toLowerCase().includes(keyword))
      );
      
      if (relevantMessages.length > 0) {
        healthContext += `💬 Контекст из недавних сообщений:\n${relevantMessages.map(msg => `- ${msg.content}`).join('\n')}\n`;
      }
    }

    const { phase, description } = getCyclePhase(cycleData.cycleDay, cycleData.cycleLength, cycleData.menstrualLength || 5);
    // Используем локальное время, если оно передано, иначе форматируем из ISO
    const eventTime = event.start_time_local || new Date(event.start_time).toLocaleTimeString('ru-RU', {
      hour: '2-digit',
      minute: '2-digit',
      timeZone: timezone
    });

    // Определяем время суток для события
    const eventDate = new Date(event.start_time);
    const eventHour = eventDate.getHours();
    let timeOfDayContext = '';
    
    if (eventHour >= 5 && eventHour < 7) {
      timeOfDayContext = ' (очень раннее утро - важно учесть, что организм может быть не готов к активности)';
    } else if (eventHour >= 7 && eventHour < 9) {
      timeOfDayContext = ' (раннее утро)';
    } else if (eventHour >= 22 || eventHour < 5) {
      timeOfDayContext = ' (поздний вечер/ночь - важно учесть влияние на сон и восстановление)';
    } else if (eventHour >= 20 && eventHour < 22) {
      timeOfDayContext = ' (вечер)';
    }

    const userName = profile?.name ? profile.name : 'дорогая';

    // Build user profile context
    let profileContext = '';
    if (profile?.age || profile?.height || profile?.weight) {
      profileContext = '\n📋 Данные пользователя:\n';
      if (profile.age) profileContext += `• Возраст: ${profile.age} лет\n`;
      if (profile.height) profileContext += `• Рост: ${profile.height} см\n`;
      if (profile.weight) profileContext += `• Вес: ${profile.weight} кг\n`;
    }

    const prompt = `
Оцени запланированное событие с учётом текущей фазы менструального цикла пользовательницы и её самочувствия, после чего предоставь свои рекомендации.

Контекст:
• День цикла: ${cycleData.cycleDay}-й (${phase})
• Особенности: ${description}
• Событие: «${event.title}»
• Время события: ${eventTime}${timeOfDayContext}
${healthContext ? '• Дополнительные сведения о самочувствии: ' + healthContext + '' : ''}
${profileContext}

ВАЖНО: Твой ответ должен быть КРАТКИМ - максимум 3-4 предложения (на 20-25% короче обычного формата). 

Задание: Напиши для ${userName} краткую, но ёмкую оценку этого мероприятия, учитывая её цикл, состояние И ВРЕМЯ СОБЫТИЯ. В ответе необходимо:
• Коротко описать влияние текущей фазы цикла на энергию и самочувствие
• ОБЯЗАТЕЛЬНО учесть время проведения события (если это раннее утро или поздний вечер - дай конкретные рекомендации с учётом этого!)
• Дать 1-2 практических совета по подготовке к событию
• Если есть информация о самочувствии, учесть её при формулировке

Начни ответ, обратившись к ${userName} одной из фраз:
• "${userName}, смотри…"
• "Слушай, ${userName}…"
• "Знаешь, ${userName}…"
• "${userName}, давай разберём…"

Справка по фазам цикла:
• Дни 1–5 – Менструация: сниженная энергия, усталость, потребность в отдыхе
• Дни 6–13 – Фолликулярная фаза: подъём энергии, улучшение настроения и концентрации
• Дни 14–16 – Овуляция: пик энергии и выносливости, высокая активность
• Дни 17+ – Лютеиновая фаза: снижение энергии, возможна раздражительность

ПОМНИ: Ответ должен быть максимально кратким (3-4 предложения) и обязательно учитывать время события!
`;

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openAIApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: 'Ты — продвинутый и заботливый виртуальный помощник по женскому здоровью с глубоким пониманием менструального цикла и общего самочувствия женщин. Твоя главная задача — давать компетентные, КРАТКИЕ и персонализированные рекомендации на основе текущей фазы цикла и состояния пользовательницы. Отвечай на русском языке, используя простой и понятный стиль изложения. Тон ответа должен быть дружелюбным, участливым и поддерживающим. ВАЖНО: твои ответы должны быть короткими - максимум 3-4 предложения, но при этом информативными и полезными.' },
          { role: 'user', content: prompt }
        ],
        temperature: 0.7,
        max_tokens: 500
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error('OpenAI API error:', errorData);
      throw new Error(`OpenAI API error: ${errorData.error?.message || response.statusText}`);
    }

    const data = await response.json();
    const suggestion = data.choices[0].message.content;
    const justification = `ИИ-совет для ${phase.toLowerCase()} (${cycleData.cycleDay} день цикла)`;

    console.log('Generated AI suggestion:', suggestion);

    return new Response(
      JSON.stringify({ 
        suggestion, 
        justification,
        cycleDay: cycleData.cycleDay,
        cycleLength: cycleData.cycleLength,
        phase: phase
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Error in generate-ai-suggestion function:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});