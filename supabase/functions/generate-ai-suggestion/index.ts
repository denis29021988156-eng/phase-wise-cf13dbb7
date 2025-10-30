import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const openAIApiKey = Deno.env.get('OPENAI_API_KEY');

// Определяем фазы цикла и их описания
const getCyclePhase = (cycleDay: number, cycleLength: number = 28, menstrualLength: number = 5, language: string = 'ru') => {
  const isEnglish = language === 'en';
  
  if (cycleDay >= 1 && cycleDay <= menstrualLength) {
    return {
      phase: isEnglish ? 'Menstruation' : 'Менструация',
      description: isEnglish 
        ? 'reduced energy, need for rest, possible pain, emotional sensitivity'
        : 'снижение энергии, потребность в отдыхе, возможные болевые ощущения, эмоциональная чувствительность'
    };
  } else if (cycleDay >= menstrualLength + 1 && cycleDay <= 13) {
    return {
      phase: isEnglish ? 'Follicular Phase' : 'Фолликулярная фаза',
      description: isEnglish
        ? 'increased energy, improved mood, activity, good concentration'
        : 'повышение энергии, улучшение настроения, активность, хорошая концентрация'
    };
  } else if (cycleDay >= 14 && cycleDay <= 16) {
    return {
      phase: isEnglish ? 'Ovulation' : 'Овуляция',
      description: isEnglish
        ? 'peak energy, social activity, increased attractiveness, possible pulling pain'
        : 'пик энергии, социальная активность, повышенная привлекательность, возможны тянущие боли'
    };
  } else {
    return {
      phase: isEnglish ? 'Luteal Phase' : 'Лютеиновая фаза',
      description: isEnglish
        ? 'gradual decrease in energy, possible irritability, need for comfort, appetite changes'
        : 'постепенное снижение энергии, возможная раздражительность, потребность в комфорте, изменения аппетита'
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

    const { event, cycleData, timezone = 'UTC', healthDataSynced = false } = await req.json();
    const language = cycleData.language || 'ru';
    const isEnglish = language === 'en';

    console.log('Generating AI suggestion for event:', event.title);
    console.log('Cycle data:', cycleData);
    console.log('Health data synced from Apple Health:', healthDataSynced);

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
      if (isEnglish) {
        if (profile.age) profileParts.push(`Age: ${profile.age} years`);
        if (profile.height) profileParts.push(`Height: ${profile.height} cm`);
        if (profile.weight) profileParts.push(`Weight: ${profile.weight} kg`);
      } else {
        if (profile.age) profileParts.push(`Возраст: ${profile.age} лет`);
        if (profile.height) profileParts.push(`Рост: ${profile.height} см`);
        if (profile.weight) profileParts.push(`Вес: ${profile.weight} кг`);
      }
      
      if (profileParts.length > 0) {
        profileContext = isEnglish 
          ? `\n\nUser data:\n${profileParts.join('\n')}\n(Use for personalized activity and nutrition advice)`
          : `\n\nДанные пользователя:\n${profileParts.join('\n')}\n(Используй для персонализации советов по активности и питанию)`;
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
      const moodLabels: Record<string, Record<string, string>> = {
        en: {
          happy: 'joy', calm: 'calmness', anxious: 'anxiety',
          irritable: 'irritation', sad: 'sadness', motivated: 'motivation'
        },
        ru: {
          happy: 'радость', calm: 'спокойствие', anxious: 'тревога',
          irritable: 'раздражение', sad: 'грусть', motivated: 'вдохновение'
        }
      };
      const physicalLabels: Record<string, Record<string, string>> = {
        en: {
          pain: 'pain', fatigue: 'fatigue', energy: 'energy',
          cramps: 'cramps', headache: 'headache', bloating: 'bloating'
        },
        ru: {
          pain: 'боль', fatigue: 'усталость', energy: 'бодрость',
          cramps: 'спазмы', headache: 'головная боль', bloating: 'вздутие'
        }
      };
      
      const lang = isEnglish ? 'en' : 'ru';
      
      healthContext += isEnglish 
        ? '\n📊 TODAY\'S WELL-BEING DATA'
        : '\n📊 ДАННЫЕ О САМОЧУВСТВИИ СЕГОДНЯ';
      if (healthDataSynced) {
        healthContext += isEnglish 
          ? ' (🍎 synced with Apple Health)'
          : ' (🍎 синхронизировано с Apple Health)';
      }
      healthContext += ':\n';
      healthContext += isEnglish
        ? `- Well-being index: ${todaySymptoms.wellness_index}/100\n`
        : `- Индекс самочувствия: ${todaySymptoms.wellness_index}/100\n`;
      healthContext += isEnglish
        ? `- Energy: ${todaySymptoms.energy}/5\n`
        : `- Энергия: ${todaySymptoms.energy}/5\n`;
      
      if (todaySymptoms.sleep_quality) {
        healthContext += isEnglish
          ? `- Sleep quality: ${todaySymptoms.sleep_quality}/5`
          : `- Качество сна: ${todaySymptoms.sleep_quality}/5`;
        if (healthDataSynced) {
          healthContext += isEnglish ? ' (from Apple Health)' : ' (из Apple Health)';
        }
        healthContext += '\n';
      }
      
      if (todaySymptoms.stress_level) {
        healthContext += isEnglish
          ? `- Stress level: ${todaySymptoms.stress_level}/5`
          : `- Уровень стресса: ${todaySymptoms.stress_level}/5`;
        if (healthDataSynced) {
          healthContext += isEnglish 
            ? ' (calculated from HRV Apple Health)'
            : ' (рассчитан из HRV Apple Health)';
        }
        healthContext += '\n';
      }
      
      if (todaySymptoms.mood && todaySymptoms.mood.length > 0) {
        healthContext += isEnglish
          ? `- Mood: ${todaySymptoms.mood.map((m: string) => moodLabels[lang][m] || m).join(', ')}\n`
          : `- Настроение: ${todaySymptoms.mood.map((m: string) => moodLabels[lang][m] || m).join(', ')}\n`;
      }
      
      if (todaySymptoms.physical_symptoms && todaySymptoms.physical_symptoms.length > 0) {
        healthContext += isEnglish
          ? `- Physical symptoms: ${todaySymptoms.physical_symptoms.map((s: string) => physicalLabels[lang][s] || s).join(', ')}\n`
          : `- Физические симптомы: ${todaySymptoms.physical_symptoms.map((s: string) => physicalLabels[lang][s] || s).join(', ')}\n`;
      }
      
      if (healthDataSynced) {
        healthContext += isEnglish
          ? '\n⚠️ IMPORTANT: Sleep and stress data obtained from Apple Health - these are objective health indicators that MUST be considered in recommendations!\n'
          : '\n⚠️ ВАЖНО: Данные о сне и стрессе получены из Apple Health - это объективные показатели здоровья, которые ОБЯЗАТЕЛЬНО нужно учесть в рекомендациях!\n';
      }
      
      healthContext += '\n';
    }
    
    // Add chat context
    if (recentMessages && recentMessages.length > 0) {
      const healthKeywords = isEnglish
        ? ['sick', 'hurts', 'tired', 'bad', 'pain', 'unwell', 'headache', 'back', 'stomach', 'nausea', 'weakness']
        : ['болею', 'болит', 'устала', 'плохо', 'больно', 'недомогание', 'головная боль', 'спина', 'живот', 'тошнит', 'слабость'];
      const relevantMessages = recentMessages.filter(msg => 
        healthKeywords.some(keyword => msg.content.toLowerCase().includes(keyword))
      );
      
      if (relevantMessages.length > 0) {
        healthContext += isEnglish
          ? `💬 Context from recent messages:\n${relevantMessages.map(msg => `- ${msg.content}`).join('\n')}\n`
          : `💬 Контекст из недавних сообщений:\n${relevantMessages.map(msg => `- ${msg.content}`).join('\n')}\n`;
      }
    }

    const { phase, description } = getCyclePhase(cycleData.cycleDay, cycleData.cycleLength, cycleData.menstrualLength || 5, language);
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
      timeOfDayContext = isEnglish 
        ? ' (very early morning - important to consider that the body may not be ready for activity)'
        : ' (очень раннее утро - важно учесть, что организм может быть не готов к активности)';
    } else if (eventHour >= 7 && eventHour < 9) {
      timeOfDayContext = isEnglish ? ' (early morning)' : ' (раннее утро)';
    } else if (eventHour >= 22 || eventHour < 5) {
      timeOfDayContext = isEnglish
        ? ' (late evening/night - important to consider impact on sleep and recovery)'
        : ' (поздний вечер/ночь - важно учесть влияние на сон и восстановление)';
    } else if (eventHour >= 20 && eventHour < 22) {
      timeOfDayContext = isEnglish ? ' (evening)' : ' (вечер)';
    }

    const userName = profile?.name ? profile.name : '';

    const prompt = isEnglish ? `
Evaluate the planned event considering the user's current menstrual cycle phase and well-being, then provide your recommendations.

Context:
• Cycle day: ${cycleData.cycleDay} (${phase})
• Characteristics: ${description}
• Event: «${event.title}»
• Event time: ${eventTime}${timeOfDayContext}
${healthContext ? '• Additional well-being information: ' + healthContext + '' : ''}
${profileContext}

IMPORTANT: Your response should be BRIEF - maximum 3-4 sentences (20-25% shorter than usual format).

Task: Write a brief but informative assessment of this event for the user, considering their cycle, condition AND EVENT TIME. The response should:
• Briefly describe how the current cycle phase affects energy and well-being
• MUST consider the event timing (if it's early morning or late evening - give specific recommendations!)
• Provide 1-2 practical tips for event preparation
• If well-being data is available, consider it in the response

CRITICAL: VARY YOUR OPENING! Use different phrases each time. Examples:
• "Let's look at this event..."
• "Interesting event! Here's what matters..."
• "About this event..."
• "A few important points..."
• "What you need to know..."
${userName ? `• "${userName}, here's my take..."
• "${userName}, this event..."` : ''}

Don't repeat the same opening phrase! Be creative and diverse.

Reference on cycle phases:
• Days 1–5 – Menstruation: reduced energy, fatigue, need for rest
• Days 6–13 – Follicular phase: increased energy, improved mood and concentration
• Days 14–16 – Ovulation: peak energy and endurance, high activity
• Days 17+ – Luteal phase: decreased energy, possible irritability

REMEMBER: Response should be very brief (3-4 sentences) and must consider event timing!
` : `
Оцени запланированное событие с учётом текущей фазы менструального цикла пользовательницы и её самочувствия, после чего предоставь свои рекомендации.

Контекст:
• День цикла: ${cycleData.cycleDay}-й (${phase})
• Особенности: ${description}
• Событие: «${event.title}»
• Время события: ${eventTime}${timeOfDayContext}
${healthContext ? '• Дополнительные сведения о самочувствии: ' + healthContext + '' : ''}
${profileContext}

ВАЖНО: Твой ответ должен быть КРАТКИМ - максимум 3-4 предложения (на 20-25% короче обычного формата). 

Задание: Напиши краткую, но ёмкую оценку этого мероприятия, учитывая цикл, состояние И ВРЕМЯ СОБЫТИЯ. В ответе необходимо:
• Коротко описать влияние текущей фазы цикла на энергию и самочувствие
• ОБЯЗАТЕЛЬНО учесть время проведения события (если это раннее утро или поздний вечер - дай конкретные рекомендации с учётом этого!)
• Дать 1-2 практических совета по подготовке к событию
• Если есть информация о самочувствии, учесть её при формулировке

КРИТИЧЕСКИ ВАЖНО: РАЗНООБРАЗЬ НАЧАЛО! Используй разные фразы каждый раз. Примеры:
• "Давай посмотрим на это событие..."
• "Интересное мероприятие! Вот что важно..."
• "По поводу этого события..."
• "Обрати внимание на несколько моментов..."
• "Что нужно знать об этом..."
• "Вот моя оценка..."
• "Разберём детальнее..."
${userName ? `• "${userName}, вот что важно..."
• "${userName}, это событие..."` : ''}

НЕ ПОВТОРЯЙ одну и ту же начальную фразу! Будь креативной и разнообразной.

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
          { 
            role: 'system', 
            content: isEnglish 
              ? 'You are an advanced and caring virtual assistant for women\'s health with deep understanding of the menstrual cycle and women\'s overall well-being. Your main goal is to provide competent, BRIEF and personalized recommendations based on the current cycle phase and the user\'s condition. Respond in English, using a simple and clear style. The tone should be friendly, caring and supportive. IMPORTANT: your responses should be short - maximum 3-4 sentences, but informative and useful. CRITICAL: Vary your opening phrases! Never repeat the same beginning twice in a row.'
              : 'Ты — продвинутый и заботливый виртуальный помощник по женскому здоровью с глубоким пониманием менструального цикла и общего самочувствия женщин. Твоя главная задача — давать компетентные, КРАТКИЕ и персонализированные рекомендации на основе текущей фазы цикла и состояния пользовательницы. Отвечай на русском языке, используя простой и понятный стиль изложения. Тон ответа должен быть дружелюбным, участливым и поддерживающим. ВАЖНО: твои ответы должны быть короткими - максимум 3-4 предложения, но при этом информативными и полезными. КРИТИЧЕСКИ ВАЖНО: Варьируй начальные фразы! Никогда не повторяй одно и то же начало два раза подряд.'
          },
          { role: 'user', content: prompt }
        ],
        temperature: 0.9,
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
    const justification = isEnglish 
      ? `AI advice for ${phase.toLowerCase()} (cycle day ${cycleData.cycleDay})`
      : `ИИ-совет для ${phase.toLowerCase()} (${cycleData.cycleDay} день цикла)`;

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