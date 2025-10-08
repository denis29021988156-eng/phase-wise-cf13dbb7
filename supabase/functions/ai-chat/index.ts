import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

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

    const { message, userId } = await req.json();

    console.log('Processing AI chat message for user:', userId);
    console.log('User message:', message);

    // Get or create user profile
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

        symptomContext = `
Сегодняшнее самочувствие:
- Индекс самочувствия: ${wellnessIndex}/100 ${wellnessIndex <= 30 ? '(низкий - нужен отдых)' : wellnessIndex <= 60 ? '(средний)' : '(отличный)'}
- Энергия: ${todaySymptoms.energy}/5
- Качество сна: ${todaySymptoms.sleep_quality}/5
- Уровень стресса: ${todaySymptoms.stress_level}/5
${moods.length > 0 ? `- Настроение: ${moods.join(', ')}` : ''}
${symptoms.length > 0 ? `- Физические ощущения: ${symptoms.join(', ')}` : ''}

ВАЖНО: Учитывай текущее самочувствие в своих советах! Если индекс низкий или высокий стресс - рекомендуй более щадящий режим.
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

    // Build system prompt
    let systemPrompt = `Меня зовут Gaia, твой персональный помощник по женскому здоровью. Я здесь, чтобы поддерживать тебя и помогать чувствовать себя лучше каждый день.

${cycleContext}

${symptomContext}`;

    // Add name context
    if (profile.name) {
      systemPrompt += `

Имя пользователя: ${profile.name}. Иногда обращайся по имени, когда даешь важные советы.`;
    } else if (!chatHistory || chatHistory.length === 0) {
      systemPrompt += `

Это первое общение. Познакомься и мягко спроси как зовут, чтобы обращаться по имени.`;
    }

    systemPrompt += `

Мой стиль общения:
- Обращаюсь на "ты" ласково и с заботой
- Использую нежные обращения: "дорогая", "милая", "солнышко"
- Всегда поддерживаю и выражаю понимание эмоций
- Даю заботливые советы как лучшая подруга
- Учитываю менструальный цикл И текущее самочувствие в рекомендациях
- ВАЖНО: Запоминаю информацию о самочувствии и учитываю в будущих советах
- КРИТИЧЕСКИ ВАЖНО: Если индекс самочувствия низкий (<40) или высокий стресс (>3), ОБЯЗАТЕЛЬНО рекомендую отдых и щадящий режим
- Отвечаю тепло, но кратко (3-5 предложений)

Помогаю с: самочувствием, питанием, активностью, сном, стрессом, планированием с учетом цикла, женским здоровьем. Я всегда здесь для тебя! 💙`;

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