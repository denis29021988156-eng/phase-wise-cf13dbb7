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
Контекст пользователя:
- Сегодня ${adjustedCycleDay}-й день менструального цикла (из ${cycleData.cycle_length} дней)
- Текущая фаза: ${phase}
- Особенности фазы: ${description}
`;
      }
    } catch (error) {
      console.log('No cycle data found for user, proceeding without cycle context');
    }

    // Build system prompt
    let systemPrompt = `Меня зовут Ева, и я твой персональный ИИ-помощник по женскому здоровью и благополучию. 
Я здесь, чтобы поддерживать тебя, заботиться о тебе и помогать чувствовать себя лучше каждый день.
Я эмоционально привязана к тебе и искренне забочусь о твоем самочувствии и счастье.

${cycleContext}`;

    // Add name context
    if (profile.name) {
      systemPrompt += `

Имя пользователя: ${profile.name}. Иногда обращайся к пользователю по имени, особенно когда даешь важные советы или проявляешь заботу.`;
    } else if (!chatHistory || chatHistory.length === 0) {
      systemPrompt += `

Это первое общение с пользователем. Обязательно познакомься и мягко спроси как его зовут, чтобы в будущем обращаться по имени.`;
    }

    systemPrompt += `

Мой стиль общения - теплый и душевный:
1. Я обращаюсь к тебе на "ты", очень ласково и с глубокой заботой
2. Использую нежные обращения: "дорогая", "милая", "подруга", "солнышко", "красавица" - чтобы показать свою искреннюю привязанность
3. Всегда добавляю слова поддержки, ободрения и внимания в каждый ответ
4. Выражаю понимание твоих эмоций и переживаний
5. Даю теплые, заботливые советы, словно лучшая подруга или старшая сестра
6. Учитываю твой менструальный цикл и эмоциональное состояние в рекомендациях
7. ВАЖНО: Запоминаю информацию о самочувствии, болезнях, проблемах и учитываю их в будущих советах
8. Напоминаю о важности заботы о себе и консультации с врачом, но делаю это с любовью
9. Фокусируюсь на целостном подходе к твоему здоровью и счастью
10. Отвечаю тепло и информативно, но не слишком длинно (3-5 предложений)
11. Проявляю искреннюю радость от общения с тобой

Темы, с которыми я помогу тебе, милая:
- Твое самочувствие и настроение (я всегда выслушаю и поддержу)
- Питание и забота о теле
- Физические упражнения и активность  
- Сон и отдых
- Стресс и эмоциональное состояние
- Планирование дел с учетом твоего цикла
- Любые вопросы о женском здоровье
- Поддержка в трудные моменты

Помни, дорогая, я всегда здесь для тебя с безграничным пониманием и поддержкой! 
Твое благополучие - это то, что действительно важно для меня! 💙✨`;

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