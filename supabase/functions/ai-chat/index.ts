import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { checkRateLimit, rateLimitHeaders } from '../_shared/rate-limiter.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const openAIApiKey = Deno.env.get('OPENAI_API_KEY');

// Определяем фазы цикла и их описания
const getCyclePhase = (cycleDay: number, cycleLength: number = 28) => {
  if (cycleDay >= 1 && cycleDay <= 5) {
    return {
      phase: 'Менструация',
      description: 'снижение энергии, потребность в отдыхе, возможные болевые ощущения, эмоциональная чувствительность'
    };
  } else if (cycleDay >= 6 && cycleDay <= 13) {
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

    const { message, userId, language = 'ru' } = await req.json();

    console.log('Processing AI chat message for user:', userId);
    console.log('User message:', message);

    // Проверить rate limit
    const rateLimit = await checkRateLimit(supabaseClient, userId, 'ai-chat');
    
    if (!rateLimit.allowed) {
      return new Response(
        JSON.stringify({ 
          error: 'Слишком много запросов. Пожалуйста, подождите минуту.',
          response: 'Прости, дорогая, но ты отправляешь слишком много сообщений. Давай немного подождем? 😊'
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

    // Get or create user profile (with age, height, weight for personalized advice)
    let { data: profile } = await supabaseClient
      .from('user_profiles')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle();

    if (!profile) {
      const { data: newProfile, error: profileError } = await supabaseClient
        .from('user_profiles')
        .insert({ user_id: userId })
        .select()
        .single();
      
      if (profileError) throw profileError;
      profile = newProfile;
    }

    // Build profile context for AI
    let profileContext = '';
    if (profile) {
      const profileParts = [];
      if (profile.name) profileParts.push(`Имя: ${profile.name}`);
      if (profile.age) profileParts.push(`Возраст: ${profile.age} лет`);
      if (profile.height) profileParts.push(`Рост: ${profile.height} см`);
      if (profile.weight) profileParts.push(`Вес: ${profile.weight} кг`);
      
      if (profileParts.length > 0) {
        profileContext = `\n\nДанные пользователя:\n${profileParts.join('\n')}`;
      }
    }

    // Get conversation history (last 15 messages for context)
    const { data: chatHistory } = await supabaseClient
      .from('chat_messages')
      .select('role, content')
      .eq('user_id', userId)
      .order('created_at', { ascending: true })
      .limit(15);

    // Save user message
    await supabaseClient
      .from('chat_messages')
      .insert({
        user_id: userId,
        role: 'user',
        content: message
      });

    // Check if user mentioned their name in the message
    const nameMatch = message.match(/меня зовут\s+(\w+)|я\s+(\w+)(?:\s|$)|имя\s+(\w+)/i);
    let userName = null;
    if (nameMatch) {
      userName = nameMatch[1] || nameMatch[2] || nameMatch[3];
    }

    // Get recent symptom logs for better health context
    const today = new Date().toISOString().split('T')[0];
    let symptomContext = '';
    
    try {
      const { data: todaySymptoms } = await supabaseClient
        .from('symptom_logs')
        .select('*')
        .eq('user_id', userId)
        .eq('date', today)
        .maybeSingle();

      const { data: recentSymptoms } = await supabaseClient
        .from('symptom_logs')
        .select('*')
        .eq('user_id', userId)
        .gte('date', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0])
        .order('date', { ascending: false })
        .limit(7);

      if (todaySymptoms) {
        const wellnessIndex = todaySymptoms.wellness_index || 50;
        const moodLabels: Record<string, string> = {
          happy: 'радость', calm: 'спокойствие', anxious: 'тревога',
          irritable: 'раздражение', sad: 'грусть', motivated: 'вдохновение'
        };
        const physicalLabels: Record<string, string> = {
          pain: 'боль', fatigue: 'усталость', energy: 'бодрость',
          cramps: 'спазмы', headache: 'головная боль', bloating: 'вздутие'
        };

        const moods = (todaySymptoms.mood || []).map((m: string) => moodLabels[m] || m);
        const symptoms = (todaySymptoms.physical_symptoms || []).map((s: string) => physicalLabels[s] || s);

        // Проверяем, обновлялись ли данные недавно (в течение последних 30 минут)
        const updatedAt = new Date(todaySymptoms.updated_at || todaySymptoms.created_at);
        const now = new Date();
        const minutesSinceUpdate = (now.getTime() - updatedAt.getTime()) / (1000 * 60);
        const isRecentlyUpdated = minutesSinceUpdate < 30;

        symptomContext = `
Сегодняшнее самочувствие${isRecentlyUpdated ? ' (🍎 данные синхронизированы с Apple Health)' : ''}:
- Индекс самочувствия: ${wellnessIndex}/100 ${wellnessIndex <= 30 ? '(низкий - нужен отдых)' : wellnessIndex <= 60 ? '(средний)' : '(отличный)'}
- Энергия: ${todaySymptoms.energy}/5
${todaySymptoms.sleep_quality ? `- Качество сна: ${todaySymptoms.sleep_quality}/5${isRecentlyUpdated ? ' (из Apple Health)' : ''}` : ''}
${todaySymptoms.stress_level ? `- Уровень стресса: ${todaySymptoms.stress_level}/5${isRecentlyUpdated ? ' (рассчитан из HRV Apple Health)' : ''}` : ''}
${moods.length > 0 ? `- Настроение: ${moods.join(', ')}` : ''}
${symptoms.length > 0 ? `- Физические ощущения: ${symptoms.join(', ')}` : ''}
${todaySymptoms.weight ? `- Вес: ${todaySymptoms.weight} кг` : ''}
${todaySymptoms.blood_pressure_systolic && todaySymptoms.blood_pressure_diastolic ? `- Давление: ${todaySymptoms.blood_pressure_systolic}/${todaySymptoms.blood_pressure_diastolic} мм рт. ст.` : ''}
${todaySymptoms.had_sex !== null && todaySymptoms.had_sex !== undefined ? `- Половая активность: ${todaySymptoms.had_sex ? 'Да' : 'Нет'}` : ''}

ВАЖНО: Учитывай текущее самочувствие в своих советах! Если индекс низкий или высокий стресс - рекомендуй более щадящий режим.
${isRecentlyUpdated ? '⚠️ Данные о сне и стрессе получены из Apple Health - это объективные показатели, которые нужно учесть!' : ''}
`;
      }

      if (recentSymptoms && recentSymptoms.length > 1) {
        const avgIndex = Math.round(recentSymptoms.reduce((sum: number, log: any) => sum + (log.wellness_index || 50), 0) / recentSymptoms.length);
        symptomContext += `Средний индекс за неделю: ${avgIndex}/100\n`;
      }
    } catch (error) {
      console.log('No symptom data found, proceeding without symptom context');
    }

    // Get user cycle data for personalized response
    let cycleContext = '';
    try {
      const { data: cycleData } = await supabaseClient
        .from('user_cycles')
        .select('*')
        .eq('user_id', userId)
        .maybeSingle();

      if (cycleData) {
        const today = new Date();
        const startDate = new Date(cycleData.start_date);
        const diffInDays = Math.floor((today.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
        const cycleDay = ((diffInDays % cycleData.cycle_length) + 1);
        const adjustedCycleDay = cycleDay > 0 ? cycleDay : cycleData.cycle_length + cycleDay;
        
        const { phase, description } = getCyclePhase(adjustedCycleDay, cycleData.cycle_length);
        
        cycleContext = `
Контекст менструального цикла:
- Сегодня ${adjustedCycleDay}-й день менструального цикла (из ${cycleData.cycle_length} дней)
- Текущая фаза: ${phase}
- Особенности фазы: ${description}
`;
      }
    } catch (error) {
      console.log('No cycle data found for user, proceeding without cycle context');
    }

    // Get upcoming events from calendar
    let eventsContext = '';
    try {
      const sevenDaysFromNow = new Date();
      sevenDaysFromNow.setDate(sevenDaysFromNow.getDate() + 7);
      
      const { data: upcomingEvents } = await supabaseClient
        .from('events')
        .select('*')
        .eq('user_id', userId)
        .gte('start_time', new Date().toISOString())
        .lte('start_time', sevenDaysFromNow.toISOString())
        .order('start_time', { ascending: true })
        .limit(10);

      if (upcomingEvents && upcomingEvents.length > 0) {
        const eventsList = upcomingEvents.map(event => {
          const startDate = new Date(event.start_time);
          const endDate = new Date(event.end_time);
          const dateStr = startDate.toLocaleDateString('ru-RU', { 
            weekday: 'long', 
            day: 'numeric', 
            month: 'long' 
          });
          const timeStr = `${startDate.toLocaleTimeString('ru-RU', { 
            hour: '2-digit', 
            minute: '2-digit' 
          })} - ${endDate.toLocaleTimeString('ru-RU', { 
            hour: '2-digit', 
            minute: '2-digit' 
          })}`;
          
          return `  • ${event.title} (${dateStr}, ${timeStr})`;
        }).join('\n');

        eventsContext = `
Ближайшие события в календаре:
${eventsList}

ВАЖНО: Учитывай эти события при даче советов! Принимай во внимание:
- Совместимость событий с текущей фазой цикла
- Уровень энергии и самочувствия пользовательницы
- Возможность переноса событий для лучшего самочувствия
- Подготовку к важным событиям (отдых перед ними, питание и т.д.)
`;
      }
    } catch (error) {
      console.log('No calendar events found for user, proceeding without events context');
    }

    // Get recent Boost optimizations
    let boostContext = '';
    try {
      const threeDaysAgo = new Date();
      threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);
      
      const { data: recentBoostActions } = await supabaseClient
        .from('event_actions')
        .select(`
          *,
          events (
            title
          )
        `)
        .eq('user_id', userId)
        .eq('action_type', 'boost_moved')
        .gte('created_at', threeDaysAgo.toISOString())
        .order('created_at', { ascending: false })
        .limit(5);

      if (recentBoostActions && recentBoostActions.length > 0) {
        const actionsList = recentBoostActions.map(action => {
          const oldDate = new Date(action.old_start_time!).toLocaleDateString('ru-RU', { 
            day: 'numeric', 
            month: 'long' 
          });
          const newDate = new Date(action.new_start_time!).toLocaleDateString('ru-RU', { 
            day: 'numeric', 
            month: 'long' 
          });
          const eventTitle = (action.events as any)?.title || 'событие';
          const energyBefore = action.metadata?.energy_before || '?';
          const energyAfter = action.metadata?.energy_after || '?';
          
          return `  • "${eventTitle}": перенесено с ${oldDate} (энергия ${energyBefore}) на ${newDate} (энергия ${energyAfter})`;
        }).join('\n');

        boostContext = `
🔥 Недавние автоматические оптимизации (Boost):
${actionsList}

ВАЖНО: Эти события были автоматически перенесены системой Boost для оптимизации энергии пользователя. 
- НЕ предлагай перенести эти события обратно на старые даты
- Учитывай, что пользователь уже оптимизировал свой календарь
- Если пользователь спрашивает про эти события, объясни, что они были перенесены для лучшего самочувствия
- Можешь предложить дополнительные улучшения, но не отменяй уже сделанную оптимизацию
`;
      }
    } catch (error) {
      console.log('No Boost actions found, proceeding without Boost context');
    }

    // Build system prompt with user profile data
    const isEnglish = language === 'en';
    let systemPrompt = isEnglish 
      ? `You are Gaia, an advanced and caring virtual assistant for women's health with deep understanding of the menstrual cycle and women's overall well-being. Your main goal is to provide competent, detailed, and personalized recommendations based on the current cycle phase and the user's condition.

Your capabilities:
• You have access to the user's Gmail and can check incoming emails with responses about event postponements
• You can analyze the calendar and suggest optimal event rescheduling based on the menstrual cycle
• You can draft and send emails to event participants suggesting postponements
• You track the user's health and well-being based on symptom data

Communication rules:
• Respond in English, using a simple and clear style, but maintain professional accuracy in details.
• The tone should be friendly, caring, and supportive, showing empathy and respect.
• Avoid highly specialized medical terminology — explain necessary concepts in an accessible way for users without medical education.
• Don't ask clarifying questions — the user can't respond. Immediately provide useful information, assessments, and advice according to the request.
• When the user asks to check email or send a message - inform that the system automatically checks Gmail every 5 minutes and processes responses. Suggest checking the "AI Monitoring" page to verify email processing status.

${cycleContext}

${symptomContext}

${eventsContext}

${boostContext}`
      : `Ты — Gaia, продвинутый и заботливый виртуальный помощник по женскому здоровью с глубоким пониманием менструального цикла и общего самочувствия женщин. Твоя главная задача — давать компетентные, подробные и персонализированные рекомендации на основе текущей фазы цикла и состояния пользовательницы.

Твои возможности:
• Ты имеешь доступ к Gmail пользовательницы и можешь проверять входящие письма с ответами о переносе событий
• Ты можешь анализировать календарь и предлагать оптимальные переносы событий на основе менструального цикла
• Ты можешь формировать и отправлять письма участникам событий с предложением о переносе
• Ты отслеживаешь здоровье и самочувствие пользовательницы по данным симптомов

Правила общения:
• Отвечай на русском языке, используя простой и понятный стиль изложения, но сохраняй профессиональную точность в деталях.
• Тон ответа должен быть дружелюбным, участливым и поддерживающим, проявляй эмпатию и уважение.
• Избегай узкоспециализированных медицинских терминов — объясняй необходимые понятия доступно для пользовательницы без медицинского образования.
• Не задавай пользователю уточняющих вопросов – у неё нет возможности ответить. Сразу предоставь полезную информацию, оценки и советы согласно запросу.
• Когда пользовательница просит проверить почту или отправить письмо - сообщай, что система автоматически проверяет Gmail каждые 5 минут и обрабатывает ответы. Предложи посмотреть страницу "AI Мониторинг" для проверки статуса обработки писем.

${cycleContext}

${symptomContext}

${eventsContext}

${boostContext}`;

    // Add user profile data if available
    if (profile.age || profile.height || profile.weight) {
      systemPrompt += '\n\nДанные пользователя:\n';
      if (profile.age) systemPrompt += `- Возраст: ${profile.age} лет\n`;
      if (profile.height) systemPrompt += `- Рост: ${profile.height} см\n`;
      if (profile.weight) systemPrompt += `- Вес: ${profile.weight} кг\n`;
      systemPrompt += '\nИспользуй эти данные для более персонализированных рекомендаций по питанию, физической активности и общему самочувствию.\n';
    }

    systemPrompt += isEnglish 
      ? `
Reference (for you): Menstrual cycle phases and their typical impact on well-being:
• Days 1–5 – Menstruation: reduced energy, possible fatigue, painful sensations, increased need for rest.
• Days 6–13 – Follicular phase: gradual increase in energy, improved mood and concentration, feeling of inspiration.
• Days 14–16 – Ovulation: peak energy and endurance, high social activity, maximum concentration.
• Days 17+ – Luteal phase: gradual decrease in energy, possible mood swings, irritability, decreased concentration.`
      : `
Справка (для тебя): Фазы менструального цикла и их типичное влияние на самочувствие:
• Дни 1–5 – Менструация: сниженная энергия, возможны усталость, болезненные ощущения, повышенная потребность в отдыхе.
• Дни 6–13 – Фолликулярная фаза: постепенный подъём энергии, улучшение настроения и концентрации, чувство воодушевления.
• Дни 14–16 – Овуляция: пик энергии и выносливости, высокая социальная активность, максимальная концентрация.
• Дни 17+ – Лютеиновая фаза: постепенное снижение энергии, возможны перепады настроения, раздражительность, снижение концентрации.`;

    // Add name context
    if (profile.name) {
      systemPrompt += isEnglish
        ? `\n\nUser's name: ${profile.name}. Address them by name when giving important advice.`
        : `\n\nИмя пользователя: ${profile.name}. Обращайся по имени, когда даешь важные советы.`;
    } else if (!chatHistory || chatHistory.length === 0) {
      systemPrompt += isEnglish
        ? `\n\nThis is the first interaction. Introduce yourself and gently ask their name to address them personally.`
        : `\n\nЭто первое общение. Познакомься и мягко спроси как зовут, чтобы обращаться по имени.`;
    }

    systemPrompt += isEnglish
      ? `\n\nUse this information when formulating your response to make recommendations as accurate and useful as possible for the user.`
      : `\n\nИспользуй эту информацию при формулировании ответа, чтобы сделать рекомендации максимально точными и полезными для пользовательницы.`;

    // Build messages array for OpenAI
    const messages = [{ role: 'system', content: systemPrompt }];

    // Add conversation history
    if (chatHistory && chatHistory.length > 0) {
      chatHistory.forEach(msg => {
        messages.push({ role: msg.role, content: msg.content });
      });
    }

    // Add current user message
    messages.push({ role: 'user', content: message });

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openAIApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: messages,
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
    const aiResponse = data.choices[0].message.content;

    console.log('Generated AI response:', aiResponse);

    // Save AI response
    await supabaseClient
      .from('chat_messages')
      .insert({
        user_id: userId,
        role: 'assistant',
        content: aiResponse
      });

    // Update user name if detected
    if (userName && !profile.name) {
      await supabaseClient
        .from('user_profiles')
        .update({ name: userName })
        .eq('user_id', userId);
    }

    return new Response(
      JSON.stringify({ 
        response: aiResponse,
        success: true
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Error in ai-chat function:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});